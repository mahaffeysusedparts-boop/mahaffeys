import { spawn } from 'node:child_process';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Regular file handles avoid Windows OpenSSH's dependence on Node pipe handles.
export async function runWindowsSshProcess(
  executable: string,
  args: string[],
  options: { timeout: number; maxBuffer: number; signal?: AbortSignal },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  if (options.signal?.aborted) throw new Error('Diagnostic request cancelled.');
  const directory = await mkdtemp(join(tmpdir(), 'mahaffeys-ssh-io-'));
  const handles: Awaited<ReturnType<typeof open>>[] = [];
  try {
    for (const name of ['stdin', 'stdout', 'stderr']) {
      handles.push(await open(join(directory, name), 'w+'));
    }
    const [input, output, errors] = handles;
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(executable, args, {
        shell: false,
        windowsHide: true,
        stdio: [input.fd, output.fd, errors.fd],
      });
      let stoppedReason = '';
      const stop = (reason: string) => {
        if (stoppedReason) return;
        stoppedReason = reason;
        child.kill();
      };
      const timer = setTimeout(() => stop('SSH diagnostic timed out.'), options.timeout);
      let checking = false;
      const monitor = setInterval(() => {
        if (checking) return;
        checking = true;
        void Promise.all([output.stat(), errors.stat()]).then(([out, err]) => {
          if (out.size + err.size > options.maxBuffer) stop('Diagnostic output exceeded its configured limit. Request fewer log lines.');
        }).catch(() => stop('Cannot monitor local SSH output files.')).finally(() => { checking = false; });
      }, 100);
      const abort = () => stop('Diagnostic request cancelled.');
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      const cleanUp = () => {
        clearTimeout(timer);
        clearInterval(monitor);
        options.signal?.removeEventListener('abort', abort);
      };
      child.once('error', error => {
        cleanUp();
        reject(error);
      });
      child.once('close', (exitCode, signal) => {
        cleanUp();
        if (stoppedReason) reject(new Error(stoppedReason));
        else if (signal) reject(new Error(`SSH process terminated by ${signal}.`));
        else resolve(exitCode);
      });
    });
    const [outStat, errStat] = await Promise.all([output.stat(), errors.stat()]);
    if (outStat.size + errStat.size > options.maxBuffer) {
      throw new Error('Diagnostic output exceeded its configured limit. Request fewer log lines.');
    }
    const outBuffer = Buffer.alloc(outStat.size);
    const errBuffer = Buffer.alloc(errStat.size);
    const [outRead, errRead] = await Promise.all([
      output.read(outBuffer, 0, outBuffer.length, 0),
      errors.read(errBuffer, 0, errBuffer.length, 0),
    ]);
    return {
      code,
      stdout: outBuffer.subarray(0, outRead.bytesRead).toString('utf8'),
      stderr: errBuffer.subarray(0, errRead.bytesRead).toString('utf8'),
    };
  } finally {
    await Promise.all(handles.map(handle => handle.close().catch(() => undefined)));
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
