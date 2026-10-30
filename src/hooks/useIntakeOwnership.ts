import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intakeClientId, intakeOwnershipService, type IntakeOwner } from '@/services/intakeOwnershipService';

export function useIntakeOwnership(ticketId: string | null, select: (id: string | null) => void) {
  const owners = useQuery({ queryKey: ['intake-owners'], queryFn: intakeOwnershipService.list, refetchInterval: 5000, retry: false });
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ ticketId: string; owner: IntakeOwner } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [claimVersion, setClaimVersion] = useState(0);
  const selecting = useRef(false);
  const owned = claimedId === ticketId && !!ticketId && !owners.isError && !error;

  useEffect(() => {
    if (!ticketId) { setClaimedId(null); return; }
    let active = true;
    setClaimedId(null); setError('');
    const renew = async (action: 'CLAIM' | 'RENEW') => {
      try {
        const result = await intakeOwnershipService.update(ticketId, action);
        if (!active) return;
        if (result.claimed) { setClaimedId(ticketId); setError(''); }
        else {
          setClaimedId(null);
          setError(result.owner ? `${result.owner.operatorName} is handling this intake on another workstation.` : 'Ownership expired. Return to the queue and claim this intake again.');
          if (result.owner && action === 'CLAIM') setConflict({ ticketId, owner: result.owner });
        }
        void owners.refetch();
      } catch (failure) {
        if (active) { setClaimedId(null); setError(failure instanceof Error ? failure.message : 'Ownership could not be verified.'); }
      }
    };
    void renew('CLAIM');
    const timer = window.setInterval(() => void renew('RENEW'), 20000);
    return () => {
      active = false; window.clearInterval(timer);
      void intakeOwnershipService.update(ticketId, 'RELEASE').catch(() => {});
    };
    // Ownership is scoped to the active desk, not to polling renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId || !owners.data) return;
    const owner = owners.data.find(row => row.ticketId === ticketId);
    if (owner && owner.clientId !== intakeClientId) {
      setClaimedId(null);
      setError(`${owner.operatorName} took over this intake. Your unsaved inputs are preserved; editing is blocked.`);
    }
  }, [ticketId, owners.data]);

  const claim = async (id: string, replaceClientId?: string) => {
    if (selecting.current) return;
    selecting.current = true; setBusy(true); setError('');
    try {
      const result = await intakeOwnershipService.update(id, 'CLAIM', replaceClientId);
      if (!result.claimed && result.owner) { setConflict({ ticketId: id, owner: result.owner }); return; }
      if (result.claimed) {
        setConflict(null); setClaimedId(id);
        setClaimVersion(version => version + 1);
        select(id);
        void owners.refetch();
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to claim intake.'); }
    finally { selecting.current = false; setBusy(false); }
  };
  return { owners: owners.data ?? [], owned, conflict, error: error || (owners.isError ? 'Shared ownership is unavailable. Editing is paused until it can be verified.' : ''), busy, claimVersion,
    claim, cancel: () => setConflict(null), confirm: () => conflict && claim(conflict.ticketId, conflict.owner.clientId), clientId: intakeClientId };
}
