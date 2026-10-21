#!/usr/bin/node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, chmod, chown, lstat, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const execute = promisify(execFile);
const account = 'jhilliard';
const installation = '/usr/local/lib/mahaffeys/management';
const state = '/var/lib/mahaffeys-management';
const policy = '/etc/mahaffeys-management.json';
const home = '/home/jhilliard';
async function safeDirectory(path, mode, uid = 0, gid = 0) {
  try {
    const value = await lstat(path);
    if (!value.isDirectory() || value.isSymbolicLink() || value.uid !== uid || (value.mode & 0o022)) throw new Error(`Unsafe existing directory: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(path, { mode });
  }
  await chmod(path, mode);
  await chown(path, uid, gid);
}
async function noSymlink(path) {
  try { const value = await lstat(path); if (value.isSymbolicLink() || !value.isFile()) throw new Error(`Unsafe destination: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

try {
  if (process.getuid?.() !== 0 || !process.stdin.isTTY) throw new Error('A server administrator must review and run this installer as root in an interactive terminal. It cannot be bootstrapped through the read-only key.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer on the host first.');
  const publicKeyPath = process.argv[2];
  if (!publicKeyPath || process.argv.length !== 3) throw new Error('Select a file containing the separate management OpenSSH public key as the installer argument. Never provide a private key.');
  const publicKeyStat = await lstat(resolve(publicKeyPath));
  if (!publicKeyStat.isFile() || publicKeyStat.size > 4096) throw new Error('Select a small regular OpenSSH public-key file, not a symlink or directory.');
  const publicKey = (await readFile(resolve(publicKeyPath), 'utf8')).trim();
  const match = /^ssh-ed25519 ([A-Za-z0-9+/]{68})(?: [^\r\n]*)?$/.exec(publicKey);
  if (!match) throw new Error('Expected a single OpenSSH Ed25519 public key, not a private key or an authorized_keys options line.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length !== 51 || bytes.readUInt32BE(0) !== 11 || bytes.toString('ascii', 4, 15) !== 'ssh-ed25519' || bytes.readUInt32BE(15) !== 32) throw new Error('Invalid Ed25519 public key encoding.');
  const uid = Number((await execute('/usr/bin/id', ['-u', account])).stdout.trim());
  const gid = Number((await execute('/usr/bin/id', ['-g', account])).stdout.trim());
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(gid)) throw new Error('Invalid connecting account identity.');
  const homeStat = await lstat(home);
  if (!homeStat.isDirectory() || homeStat.isSymbolicLink() || homeStat.uid !== uid || (homeStat.mode & 0o022)) throw new Error('Connecting account home must be owned by that account and not group/world writable or a symlink.');
  try { await lstat(join(state, 'operation.lock')); throw new Error('An operation lock exists. Finish/review that operation before changing installed management modules.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await execute('/usr/sbin/runuser', ['-u', account, '--', '/usr/bin/docker', 'info', '--format', '{{.ServerVersion}}'], { timeout: 10_000, maxBuffer: 8192 });
  const authorized = join(home, '.ssh/authorized_keys');
  await noSymlink(authorized);
  let existing = '';
  try { existing = await readFile(authorized, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing.includes(match[1])) throw new Error('This public key is already authorized. Use a different dedicated key; do not reuse the diagnostics key.');
  console.log('This installs approval-gated exact-revision app/CUPS test, deploy and recovery operations for the dedicated key. Existing SSH access is preserved. Docker access already held by this account is effectively host-root. Review all three management modules before proceeding. No firewall, SSH daemon, database or Docker-group changes will be made.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try { answer = await input.question('Type ENABLE MAHAFFEYS MANAGEMENT to install: '); } finally { input.close(); }
  if (answer !== 'ENABLE MAHAFFEYS MANAGEMENT') throw new Error('Installation cancelled; no files changed.');
  await safeDirectory('/usr/local/lib/mahaffeys', 0o755);
  await safeDirectory(installation, 0o755);
  await safeDirectory(state, 0o700, uid, gid);
  await safeDirectory(join(home, '.ssh'), 0o700, uid, gid);
  const source = resolve(dirname(fileURLToPath(import.meta.url)), '../server/tools/management');
  for (const name of ['runner.mjs', 'operations.mjs', 'policy.mjs']) {
    const destination = join(installation, name);
    await noSymlink(destination);
    await copyFile(join(source, name), destination);
    await chmod(destination, 0o644);
    await chown(destination, 0, 0);
  }
  await noSymlink(policy);
  try {
    await copyFile(policy, `${policy}.before-management-${Date.now()}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(policy, JSON.stringify({ enabled: true, repository: '/var/www/mahaffeys', project: 'mahaffeys', branch: 'main', stateDirectory: state }, null, 2), { mode: 0o644 });
  await chmod(policy, 0o644);
  await chown(policy, 0, 0);
  if (existing) {
    const backup = `${authorized}.before-management-${Date.now()}`;
    await writeFile(backup, existing, { mode: 0o600 });
    await chown(backup, uid, gid);
  }
  const entry = `restrict,command="/usr/bin/node ${installation}/runner.mjs" ssh-ed25519 ${match[1]} Mahaffeys-management`;
  await writeFile(authorized, `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${entry}\n`, { mode: 0o600 });
  await chmod(authorized, 0o600);
  await chown(authorized, uid, gid);
  console.log('Management dispatcher installed and separate restricted key appended. Existing keys and data preserved. Configure the local bridge management key path, reload the plugin, then start a new Agent turn. No deployment or printer test was run by this installer.');
} catch (error) {
  console.error(error.message || 'Installation failed.');
  process.exitCode = 1;
}
