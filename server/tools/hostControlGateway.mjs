import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, realpath, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateControlRequest } from './hostControlProtocol.mjs';

const execute = promisify(execFile);
const installation = '/usr/local/lib/mahaffeys';
const fixedSocket = '/run/mahaffeys-control/control.sock';
const cleanEnv = { PATH: '/usr/bin:/bin', HOME: '/home/jhilliard', LC_ALL: 'C' };
const options = { env: cleanEnv, cwd: '/var/www/mahaffeys', timeout: 25_000, maxBuffer: 256 * 1024 };
export function redactControlOutput(text) {
  return String(text).replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:[a-z0-9_]*(?:password|secret|token|api_key|authorization|cookie)[a-z0-9_]*)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[PRIVATE KEY REDACTED]');
}
export async function dispatchControl(value, run = execute) {
  const request = validateControlRequest(value);
  if (request.type === 'capabilities') return { available: true, diagnostics: ['containers', 'version', 'storage', 'network', 'cups', 'printer'], management: ['restart', 'prepare', 'status', 'deploy', 'rollback'] };
  const file = request.type === 'diagnostics' ? `${installation}/mahaffeys-diagnostics.sh` : '/usr/bin/node';
  const args = request.type === 'diagnostics' ? [] : [`${installation}/management/runner.mjs`];
  const result = await run(file, args, { ...options, env: { ...cleanEnv, SSH_ORIGINAL_COMMAND: request.token } });
  const output = redactControlOutput(result.stdout).trim();
  if (request.type === 'diagnostics') return { report: value.report, checkedAt: new Date().toISOString(), output };
  return JSON.parse(output);
}

async function startGateway() {
  if (process.platform !== 'linux' || process.argv.length !== 2 || await realpath(fileURLToPath(import.meta.url)) !== `${installation}/control/hostControlGateway.mjs`) throw new Error('Install the reviewed gateway at its fixed host path; no custom arguments or addresses are supported.');
  for (const path of ['/usr/local', '/usr/local/lib', installation, `${installation}/control`, `${installation}/management`, '/etc']) {
    const value = await lstat(path);
    if (!value.isDirectory() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022)) throw new Error('Unsafe installed gateway directory.');
  }
  for (const path of [`${installation}/control/hostControlGateway.mjs`, `${installation}/control/hostControlProtocol.mjs`, `${installation}/management/runner.mjs`, `${installation}/management/operations.mjs`, `${installation}/management/policy.mjs`, `${installation}/mahaffeys-diagnostics.sh`, `${installation}/storage-report.mjs`, `${installation}/network-report.mjs`, '/etc/mahaffeys-management.json']) {
    const value = await lstat(path);
    if (!value.isFile() || value.isSymbolicLink() || value.uid !== 0 || (value.mode & 0o022)) throw new Error('Administrator-reviewed root-owned gateway modules and policy are required.');
  }
  const uid = Number((await execute('/usr/bin/id', ['-u', 'jhilliard'], options)).stdout.trim());
  if (process.getuid() !== uid || uid === 0) throw new Error('The gateway must run as the existing approved jhilliard account, not root.');
  const policy = JSON.parse(await readFile('/etc/mahaffeys-management.json', 'utf8'));
  if (policy.enabled !== true) throw new Error('Management policy is disabled.');
  if (process.env.LISTEN_FDS !== '1' || process.env.LISTEN_PID !== String(process.pid)) throw new Error('Only systemd Unix-socket activation is supported; no TCP listener is permitted.');
  const socket = await lstat(fixedSocket);
  const directory = await lstat('/run/mahaffeys-control');
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== 0 || (directory.mode & 0o022) || !socket.isSocket() || socket.uid !== uid || socket.gid !== 1000 || (socket.mode & 0o777) !== 0o660) throw new Error('Unix socket ownership and permissions require administrator review.');
  let active = 0;
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => { response.statusCode = status; response.end(JSON.stringify(value)); };
    if (request.method !== 'POST' || request.url !== '/control') { send(404, { error: 'Unknown operation.' }); request.resume(); return; }
    if (active >= 4) { send(429, { error: 'Host control is busy.' }); request.resume(); return; }
    active += 1;
    try {
      let size = 0;
      const parts = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 4096) { send(413, { error: 'Request too large.' }); request.destroy(); return; }
        parts.push(chunk);
      }
      let value;
      try { value = JSON.parse(Buffer.concat(parts).toString('utf8')); validateControlRequest(value); }
      catch { send(400, { error: 'Invalid host-control request or confirmation.' }); return; }
      try { send(200, await dispatchControl(value)); }
      catch { send(409, { error: 'Host action refused or failed. Check the management job/host logs; no unrestricted fallback was attempted.' }); }
    } catch {
      if (!response.destroyed && !response.writableEnded) send(400, { error: 'Incomplete host-control request.' });
    } finally { active -= 1; }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  server.listen({ fd: 3 });
  process.once('SIGTERM', () => { server.close(); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startGateway().catch(() => { process.stderr.write('Host control gateway could not start; review its fixed installation, policy and socket permissions.\n'); process.exitCode = 1; });
}
