#!/usr/bin/node
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { readFile, lstat, mkdir, mkdtemp, open, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const base = '/usr/local/lib/mahaffeys';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = '/var/lib/mahaffeys-management';
const options = { timeout: 15_000, maxBuffer: 8192, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } };
const socketUnit = `[Unit]\nDescription=Restricted Mahaffeys host control socket\n\n[Socket]\nListenStream=/run/mahaffeys-control/control.sock\nSocketUser=jhilliard\nSocketGroup=1000\nSocketMode=0660\nDirectoryMode=0755\nService=mahaffeys-host-control.service\n\n[Install]\nWantedBy=sockets.target\n`;
const serviceUnit = `[Unit]\nDescription=Restricted Mahaffeys host control gateway\nRequires=mahaffeys-host-control.socket\nAfter=mahaffeys-host-control.socket docker.service\n\n[Service]\nUser=jhilliard\nExecStart=/usr/bin/node /usr/local/lib/mahaffeys/control/hostControlGateway.mjs\nEnvironment=HOME=/home/jhilliard\nEnvironment=PATH=/usr/bin:/bin\nNoNewPrivileges=true\nKillMode=process\nTimeoutStopSec=10\nStandardOutput=journal\nStandardError=journal\n`;

async function safeDirectory(path, create = false) {
  let value;
  try { value = await lstat(path); }
  catch (error) { if (error.code !== 'ENOENT' || !create) throw error; await mkdir(path, { mode: 0o755 }); value = await lstat(path); }
  if (!value.isDirectory() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022)) throw new Error(`Unsafe installation directory: ${path}`);
}
async function previousFile(path) {
  try {
    const value = await lstat(path);
    if (!value.isFile() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022) || value.size > 256 * 1024) throw new Error(`Unsafe destination: ${path}`);
    return { content: await readFile(path), mode: value.mode & 0o777 };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function replace(path, content, mode) {
  const temporary = `${path}.control-install-${process.pid}`;
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try {
    try { await file.writeFile(content); await file.chown(0, 0); await file.chmod(mode); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
function systemctl(args) { return execFileSync('/usr/bin/systemctl', args, options); }
function systemdState(args) { try { systemctl(args); return true; } catch { return false; } }

let lock;
try {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || !process.stdin.isTTY || !process.stdout.isTTY || process.argv.length !== 2) throw new Error('Review this fixed installer and use an interactive root Ubuntu host session; no arguments or remote bootstrap are supported.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Host Node.js 22+ is required.');
  const nodeVersion = execFileSync('/usr/bin/node', ['--version'], { ...options, encoding: 'utf8' }).trim();
  if (Number(nodeVersion.slice(1).split('.')[0]) < 22) throw new Error('Host /usr/bin/node must be Node.js 22+.');
  for (const path of ['/usr', '/usr/local', '/usr/local/lib', base, `${base}/management`, '/etc', '/etc/systemd', '/etc/systemd/system', '/var', '/var/lib', '/run']) await safeDirectory(path);
  const policyFile = '/etc/mahaffeys-management.json';
  await previousFile(policyFile);
  const policy = JSON.parse(await readFile(policyFile, 'utf8'));
  if (policy.enabled !== true || policy.repository !== '/var/www/mahaffeys' || policy.stateDirectory !== state || policy.project !== 'mahaffeys' || policy.branch !== 'main') throw new Error('Provision the existing separate-key guarded management connection first. This installer never enables or broadens its policy.');
  const uid = Number(execFileSync('/usr/bin/id', ['-u', 'jhilliard'], { ...options, encoding: 'utf8' }).trim());
  const value = await lstat(state);
  if (uid <= 0 || !Number.isInteger(uid) || !value.isDirectory() || value.isSymbolicLink() || value.uid !== uid || (value.mode & 0o077)) throw new Error('Existing private management state/account requires administrator review.');
  execFileSync('/usr/sbin/runuser', ['-u', 'jhilliard', '--', '/usr/bin/docker', '--host', 'unix:///var/run/docker.sock', 'info', '--format', '{{.ServerVersion}}'], options);
  execFileSync('/usr/sbin/ip', ['-Version'], options);
  execFileSync('/usr/bin/lsblk', ['--version'], options);
  execFileSync('/usr/bin/timeout', ['--version'], options);
  const entries = [
    ['server/tools/hostControlProtocol.mjs', `${base}/control/hostControlProtocol.mjs`, 0o644],
    ['server/tools/hostControlGateway.mjs', `${base}/control/hostControlGateway.mjs`, 0o644],
    ['server/tools/storageDiagnostics.mjs', `${base}/storage-report.mjs`, 0o644],
    ['server/tools/networkDiagnostics.mjs', `${base}/network-report.mjs`, 0o644],
    ['server/tools/management/policy.mjs', `${base}/management/policy.mjs`, 0o644],
    ['server/tools/management/operations.mjs', `${base}/management/operations.mjs`, 0o644],
    ['server/tools/management/runner.mjs', `${base}/management/runner.mjs`, 0o644],
    ['scripts/mahaffeys-diagnostics.sh', `${base}/mahaffeys-diagnostics.sh`, 0o755],
  ];
  const files = [];
  for (const [source, destination, mode] of entries) {
    const sourcePath = join(root, source);
    const value = await lstat(sourcePath);
    if (!value.isFile() || value.isSymbolicLink() || value.size > 256 * 1024) throw new Error('Review regular repository source files before installation.');
    execFileSync(source.endsWith('.sh') ? '/bin/sh' : '/usr/bin/node', [source.endsWith('.sh') ? '-n' : '--check', sourcePath], options);
    files.push({ destination, mode, content: await readFile(sourcePath), previous: await previousFile(destination) });
  }
  files.push({ destination: '/etc/systemd/system/mahaffeys-host-control.socket', mode: 0o644, content: socketUnit, previous: await previousFile('/etc/systemd/system/mahaffeys-host-control.socket') });
  files.push({ destination: '/etc/systemd/system/mahaffeys-host-control.service', mode: 0o644, content: serviceUnit, previous: await previousFile('/etc/systemd/system/mahaffeys-host-control.service') });
  console.log('This delegates fixed diagnostics and the existing guarded app restart/verify/deploy/status/rollback actions to the app through a Unix socket. The approved jhilliard Docker account is effectively host-root; a compromised app server could exercise these delegated actions. No arbitrary commands, network editor, Docker socket exposure, SSH keys, firewall changes, app redeployment or drive changes are installed. The systemd socket is accessible only to its owner and group 1000. Review local group membership.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try { answer = await input.question('Type ENABLE GUARDED HOST CONTROL to install: '); } finally { input.close(); }
  if (answer !== 'ENABLE GUARDED HOST CONTROL') throw new Error('Cancelled; no installed files changed.');
  lock = await open(join(state, 'operation.lock'), 'wx', 0o600);
  await lock.writeFile(JSON.stringify({ installer: true, createdAt: new Date().toISOString() }));
  const wasActive = systemdState(['is-active', '--quiet', 'mahaffeys-host-control.socket']);
  const wasEnabled = systemdState(['is-enabled', '--quiet', 'mahaffeys-host-control.socket']);
  const backup = await mkdtemp(`${base}/control-backup-`);
  const installed = [];
  try {
    if (files.find(file => file.destination.endsWith('mahaffeys-host-control.service')).previous) systemctl(['stop', 'mahaffeys-host-control.service']);
    if (files.find(file => file.destination.endsWith('mahaffeys-host-control.socket')).previous) systemctl(['stop', 'mahaffeys-host-control.socket']);
    await safeDirectory(`${base}/control`, true);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.previous) await replace(join(backup, `${index}.backup`), file.previous.content, 0o600);
    }
    await replace(join(backup, 'manifest.json'), JSON.stringify(files.map(file => ({ destination: file.destination, previousMode: file.previous?.mode ?? null })), null, 2), 0o600);
    for (const file of files) { await replace(file.destination, file.content, file.mode); installed.push(file); }
    systemctl(['daemon-reload']);
    systemctl(['enable', '--now', 'mahaffeys-host-control.socket']);
    console.log(`Guarded host connector installed. Private backups: ${backup}. App deployment and socket binding are separate reviewed steps. SSH keys, existing policy, app data and Docker volumes are unchanged.`);
  } catch (error) {
    let restored = true;
    for (const file of installed.reverse()) {
      try { if (file.previous) await replace(file.destination, file.previous.content, file.previous.mode); else await unlink(file.destination); }
      catch { restored = false; }
    }
    try { systemctl(['daemon-reload']); if (!wasEnabled) systemctl(['disable', 'mahaffeys-host-control.socket']); if (wasActive) systemctl(['start', 'mahaffeys-host-control.socket']); }
    catch { restored = false; }
    throw new Error(`Installation failed. ${restored ? 'Previous files restored.' : 'Recovery incomplete; administrator review required.'} Private backups: ${backup}. ${error.message}`);
  }
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'A management operation/installation is running or its lock requires review. No concurrent upgrade is allowed.' : error.message || 'Host control installation failed.');
  process.exitCode = 1;
} finally {
  if (lock) { await lock.close(); await unlink(join(state, 'operation.lock')); }
}
