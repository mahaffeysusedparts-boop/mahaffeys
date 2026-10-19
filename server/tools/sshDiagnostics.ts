import { spawn } from 'node:child_process';
import { access, mkdtemp, open, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

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

export async function runDiagnostic(request: DiagnosticRequest, files: SshFiles, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new Error('Diagnostic request cancelled.');
  await checkSshFiles(files);
  if (signal?.aborted) throw new Error('Diagnostic request cancelled.');
  const executable = process.platform === 'win32'
    ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', 'ssh.exe')
    : 'ssh';
  // A file-based trace also captures Windows OpenSSH errors when stderr is empty.
  const traceDirectory = request.operation === 'connection' ? await mkdtemp(join(tmpdir(), 'mahaffeys-ssh-')) : undefined;
  const traceFile = traceDirectory ? join(traceDirectory, 'connection.log') : undefined;
  const args = [...(traceFile ? ['-vv', '-E', traceFile] : []), ...sshArgs(request, files)];
  try {
    return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
      void (async () => {
        const trace = traceFile ? await readSshTrace(traceFile) : '';
        const detail = [errors.trim(), output.trim(), trace].filter(Boolean).join('\n');
        const explanation = sshFailure(detail);
        const message = detail
          ? `SSH exited with code ${code}.\n${explanation}${trace && explanation !== detail ? `\nOpenSSH trace:\n${trace}` : ''}`
          : `SSH exited with code ${code} without an error message${traceFile ? ' or a readable OpenSSH trace' : ''}. Private-key and known_hosts files were found. Confirm that the new key was loaded into the Windows OpenSSH agent; an agent running without the key is not enough.`;
        reject(new Error(message));
      })().catch(reject);
    });
    });
  } finally {
    if (traceDirectory) await rm(traceDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
