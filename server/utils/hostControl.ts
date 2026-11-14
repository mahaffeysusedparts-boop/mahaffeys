import { request } from 'node:http';
import { createError } from 'nitro/h3';
import { validateControlRequest } from '../tools/hostControlProtocol.mjs';

const socketPath = '/run/mahaffeys-control/control.sock';
export const hostControlEnabled = () => process.env.NODE_ENV === 'production' && process.env.NITRO_HOST_CONTROL_ENABLED === 'true';

export async function callHostControl(value: unknown): Promise<Record<string, unknown>> {
  try { validateControlRequest(value); }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid host-control action or confirmation' }); }
  if (!hostControlEnabled()) throw createError({ statusCode: 503, statusMessage: 'Host connector is not enabled. Administrator installation is required; local previews cannot control the live server.' });
  return new Promise((resolve, reject) => {
    const fail = () => reject(createError({ statusCode: 503, statusMessage: 'Host connector unavailable. Check its installation and Unix socket; no unrestricted fallback was attempted.' }));
    const req = request({ socketPath, path: '/control', method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 256 * 1024) { response.destroy(); req.destroy(); fail(); return; }
        chunks.push(chunk);
      });
      response.on('error', fail);
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
          if (response.statusCode !== 200) {
            reject(createError({ statusCode: response.statusCode === 429 ? 429 : 409, statusMessage: 'Host action refused or failed. Review job status and the installed management policy.' }));
            return;
          }
          resolve(body);
        } catch { fail(); }
      });
    });
    req.setTimeout(30_000, () => { req.destroy(); fail(); });
    req.on('error', fail);
    req.end(JSON.stringify(value));
  });
}

const windows = new Map<string, { reads: number; writes: number; until: number }>();
export function limitHostControl(userId: string, write: boolean) {
  const now = Date.now();
  for (const [id, window] of windows) if (window.until <= now) windows.delete(id);
  const window = windows.get(userId) || { reads: 0, writes: 0, until: now + 60_000 };
  if (write ? window.writes >= 4 : window.reads >= 30) throw createError({ statusCode: 429, statusMessage: 'Too many server-control requests. Wait a minute before retrying.' });
  if (write) window.writes += 1;
  else window.reads += 1;
  windows.set(userId, window);
}
