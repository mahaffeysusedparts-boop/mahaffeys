import { apiRequest, ApiError } from './apiClient';
import { authService } from './authService';
import { intakeClientId } from './intakeOwnershipService';
import { intakeDraftAccess } from './intakeDraftStorage';
import type { Ticket } from '@/types/scrap';

export interface IntakeOperation {
  version: 1; operationId: string; scope: string; state: 'UNCERTAIN' | 'CONFIRMED';
  payload: Record<string, unknown>; result?: Ticket;
}
const serial = new Map<string, Promise<unknown>>();
function journalKey() {
  const user = authService.getCurrentUser();
  if (!user) throw new Error('Sign in before submitting an intake');
  return `operations:${user.id}`;
}
async function readJournal(key: string) {
  const rows = await intakeDraftAccess<IntakeOperation[]>(key, 'read') ?? [];
  if (!Array.isArray(rows) || rows.some(row => row.version !== 1 || !row.operationId || !row.scope || !row.payload || !['UNCERTAIN','CONFIRMED'].includes(row.state))) throw new Error('Submission recovery is unreadable. Keep this page open and review the ticket before submitting.');
  return rows;
}
function ordered<T>(key: string, run: () => Promise<T>): Promise<T> {
  const task = (serial.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
  serial.set(key, task);
  const cleanup = () => { if (serial.get(key) === task) serial.delete(key); };
  task.then(cleanup, cleanup);
  return task;
}
export function commandScope(body: Record<string, unknown>) { return body.action === 'CREATE' ? 'CREATE' : String(body.id); }
export async function pendingIntakeOperation(scope: string) {
  const key = journalKey();
  return ordered(key, async () => (await readJournal(key)).find(row => row.scope === scope) ?? null);
}
export async function pendingIntakeOperations() {
  const key = journalKey();
  return ordered(key, () => readJournal(key));
}
async function send(key: string, rows: IntakeOperation[], operation: IntakeOperation): Promise<Ticket> {
  if (operation.state === 'CONFIRMED' && operation.result) return operation.result;
  try {
    const result = await apiRequest<Ticket>('/api/scrap-buying/commands', { method: 'POST', body: JSON.stringify(operation.payload) });
    operation.state = 'CONFIRMED'; operation.result = result;
    // A durable acknowledgment survives failed cleanup and never resends a payment.
    await intakeDraftAccess(key, 'write', rows);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      await intakeDraftAccess(key, 'write', rows.filter(row => row.operationId !== operation.operationId));
    }
    throw error;
  }
}
export async function acknowledgeIntakeOperation(scope: string) {
  const key = journalKey();
  return ordered(key, async () => {
    const rows = await readJournal(key);
    await intakeDraftAccess(key, 'write', rows.filter(row => row.scope !== scope || row.state !== 'CONFIRMED'));
  });
}
export function retryIntakeOperation(scope: string): Promise<Ticket> {
  const key = journalKey();
  return ordered(key, async () => {
    const rows = await readJournal(key);
    const operation = rows.find(row => row.scope === scope);
    if (!operation) throw new Error('No interrupted submission to reconcile');
    return send(key, rows, operation);
  });
}
export function submitIntakeCommand(body: Record<string, unknown>): Promise<Ticket> {
  const key = journalKey();
  return ordered(key, async () => {
    const rows = await readJournal(key);
    const scope = commandScope(body);
    const existing = rows.find(row => row.scope === scope);
    if (existing) {
      const { clientId: _client, idempotencyKey: _key, ...prepared } = existing.payload;
      if (JSON.stringify(prepared) !== JSON.stringify(body)) throw new Error('Reconcile the previous submission before changing inputs or submitting another operation.');
      return send(key, rows, existing);
    }
    const operation: IntakeOperation = { version: 1, operationId: crypto.randomUUID(), scope, state: 'UNCERTAIN',
      payload: JSON.parse(JSON.stringify({ ...body, clientId: intakeClientId, idempotencyKey: crypto.randomUUID() })) };
    rows.push(operation);
    // Fail closed: without persistence reload-safe retry cannot be promised.
    await intakeDraftAccess(key, 'write', rows);
    return send(key, rows, operation);
  });
}
