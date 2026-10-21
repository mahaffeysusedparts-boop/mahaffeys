import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, open, stat, statfs, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { digest, validateManifest, SERVICES } from './policy.mjs';

const execute = promisify(execFile);
const cleanEnv = () => ({ PATH: '/usr/bin:/bin', HOME: process.env.HOME, LC_ALL: 'C', DOCKER_CONFIG: process.env.HOME ? `${process.env.HOME}/.docker` : undefined });
export function redact(text) {
  return String(text).replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|secret|token|api[_-]?key|authorization|cookie)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]').slice(-1600);
}
async function run(program, args, timeout = 30_000) {
  try { return await execute(program, args, { env: cleanEnv(), timeout, maxBuffer: 256 * 1024 }); }
  catch (error) { throw new Error(`${program.split('/').pop()} failed: ${redact(error.stderr || error.message)}`); }
}
const docker = (args, timeout) => run('/usr/bin/docker', args, timeout);
const git = (repository, args, timeout) => run('/usr/bin/git', ['-c', 'core.hooksPath=/dev/null', '-c', 'protocol.file.allow=never', '-C', repository, ...args], timeout);
const compose = (policy, file, args, timeout) => docker(['compose', '--project-name', policy.project, '--env-file', join(policy.repository, '.env'), '--file', file, ...args], timeout);
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });
const load = async path => JSON.parse(await readFile(path, 'utf8'));
async function archiveHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function current(policy, allowMissing = false) {
  const result = {};
  for (const service of SERVICES) {
    const output = (await compose(policy, join(policy.repository, 'compose.yaml'), ['ps', '--all', '--quiet', service])).stdout.trim();
    if (!output && allowMissing) { result[service] = undefined; continue; }
    const ids = output.split(/\s+/);
    if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/.test(ids[0])) throw new Error('Expected exactly one existing container per managed service.');
    const info = JSON.parse((await docker(['inspect', ids[0]])).stdout)[0];
    if (info.Config.Labels['com.docker.compose.project'] !== policy.project || info.Config.Labels['com.docker.compose.service'] !== service) throw new Error('Container does not belong to the approved project/service.');
    result[service] = { id: info.Id, image: info.Image, state: info.State.Status };
  }
  return result;
}
async function manifest(policy, file) {
  return JSON.parse((await compose(policy, file, ['config', '--format', 'json'])).stdout);
}
async function baselineManifest(policy) {
  let active;
  try { active = await load(join(policy.stateDirectory, 'active.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!active) return manifest(policy, join(policy.repository, 'compose.yaml'));
  const actual = await current(policy);
  for (const service of SERVICES) if (actual[service].id !== active.containers[service].id || actual[service].image !== active.containers[service].image) throw new Error('Deployment drift requires administrator baseline review.');
  return active.manifest;
}
async function archive(container, path, file, restore = false) {
  const handle = await open(file, restore ? 'r' : 'wx', 0o600);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/docker', restore ? ['cp', '-a', '-', `${container}:${path}`] : ['cp', `${container}:${path}/.`, '-'], {
        env: cleanEnv(), stdio: restore ? [handle.fd, 'ignore', 'pipe'] : ['ignore', handle.fd, 'pipe'], shell: false,
      });
      let error = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
      const sizeTimer = restore ? undefined : setInterval(() => {
        void stat(file).then(value => { if (value.size > 5 * 1024 ** 3) child.kill('SIGKILL'); }).catch(() => undefined);
      }, 500);
      child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-1600); });
      child.on('error', failure => { clearTimeout(timer); clearInterval(sizeTimer); reject(failure); });
      child.on('close', code => { clearTimeout(timer); clearInterval(sizeTimer); code === 0 ? resolve() : reject(new Error(`Container archive failed; source data is preserved. ${redact(error)}`)); });
    });
  } finally { await handle.close(); }
}
async function health(id) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const info = JSON.parse((await docker(['inspect', id])).stdout)[0];
    if (info.State.Health?.Status === 'healthy') return;
    if (['exited', 'dead'].includes(info.State.Status)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Managed service did not become healthy. Printing success has not been inferred.');
}
async function test(policy, directory, images, liveConfig, progress) {
  const ids = [];
  const label = directory.split('/').pop();
  const runtime = join(directory, 'test-socket');
  await mkdir(runtime, { mode: 0o700 });
  const create = async args => {
    const id = (await docker(['create', '--network', 'none', '--label', `mahaffeys.management.job=${label}`, ...args])).stdout.trim();
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid disposable container ID.');
    ids.push(id);
    return id;
  };
  const appExec = (id, args, user) => docker(['exec', ...(user ? ['--user', user] : []), id, ...args], 20_000);
  const ready = async app => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await appExec(app, ['env', 'LC_ALL=C', 'timeout', '6', 'lpstat', '-h', '/run/mahaffeys-cups/cups.sock', '-r']);
        if (response.stdout.trim() === 'scheduler is running') return;
      } catch { /* The candidate scheduler may still be starting. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Candidate protected-socket scheduler did not become available.');
  };
  try {
    const cups = await create(['--mount', `type=bind,source=${runtime},target=/run/mahaffeys-cups`, images.cups]);
    await archive(cups, '/etc/cups', liveConfig, true);
    await docker(['start', cups]);
    const app = await create(['--mount', `type=bind,source=${runtime},target=/run/mahaffeys-cups,readonly`, '--entrypoint', 'node', images.mahaffeys, '-e', 'setInterval(()=>{},1000)']);
    await docker(['start', app]);
    await ready(app);
    const checks = 'const fs=require("node:fs"); if(process.getuid()!==1000||process.getgid()!==1000)throw new Error("Expected non-root UID/GID 1000"); const p=fs.statSync("/run/mahaffeys-cups"); if(p.uid!==0||p.gid!==1000||(p.mode&7)!==0||(p.mode&0o020)!==0)throw new Error("Socket parent must be root:1000, inaccessible to other users and not group-writable"); try{fs.accessSync("/run/cups/certs/0",fs.constants.R_OK);throw new Error("Root certificate is readable");}catch(e){if(e.message==="Root certificate is readable")throw e;}';
    await appExec(app, ['node', '-e', checks]);
    const args = ['env', 'LC_ALL=C', 'CUPS_USER=node', 'timeout', '10', 'lpadmin', '-h', '/run/mahaffeys-cups/cups.sock'];
    // Disabled raw queues isolate authorization; no lp/lpr, real printer or print job.
    await appExec(app, [...args, '-p', 'management_proof', '-v', 'socket://127.0.0.1:9', '-m', 'raw']);
    let denied = false;
    try { await appExec(app, ['env', 'LC_ALL=C', 'CUPS_USER=nobody', 'timeout', '10', 'lpadmin', '-h', '/run/mahaffeys-cups/cups.sock', '-x', 'management_proof'], '65534:1000'); }
    catch (error) { if (/forbidden|unauthorized|password|authorization|authentication/i.test(error.message)) denied = true; }
    if (!denied) throw new Error('Unauthorized-client denial was not demonstrated.');
    await docker(['restart', cups]);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await appExec(app, ['node', '-e', checks]);
    await appExec(app, [...args, '-x', 'management_proof']);
    await appExec(app, [...args, '-p', 'management_recreated', '-v', 'socket://127.0.0.1:9', '-m', 'raw']);
    await appExec(app, [...args, '-x', 'management_recreated']);
    const scheduler = (await appExec(app, ['env', 'LC_ALL=C', 'timeout', '6', 'lpstat', '-h', '/run/mahaffeys-cups/cups.sock', '-r'])).stdout.trim();
    if (scheduler !== 'scheduler is running') throw new Error('Configured socket scheduler is unavailable.');
    progress('Isolated non-root authorization, denial, certificate privacy, protected parent and restart checks passed. No print job sent.');
  } finally {
    for (const id of ids.reverse()) {
      const info = JSON.parse((await docker(['inspect', id])).stdout)[0];
      if (info.Config.Labels['mahaffeys.management.job'] === label) await docker(['rm', '--force', id]);
    }
    // Private test files are retained for administrator cleanup; no Docker volume deletion.
  }
}

export async function prepare(policy, job, directory, progress) {
  const disk = await statfs(policy.stateDirectory);
  if (disk.bavail * disk.bsize < 15 * 1024 ** 3) throw new Error('At least 15 GiB free space is required for images and bounded backups.');
  const security = JSON.parse((await docker(['info', '--format', '{{json .SecurityOptions}}'])).stdout);
  if (security.some(value => /rootless|userns/.test(value))) throw new Error('Remapped/rootless Docker is outside the verified management scope.');
  if ((await git(policy.repository, ['status', '--porcelain'])).stdout.trim()) throw new Error('Server checkout has uncommitted changes; refusing preparation.');
  progress('Fetching exact commit and verifying it belongs to the existing origin/main history.');
  await git(policy.repository, ['fetch', '--no-tags', 'origin', 'main:refs/remotes/origin/main'], 120_000);
  await git(policy.repository, ['cat-file', '-e', `${job.revision}^{commit}`]);
  await git(policy.repository, ['merge-base', '--is-ancestor', job.revision, 'refs/remotes/origin/main']);
  const source = join(directory, 'source');
  await git(policy.repository, ['worktree', 'add', '--detach', source, job.revision]);
  const baseline = await baselineManifest(policy);
  const baselineHash = digest(baseline);
  const candidate = await manifest(policy, join(source, 'compose.yaml'));
  validateManifest(baseline, candidate);
  const containers = await current(policy);
  const config = join(directory, 'verified-cups-config.tar');
  await archive(containers.cups.id, '/etc/cups', config);
  const configHash = await archiveHash(config);
  const images = {};
  for (const service of SERVICES) {
    const image = `mahaffeys-managed-${service}:${job.id}`;
    const dockerfile = service === 'cups' ? join(source, 'deploy/docker/cups.Dockerfile') : join(source, 'Dockerfile');
    progress(`Building committed ${service} image.`);
    await docker(['build', '--label', `mahaffeys.management.revision=${job.revision}`, '--file', dockerfile, '--tag', image, source], 20 * 60_000);
    images[service] = JSON.parse((await docker(['image', 'inspect', image])).stdout)[0].Id;
    candidate.services[service].image = images[service];
    delete candidate.services[service].build;
    baseline.services[service].image = containers[service].image;
    delete baseline.services[service].build;
  }
  await test(policy, directory, images, config, progress);
  await save(join(directory, 'candidate.json'), candidate);
  await save(join(directory, 'previous.json'), baseline);
  await save(join(directory, 'plan.json'), { revision: job.revision, containers, images, configHash, baselineHash });
  progress('Prepared plan passed all checks. Deployment requires a separate approved request.');
}

export async function deploy(policy, job, directory, progress, rollback = false) {
  const disk = await statfs(policy.stateDirectory);
  if (disk.bavail * disk.bsize < 15 * 1024 ** 3) throw new Error('At least 15 GiB free space is required for consistent config/cache/spool backups.');
  const parent = join(policy.stateDirectory, job.parent);
  const plan = await load(join(parent, 'plan.json'));
  const latest = await current(policy, rollback);
  if (!rollback && (digest(latest) !== digest(plan.containers) || digest(await baselineManifest(policy)) !== plan.baselineHash)) throw new Error('Live deployment changed after preparation; prepare a fresh plan.');
  if (rollback) {
    for (const service of SERVICES) if (latest[service] && ![plan.images[service], plan.containers[service].image].includes(latest[service].image)) throw new Error('A newer deployment exists; refusing stale rollback.');
  }
  const recovery = rollback ? await load(join(policy.stateDirectory, job.recovery, 'report.json')) : undefined;
  if (!latest.cups && (!recovery || recovery.status !== 'failed' || recovery.spoolRestored)) throw new Error('Current CUPS spool cannot be captured safely; administrator recovery is required.');
  const file = join(parent, rollback ? 'previous.json' : 'candidate.json');
  const backups = join(directory, 'backup');
  await mkdir(backups, { mode: 0o700 });
  await save(join(directory, 'before.json'), latest);
  let replaced = false;
  try {
    progress('Stopping only app/CUPS for a consistent configuration/cache/queued-document snapshot.');
    const existingIds = SERVICES.map(service => latest[service]?.id).filter(Boolean);
    if (existingIds.length) await docker(['stop', '--time', '30', ...existingIds], 90_000);
    for (const [name, path] of [['config', '/etc/cups'], ['cache', '/var/cache/cups'], ['spool', '/var/spool/cups']]) {
      if (latest.cups) await archive(latest.cups.id, path, join(backups, `${name}.tar`));
      else await copyFile(join(policy.stateDirectory, job.recovery, `backup/${name}.tar`), join(backups, `${name}.tar`));
    }
    if (!rollback && await archiveHash(join(backups, 'config.tar')) !== plan.configHash) throw new Error('CUPS policy/queue configuration changed since verified testing; refusing deployment.');
    const spool = recovery && !recovery.spoolRestored && latest.cups?.id !== plan.containers.cups.id
      ? join(policy.stateDirectory, job.recovery, 'backup/spool.tar') : join(backups, 'spool.tar');
    progress('Recreating only app/CUPS from pinned, already-built images; preserving named volumes.');
    replaced = true;
    await compose(policy, file, ['create', '--no-build', '--pull', 'never', '--force-recreate', ...SERVICES], 120_000);
    const after = await current(policy);
    await archive(after.cups.id, '/var/spool/cups', spool, true);
    job.spoolRestored = true;
    progress('Queued-document archive restored before starting the replacement CUPS container.');
    await docker(['start', after.cups.id]);
    await health(after.cups.id);
    await docker(['start', after.mahaffeys.id]);
    await health(after.mahaffeys.id);
    const healthy = await current(policy);
    await save(join(directory, 'after.json'), healthy);
    await save(join(policy.stateDirectory, 'active.json'), { manifest: await load(file), containers: healthy });
    if (rollback) await save(join(policy.stateDirectory, 'last-deployment.json'), { jobId: job.id });
    progress(rollback ? 'Previous images/Compose configuration restored with current queued documents preserved. Saved CUPS policies were not blindly overwritten.' : 'App/CUPS deployment is healthy. Physical printer output has not been tested.');
  } catch (error) {
    if (!replaced) {
      const ids = SERVICES.map(service => latest[service]?.id).filter(Boolean);
      if (ids.length) await docker(['start', ...ids]).catch(() => undefined);
      progress('No container replacement occurred; original existing services were restarted.');
    } else {
      const currentIds = await current(policy, true).catch(() => undefined);
      const ids = currentIds ? SERVICES.map(service => currentIds[service]?.id).filter(Boolean) : [];
      if (ids.length) await docker(['stop', '--time', '10', ...ids]).catch(() => undefined);
      progress('Deployment stopped for safety. Backups retained. Use approved rollback; no volume or queue-data deletion was attempted.');
    }
    throw error;
  }
}
