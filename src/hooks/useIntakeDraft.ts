import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

import { intakeDraftAccess as accessDraft, migrateIntakeDraft, type IntakeDraftEnvelope as Draft } from '@/services/intakeDraftStorage';
type Field = { value: unknown; restore: (value: any) => void };

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
    accessDraft<Draft>(key, 'read').then(draft => {
      if (!active) return;
      if (draft) {
        try { setRecovery(migrateIntakeDraft(draft)); }
        catch { suppressed.current = true; setError('Stored draft is corrupt or unsupported. Discard it explicitly before entering replacement data.'); setRecovery({ version: 1, values: {}, savedAt: new Date().toISOString() }); }
      }
      setReadyKey(readyIdentity);
    }).catch(() => {
      if (active) { setError('Draft storage is unavailable. Keep this page open until you save.'); setReadyKey(readyIdentity); }
    });
    return () => { active = false; };
  }, [key, readyIdentity]);

  const serialized = JSON.stringify(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])));
  useEffect(() => {
    // Submission suppression lasts until explicit discard or a new identity.
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
    const draft: Draft = { version: 1, values: JSON.parse(serialized), savedAt: new Date().toISOString() };
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
    if (key) {
      try { await accessDraft(key, 'delete'); }
      catch { setError('Unable to remove the saved draft. Keep the confirmed submission for recovery.'); throw new Error('Intake confirmed, but local draft cleanup failed. Reconcile the confirmed submission before continuing.'); }
    }
    setRecovery(null); setSavedAt('');
  };
  const resume = () => {
    if (!recovery) return;
    const entries = Object.entries(current.current.fields).filter(([name]) => Object.prototype.hasOwnProperty.call(recovery.values, name));
    if (entries.some(([name, field]) => {
      const value = recovery.values[name];
      return field.value === null ? value !== null && (typeof value !== 'object' || Array.isArray(value))
        : typeof value !== typeof field.value || (typeof field.value === 'object' && (value === null || Array.isArray(value)));
    })) { setError('Draft fields are unreadable. Review or discard this draft; no recovered values were applied.'); return; }
    for (const [name, field] of entries) field.restore(recovery.values[name]);
    lastSerialized.current = JSON.stringify(recovery.values);
    setSavedAt(recovery.savedAt); setRecovery(null);
  };
  const discard = async () => {
    try { await clear(); } catch { return; }
    suppressed.current = false;
    lastSerialized.current = '';
  };
  const markEdited = () => { suppressed.current = false; };
  return { recovery, savedAt, error, markEdited, loading: !!key && readyKey !== readyIdentity, resume, discard, clear };
}
