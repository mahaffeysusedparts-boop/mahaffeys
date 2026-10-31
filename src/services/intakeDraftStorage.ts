const pending = new Map<string, Promise<unknown>>();
async function access<T>(key: string, action: 'read' | 'write' | 'delete', value?: T): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mahaffeys-intake-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = action === 'read' ? store.get(key) : action === 'write' ? store.put(value, key) : store.delete(key);
      transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export function intakeDraftAccess<T>(key: string, action: 'read' | 'write' | 'delete', value?: T): Promise<T | undefined> {
  const operation = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => access(key, action, value));
  pending.set(key, operation);
  const cleanup = () => { if (pending.get(key) === operation) pending.delete(key); };
  operation.then(cleanup, cleanup);
  return operation;
}
export interface IntakeDraftEnvelope { version: 1; values: Record<string, unknown>; savedAt: string }
export function migrateIntakeDraft(value: unknown): IntakeDraftEnvelope {
  if (!value || typeof value !== 'object') throw new Error('Invalid draft');
  const draft = value as IntakeDraftEnvelope;
  if ((draft.version !== undefined && draft.version !== 1) || !draft.values || typeof draft.values !== 'object' || Array.isArray(draft.values) || !Number.isFinite(Date.parse(draft.savedAt))) throw new Error('Invalid draft');
  return { version: 1, values: draft.values, savedAt: draft.savedAt };
}
