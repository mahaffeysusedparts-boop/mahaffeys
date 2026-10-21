#!/usr/bin/node
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, rename, unlink, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { INSTALL, loadPolicy, parseCommand } from './policy.mjs';
import { prepare, deploy, redact } from './operations.mjs';

const executable = fileURLToPath(import.meta.url);
const save = async (path, value) => {
  await import('node:fs/promises').then(fs => fs.writeFile(`${path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 }));
  await rename(`${path}.tmp`, path);
};
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const report = (policy, id) => join(policy.stateDirectory, id, 'report.json');
const publicReport = job => ({ jobId: job.id, action: job.action, revision: job.revision, preparedJob: job.parent, status: job.status, createdAt: job.createdAt, finishedAt: job.finishedAt, steps: job.steps, error: job.error, verified: job.action === 'prepare' && job.status === 'succeeded', noAutomaticPrintTest: true });

try {
  if (await realpath(executable) !== `${INSTALL}/runner.mjs`) throw new Error('An administrator must install this runner at its fixed root-owned path before it can execute.');
  const policy = await loadPolicy();
  const lockPath = join(policy.stateDirectory, 'operation.lock');
  if (process.argv[2] === '--job') {
    const id = process.argv[3];
    if (!/^[a-f0-9]{32}$/.test(id || '') || process.env.SSH_ORIGINAL_COMMAND) throw new Error('Invalid internal worker invocation.');
    const lock = await load(lockPath);
    if (lock.jobId !== id) throw new Error('Worker does not own the operation lock.');
    const job = await load(report(policy, id));
    const directory = join(policy.stateDirectory, id);
    let writes = Promise.resolve();
    const progress = text => {
      job.steps = [...job.steps, { at: new Date().toISOString(), message: redact(text) }].slice(-60);
      const snapshot = structuredClone(job);
      writes = writes.then(() => save(report(policy, id), snapshot));
    };
    try {
      job.status = 'running';
      progress('Restricted management operation started.');
      if (job.action === 'prepare') await prepare(policy, job, directory, progress);
      else await deploy(policy, job, directory, progress, job.action === 'rollback');
      job.status = 'succeeded';
    } catch (error) {
      job.status = 'failed';
      job.error = redact(error.message || 'Management operation failed.');
    } finally {
      job.finishedAt = new Date().toISOString();
      await writes;
      await save(report(policy, id), job);
      await unlink(lockPath);
    }
  } else {
    const request = parseCommand(process.env.SSH_ORIGINAL_COMMAND || '');
    if (request.action === 'status') {
      console.log(JSON.stringify(publicReport(await load(report(policy, request.target)))));
    } else {
      let parent;
      let recovery;
      let revision;
      if (request.action !== 'prepare') {
        const previous = await load(report(policy, request.target));
        if (request.action === 'deploy') {
          if (previous.action !== 'prepare' || previous.status !== 'succeeded' || Date.now() - Date.parse(previous.finishedAt) > 60 * 60_000) throw new Error('Use a successfully verified preparation less than one hour old.');
          parent = previous.id;
          revision = previous.revision;
        } else {
          const last = await load(join(policy.stateDirectory, 'last-deployment.json'));
          if (last.jobId !== previous.id || previous.action !== 'deploy' || !['succeeded', 'failed'].includes(previous.status)) throw new Error('Rollback is restricted to the most recent finished deployment attempt.');
          parent = previous.parent;
          recovery = previous.id;
          revision = previous.revision;
        }
      } else {
        revision = request.target;
        let last;
        try { last = await load(join(policy.stateDirectory, 'last-deployment.json')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (last) {
          const previous = await load(report(policy, last.jobId));
          if (previous.status === 'failed') throw new Error('The failed deployment must be recovered/reviewed before preparing another revision.');
        }
      }
      const id = randomBytes(16).toString('hex');
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch { throw new Error('Another operation is running, or a stale operation lock requires administrator review. No concurrent deployment is allowed.'); }
      try {
        await lock.writeFile(JSON.stringify({ jobId: id, createdAt: new Date().toISOString() }));
        await mkdir(join(policy.stateDirectory, id), { mode: 0o700 });
        const job = { id, action: request.action, revision, parent, recovery, status: 'queued', createdAt: new Date().toISOString(), steps: [] };
        await save(report(policy, id), job);
        if (request.action === 'deploy') await save(join(policy.stateDirectory, 'last-deployment.json'), { jobId: id });
        const child = spawn(process.execPath, [executable, '--job', id], { detached: true, stdio: 'ignore', env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, LC_ALL: 'C' }, shell: false });
        await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
        child.unref();
        console.log(JSON.stringify({ jobId: id, status: 'queued', action: request.action, pollForResult: true, deploymentStarted: request.action === 'deploy' }));
      } catch (error) {
        await unlink(lockPath).catch(() => undefined);
        throw error;
      } finally { await lock.close(); }
    }
  }
} catch (error) {
  console.error(redact(error.message || 'Management request rejected.'));
  process.exitCode = 1;
}
