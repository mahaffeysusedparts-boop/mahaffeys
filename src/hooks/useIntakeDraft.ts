import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type Draft = { values: Record<string, unknown>; savedAt: string };
type Field = { value: unknown; restore: (value: any) => void };

function openDrafts(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mahaffeys-intake-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function performDraftAccess(key: string, action: 'read' | 'write' | 'delete', draft?: Draft): Promise<Draft | undefined> {
  const db = await openDrafts();
  try {
    return await new Promise<Draft | undefined>((resolve, reject) => {
      const transaction = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = action === 'read' ? store.get(key) : action === 'write' ? store.put(draft, key) : store.delete(key);
      transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
const pendingAccess = new Map<string, Promise<Draft | undefined>>();
function accessDraft(key: string, action: 'read' | 'write' | 'delete', draft?: Draft) {
  // Keep writes and deletion ordered so an older autosave cannot resurrect a submitted draft.
  const operation = (pendingAccess.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => performDraftAccess(key, action, draft));
  pendingAccess.set(key, operation);
  const cleanup = () => { if (pendingAccess.get(key) === operation) pendingAccess.delete(key); };
  operation.then(cleanup, cleanup);
  return operation;
}

export function useIntakeDraft(kind: string, fields: Record<string, Field>, meaningful: boolean, reloadToken?: number) {
  const { user } = useAuth();
  const key = user ? `${user.id}:${kind}` : '';
  const readyIdentity = `${key}:${reloadToken ?? 0}`;
  const current = useRef({ fields, meaningful });
  current.current = { fields, meaningful };
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [readyKey, setReadyKey] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [error, setError] = useState('');
  const suppressed = useRef(false);
  const lastSerialized = useRef('');
  const saveGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    saveGeneration.current++;
    suppressed.current = false;
    lastSerialized.current = '';
    setRecovery(null); setReadyKey(''); setSavedAt(''); setError('');
    if (!key) return;
    accessDraft(key, 'read').then(draft => {
      if (!active) return;
      if (draft) setRecovery(draft);
      setReadyKey(readyIdentity);
    }).catch(() => {
      if (active) { setError('Draft storage is unavailable. Keep this page open until you save.'); setReadyKey(readyIdentity); }
    });
    return () => { active = false; };
  }, [key, readyIdentity]);

  const serialized = JSON.stringify(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])));
  useEffect(() => {
    if (!meaningful) suppressed.current = false;
    if (!key || readyKey !== readyIdentity || recovery || suppressed.current) return;
    if (!meaningful) {
      if (lastSerialized.current) {
        lastSerialized.current = '';
        const generation = ++saveGeneration.current;
        accessDraft(key, 'delete').then(() => { if (saveGeneration.current === generation) setSavedAt(''); })
          .catch(() => { if (saveGeneration.current === generation) setError('Unable to clear the empty draft.'); });
      }
      return;
    }
    if (serialized === lastSerialized.current) return;
    // Start the durable write immediately, including the final edit before navigation.
    const draft = { values: JSON.parse(serialized), savedAt: new Date().toISOString() };
    const generation = saveGeneration.current;
    lastSerialized.current = serialized;
    accessDraft(key, 'write', draft).then(() => {
      if (saveGeneration.current === generation) { setSavedAt(draft.savedAt); setError(''); }
    }).catch(() => {
      if (saveGeneration.current !== generation) return;
      lastSerialized.current = '';
      setError('Draft could not be saved on this workstation. Do not close the form until the intake is saved.');
    });
  }, [key, readyIdentity, readyKey, recovery, meaningful, serialized]);

  const clear = async () => {
    suppressed.current = true;
    saveGeneration.current++;
    lastSerialized.current = '';
    setRecovery(null); setSavedAt('');
    if (key) await accessDraft(key, 'delete').catch(() => setError('Unable to remove the saved draft.'));
  };
  const resume = () => {
    if (!recovery) return;
    for (const [name, field] of Object.entries(current.current.fields)) {
      if (Object.prototype.hasOwnProperty.call(recovery.values, name)) field.restore(recovery.values[name]);
    }
    lastSerialized.current = JSON.stringify(recovery.values);
    setSavedAt(recovery.savedAt); setRecovery(null);
  };
  const discard = async () => {
    await clear();
    suppressed.current = false;
    lastSerialized.current = '';
  };
  return { recovery, savedAt, error, loading: !!key && readyKey !== readyIdentity, resume, discard, clear };
}
