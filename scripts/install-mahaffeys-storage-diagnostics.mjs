#!/usr/bin/node
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, readFile, mkdir, mkdtemp, open, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const installation = '/usr/local/lib/mahaffeys';
const dispatcher = `${installation}/mahaffeys-diagnostics.sh`;
const helper = `${installation}/storage-report.mjs`;
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = { timeout: 5000, maxBuffer: 8192, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } };

async function rootDirectory(path, create = false) {
  let value;
  try { value = await lstat(path); }
  catch (error) {
    if (!create || error.code !== 'ENOENT') throw error;
    await mkdir(path, { mode: 0o755 });
    value = await lstat(path);
  }
  if (!value.isDirectory() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022)) throw new Error(`Unsafe root-owned installation directory: ${path}`);
}

async function existingFile(path) {
  try {
    const value = await lstat(path);
    if (!value.isFile() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022) || value.size > 256 * 1024) throw new Error(`Unsafe installed file: ${path}`);
    return { content: await readFile(path), mode: value.mode & 0o777 };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicWrite(path, content, mode) {
  const temporary = `${path}.storage-install-${process.pid}`;
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try {
    try {
      await file.writeFile(content);
      await file.chmod(mode);
      await file.chown(0, 0);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

try {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || !process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Administrator installation requires an interactive Ubuntu host session with root privileges. No remote diagnostics installation is supported.');
  if (process.argv.length !== 2) throw new Error('This fixed installer accepts no arguments. It never accepts keys, passwords, commands or storage paths.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Host Node.js 22 or newer at /usr/bin/node is required; container Node.js does not satisfy this prerequisite.');
  for (const path of ['/usr', '/usr/local', '/usr/local/lib']) await rootDirectory(path);
  const files = [
    { source: join(sourceRoot, 'server/tools/storageDiagnostics.mjs'), destination: helper, mode: 0o644 },
    { source: join(sourceRoot, 'scripts/mahaffeys-diagnostics.sh'), destination: dispatcher, mode: 0o755 },
  ];
  for (const file of files) {
    const value = await lstat(file.source);
    if (!value.isFile() || value.isSymbolicLink() || value.size > 256 * 1024) throw new Error('Review regular repository source files before installation.');
    file.content = await readFile(file.source);
  }
  execFileSync('/usr/bin/node', ['--check', files[0].source], checks);
  execFileSync('/bin/sh', ['-n', files[1].source], checks);
  execFileSync('/usr/bin/timeout', ['--version'], checks);
  execFileSync('/usr/bin/lsblk', ['--version'], checks);
  execFileSync('/usr/bin/node', ['--version'], checks);
  const uid = Number(execFileSync('/usr/bin/id', ['-u', 'jhilliard'], { ...checks, encoding: 'utf8' }).trim());
  const home = await lstat('/home/jhilliard');
  const ssh = await lstat('/home/jhilliard/.ssh');
  const authorizedPath = '/home/jhilliard/.ssh/authorized_keys';
  const authorized = await lstat(authorizedPath);
  if (!Number.isInteger(uid) || uid <= 0 || !home.isDirectory() || home.isSymbolicLink() || home.uid !== uid || (home.mode & 0o022) || !ssh.isDirectory() || ssh.isSymbolicLink() || ssh.uid !== uid || (ssh.mode & 0o077) || !authorized.isFile() || authorized.isSymbolicLink() || authorized.uid !== uid || (authorized.mode & 0o077) || authorized.size > 1024 * 1024) throw new Error('Existing SSH account/files require administrator review; the installer will not change them.');
  const entries = (await readFile(authorizedPath, 'utf8')).split(/\r?\n/);
  if (!entries.some(line => /^restrict,command="\/usr\/local\/lib\/mahaffeys\/mahaffeys-diagnostics\.sh" ssh-ed25519 [A-Za-z0-9+/=]+(?:\s|$)/.test(line))) throw new Error('An existing dedicated restricted diagnostics key is required. No key will be created or authorized by this installer.');
  // Confirm already-approved access without granting Docker-group or sudo permissions.
  execFileSync('/usr/sbin/runuser', ['-u', 'jhilliard', '--', '/usr/bin/docker', '--host', 'unix:///var/run/docker.sock', 'info', '--format', '{{.ServerVersion}}'], checks);
  await rootDirectory(installation);
  for (const file of files) file.previous = await existingFile(file.destination);
  if (!files[1].previous) throw new Error('The existing root-owned diagnostics dispatcher must already be installed. This is an upgrade, not a new SSH connection installer.');
  console.log('Review the repository helper and dispatcher. This upgrade installs read-only drive/Docker storage reporting only. It does not alter SSH keys, account permissions, services, volumes, mounts or app data. Reports contain paths and filesystem UUIDs. Previous installed files will be backed up privately.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try { answer = await input.question('Type ENABLE STORAGE DIAGNOSTICS to install: '); }
  finally { input.close(); }
  if (answer !== 'ENABLE STORAGE DIAGNOSTICS') throw new Error('Cancelled; no installed files changed.');
  const backup = await mkdtemp(`${installation}/storage-backup-`);
  const installed = [];
  try {
    for (const file of files) {
      if (file.previous) await atomicWrite(join(backup, file.destination === helper ? 'storage-report.mjs' : 'mahaffeys-diagnostics.sh'), file.previous.content, 0o600);
    }
    // Install the helper before the dispatcher can expose the new operation.
    for (const file of files) {
      await atomicWrite(file.destination, file.content, file.mode);
      installed.push(file);
    }
  } catch (error) {
    let recovered = true;
    for (const file of installed.reverse()) {
      try {
        if (file.previous) await atomicWrite(file.destination, file.previous.content, file.previous.mode);
        else await unlink(file.destination);
      } catch { recovered = false; }
    }
    throw new Error(`Installation failed. ${recovered ? 'Previous installed files restored.' : 'Automatic recovery incomplete; administrator review required.'} Private backups: ${backup}. ${error.message}`);
  }
  console.log(`Storage diagnostics installed. Private backups: ${backup}. Existing SSH restrictions and app data preserved. Reload the local Dyad plugin and start a new Agent turn. No storage migration or live storage probe was performed.`);
} catch (error) {
  console.error(error.message || 'Installation failed.');
  process.exitCode = 1;
}
