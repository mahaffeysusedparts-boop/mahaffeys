import { execFile, spawn } from 'node:child_process';
import { access, mkdtemp, open, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { runWindowsSshProcess } from './windowsSshProcess';

const execFileAsync = promisify(execFile);

export const SERVER_HOST = '192.168.1.210';
export const SERVER_USER = 'jhilliard';
export const SERVICES = ['mahaffeys', 'cups', 'nginx', 'postgres', 'storage-agent', 'vision-worker'] as const;
export type Service = typeof SERVICES[number];
export type DiagnosticRequest =
  | { operation: 'connection' | 'containers' | 'version' | 'cups' | 'printer' }
  | { operation: 'logs'; service: Service; lines: number };

export interface SshFiles {
  identityFile: string;
  knownHostsFile: string;
}

export function defaultSshFiles(): SshFiles {
  return {
    identityFile: join(homedir(), '.ssh', 'mahaffeys_mcp'),
    knownHostsFile: join(homedir(), '.ssh', 'known_hosts'),
  };
}

export function requestToken(request: DiagnosticRequest): string {
  if (request.operation === 'logs') {
    if (!SERVICES.includes(request.service) || !Number.isInteger(request.lines) || request.lines < 10 || request.lines > 200) {
      throw new Error('Choose an approved service and between 10 and 200 log lines.');
    }
    return `logs:${request.service}:${request.lines}`;
  }
  if (!['connection', 'containers', 'version', 'cups', 'printer'].includes(request.operation)) {
    throw new Error('Only read-only diagnostic operations are allowed.');
  }
  return request.operation;
}

export function sshArgs(request: DiagnosticRequest, files: SshFiles): string[] {
  return [
    '-F', 'none', '-T', '-p', '22',
    '-o', 'BatchMode=yes',
    '-o', 'PreferredAuthentications=publickey',
    '-o', 'PasswordAuthentication=no',
    '-o', 'KbdInteractiveAuthentication=no',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'ConnectionAttempts=1',
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=2',
    '-o', `UserKnownHostsFile=${files.knownHostsFile}`,
    '-i', files.identityFile,
    `${SERVER_USER}@${SERVER_HOST}`,
    requestToken(request),
  ];
}

export function redactLogs(text: string): string {
  return text
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\bBearer\s+[a-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:[a-z0-9_]*(?:password|passwd|secret|token|api_key|apikey|authorization)[a-z0-9_]*)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[PRIVATE KEY REDACTED]');
}

export function sshFailure(message: string): string {
  if (/host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(message)) {
    return 'SSH host verification failed. Verify the server fingerprint through a trusted channel and configure your Windows known_hosts file. Host verification has not been bypassed.';
  }
  if (/permission denied.*publickey/i.test(message)) {
    return 'SSH key authentication failed. Authorize the dedicated public key for jhilliard and load its passphrase-protected private key into the Windows OpenSSH agent. Password login is intentionally disabled for this bridge.';
  }
  return redactLogs(message);
}

export async function checkSshFiles(files: SshFiles): Promise<void> {
  let file;
  try {
    file = await open(files.identityFile, 'r');
  } catch {
    throw new Error(`Cannot open the private key at ${files.identityFile}. Check its exact filename, extension, and Windows read permissions. Do not use the .pub or .ppk file.`);
  }
  try {
    const header = Buffer.alloc(128);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const firstLine = header.subarray(0, bytesRead).toString('utf8').split(/\r?\n/, 1)[0];
    if (firstLine !== '-----BEGIN OPENSSH PRIVATE KEY-----') {
      throw new Error(`The file at ${files.identityFile} is not an OpenSSH private key. Export the existing private key from PuTTYgen using Conversions → Export OpenSSH key. Its contents will not be returned by this tool.`);
    }
  } finally {
    await file.close();
  }
  try {
    await access(files.knownHostsFile);
  } catch {
    throw new Error(`Cannot access the verified host-key file at ${files.knownHostsFile}. Confirm its filename is known_hosts, not known_hosts.txt. Host verification remains enabled.`);
  }
}

export async function readSshTrace(path: string): Promise<string> {
  try {
    const file = await open(path, 'r');
    try {
      const { size } = await file.stat();
      const buffer = Buffer.alloc(Math.min(size, 64 * 1024));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length));
      return redactLogs(buffer.subarray(0, bytesRead).toString('utf8')).trim();
    } finally {
      await file.close();
    }
  } catch { return ''; }
}

function openSshExecutable(name: 'ssh' | 'ssh-add' | 'ssh-keygen'): string {
  return process.platform === 'win32'
    ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', `${name}.exe`)
    : name;
}

export function localEvidenceRequests(files: SshFiles) {
  return [
    { label: 'Local OpenSSH version', executable: 'ssh' as const, args: ['-V'] },
    { label: 'Keys visible to the local OpenSSH agent (public fingerprints only)', executable: 'ssh-add' as const, args: ['-l', '-E', 'sha256'] },
    { label: 'Companion .pub file fingerprint (not proof it matches the private key)', executable: 'ssh-keygen' as const, args: ['-l', '-f', `${files.identityFile}.pub`, '-E', 'sha256'] },
  ];
}

export function localProcessContext(): string {
  const names = new Set(Object.keys(process.env).filter(key => process.env[key]).map(key => key.toUpperCase()));
  const presence = ['SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'PROGRAMDATA', 'TEMP', 'TMP', 'PATH']
    .map(name => `${name}: ${names.has(name) ? 'present' : 'missing'}`).join('\n');
  return `Bridge process context (environment values omitted):\nPlatform: ${process.platform}\nArchitecture: ${process.arch}\nNode: ${process.version}\n${presence}`;
}

async function collectLocalSshEvidence(files: SshFiles, signal?: AbortSignal): Promise<string> {
  const results = await Promise.all(localEvidenceRequests(files).map(async request => {
    try {
      const executable = openSshExecutable(request.executable);
      const result = process.platform === 'win32'
        ? await runWindowsSshProcess(executable, request.args, { timeout: 4000, maxBuffer: 8192, signal })
        : await execFileAsync(executable, request.args, {
          windowsHide: true, timeout: 4000, maxBuffer: 8192, encoding: 'utf8', signal,
        });
      const detail = redactLogs(`${result.stdout}\n${result.stderr}`).trim();
      const status = 'code' in result && result.code !== 0 ? `Check failed (${result.code}).\n` : '';
      return `${request.label}:\n${status}${detail || 'No output returned.'}`;
    } catch (error) {
      const failure = error as Error & { stdout?: string; stderr?: string; code?: string | number };
      const detail = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.trim();
      return `${request.label}:\n${redactLogs(detail || `Check failed (${failure.code ?? 'unknown'}): ${failure.message}`)}`;
    }
  }));
  return [localProcessContext(), ...results].join('\n\n');
}

async function diagnosticFailure(code: number | null, output: string, errors: string, request: DiagnosticRequest, files: SshFiles, traceFile?: string, signal?: AbortSignal): Promise<Error> {
  const trace = traceFile ? await readSshTrace(traceFile) : '';
  const detail = [errors.trim(), output.trim(), trace].filter(Boolean).join('\n');
  const explanation = sshFailure(detail);
  const localEvidence = request.operation === 'connection' ? await collectLocalSshEvidence(files, signal) : '';
  const message = detail
    ? `SSH exited with code ${code}.\n${explanation}${trace && explanation !== detail ? `\nOpenSSH trace:\n${trace}` : ''}`
    : `SSH exited with code ${code} without an error message${traceFile ? ' or a readable OpenSSH trace' : ''}. Private-key and known_hosts files were found, but authentication and connectivity remain unverified.`;
  return new Error(`${message}${localEvidence ? `\n\nLocal read-only checks:\n${localEvidence}` : ''}`);
}

export async function runDiagnostic(request: DiagnosticRequest, files: SshFiles, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new Error('Diagnostic request cancelled.');
  await checkSshFiles(files);
  if (signal?.aborted) throw new Error('Diagnostic request cancelled.');
  const executable = openSshExecutable('ssh');
  // A file-based trace also captures Windows OpenSSH errors when stderr is empty.
  const traceDirectory = request.operation === 'connection' ? await mkdtemp(join(tmpdir(), 'mahaffeys-ssh-')) : undefined;
  const traceFile = traceDirectory ? join(traceDirectory, 'connection.log') : undefined;
  const args = [...(traceFile ? ['-vv', '-E', traceFile] : []), ...sshArgs(request, files)];
  try {
    if (process.platform === 'win32') {
      const { code, stdout, stderr } = await runWindowsSshProcess(executable, args, {
        timeout: 25_000, maxBuffer: 256 * 1024, signal,
      });
      if (code !== 0) throw await diagnosticFailure(code, stdout, stderr, request, files, traceFile, signal);
      return redactLogs(stdout + (stderr ? `\nSSH notices:\n${stderr}` : '')).trim();
    }
    return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end();
    const limit = 256 * 1024;
    let size = 0;
    let output = '';
    let errors = '';
    let stoppedReason = '';
    const stop = (reason: string) => {
      stoppedReason = reason;
      child.kill();
    };
    const timer = setTimeout(() => stop('SSH diagnostic timed out after 25 seconds.'), 25_000);
    const abort = () => stop('Diagnostic request cancelled.');
    signal?.addEventListener('abort', abort, { once: true });
    const cleanUp = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { stop('Diagnostic output exceeded 256 KB. Request fewer log lines.'); return; }
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { stop('Diagnostic output exceeded 256 KB. Request fewer log lines.'); return; }
      errors += chunk.toString('utf8');
    });
    child.once('error', error => {
      cleanUp();
      reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'Windows OpenSSH Client is not installed or cannot be found. Enable it in Windows Optional Features before connecting.'
        : sshFailure(error.message)));
    });
    child.once('close', code => {
      cleanUp();
      if (stoppedReason) { reject(new Error(stoppedReason)); return; }
      if (code === 0) {
        resolve(redactLogs(output + (errors ? `\nSSH notices:\n${errors}` : '')).trim());
        return;
      }
      void diagnosticFailure(code, output, errors, request, files, traceFile, signal).then(reject).catch(reject);
    });
    });
  } finally {
    if (traceDirectory) await rm(traceDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
