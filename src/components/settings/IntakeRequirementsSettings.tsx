import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { intakeRequirementsService, useIntakeRequirements } from '@/services/intakeRequirementsService';
import type { IntakeRequirements } from '@/types/intakeRequirements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function IntakeRequirementsSettings() {
  const { isAdmin } = useAuth();
  const requirements = useIntakeRequirements();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<IntakeRequirements | null>(null);
  const [reason, setReason] = useState('');
  const current = draft ?? requirements.data;
  const stale = !!draft && draft.revision !== requirements.data?.revision;
  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error('Load requirements first');
      const { requirePhotos, requirePhone, requireAddress, requireSellerId, requireVehiclePlate, requireExplicitReview, revision } = current;
      return intakeRequirementsService.save({ requirePhotos, requirePhone, requireAddress, requireSellerId, requireVehiclePlate, requireExplicitReview }, revision, reason);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['intake-requirements'], saved);
      setDraft(null); setReason('');
      toast.success('Scrap intake requirements saved for all approved operators');
    },
  });
  const options = [
    { key: 'requirePhotos', label: 'Require intake photos', description: 'Seller, ID, vehicle, plate and load photos. Independent of the seller ID details requirement.' },
    { key: 'requirePhone', label: 'Require seller phone', description: 'Turn off to allow finalization without a phone number.' },
    { key: 'requireAddress', label: 'Require seller address', description: 'Turn off to allow finalization without a seller address.' },
    { key: 'requireSellerId', label: 'Require seller ID', description: 'Require actual ID details and issuing jurisdiction. Turning this off does not disable the independent photo requirement.' },
    { key: 'requireVehiclePlate', label: 'Require vehicle plate', description: 'Turn off to allow a blank plate. Supplied plate information is still retained.' },
    { key: 'requireExplicitReview', label: 'Require explicit review', description: 'Require a purchase-review acknowledgement before completion. When off, Complete & Record Payment records actual disbursement without a mandatory checkbox.' },
  ] as const;

  return <Card id="intake-requirements" className="rounded-2xl border-emerald-800 bg-slate-900 text-white">
    <CardHeader className="border-b border-emerald-900 pb-4">
      <CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-5 w-5 text-emerald-300" />Scrap intake requirements</CardTitle>
      <p className="text-sm text-slate-200">Administrators can make these yard requirements optional for all approved intake operators. Finalize opens the printable unpaid voucher immediately.</p>
    </CardHeader>
    <CardContent className="space-y-4 pt-4">
      {requirements.isPending && <p role="status" className="text-emerald-200">Loading current requirements…</p>}
      {requirements.isError && <p role="alert" className="text-amber-200">Requirements could not refresh. <button onClick={() => void requirements.refetch()} className="underline">Retry</button></p>}
      {current && options.map(({ key, label, description }) => <div key={key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <div><Label htmlFor={key} className="font-semibold text-white">{label}</Label><p className="mt-1 text-xs leading-relaxed text-slate-200">{description}</p><p className={`mt-2 text-xs font-bold ${current[key] ? 'text-emerald-200' : 'text-amber-200'}`}>{current[key] ? 'Required' : 'Optional — missing information is recorded, not fabricated'}</p></div>
        <Switch id={key} checked={current[key]} disabled={!isAdmin || save.isPending} onCheckedChange={(checked) => setDraft({ ...current, [key]: checked })} className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-600" />
      </div>)}
      <p className="flex gap-2 rounded-xl border border-amber-800 bg-amber-950 p-3 text-xs leading-relaxed text-amber-100"><ShieldCheck className="h-4 w-4 shrink-0" />These are independent yard preferences, not legal exemptions. Completed valid weights and applicable material/payment obligations remain enforced. Missing identity cannot establish same-seller cash history; identity-dependent cash rules may require Check. Every check requires its actual issued number. Car intake requirements are unchanged.</p>
      {isAdmin ? <>
        <Label htmlFor="intake-requirements-reason">Reason for changing requirements</Label>
        <Textarea id="intake-requirements-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={save.isPending} placeholder="Record why these yard requirements are being changed…" className="rounded-xl border-slate-600 bg-slate-950 text-white" />
        {stale && <p role="alert" className="text-sm text-amber-200">Another administrator changed these settings. Reload before saving your choices.</p>}
        {save.isError && <p role="alert" className="text-sm text-amber-200">{save.error.message}</p>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={!draft || !reason.trim() || stale || save.isPending || requirements.isError} onClick={() => save.mutate()} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">{save.isPending ? 'Saving…' : 'Save intake requirements'}</Button>
          <Button variant="outline" disabled={save.isPending} onClick={() => { if (!draft || window.confirm('Discard unsaved requirement choices and reload?')) { setDraft(null); setReason(''); void requirements.refetch(); } }} className="rounded-xl border-slate-600 bg-slate-800 text-white">Reload saved settings</Button>
        </div>
      </> : <p className="text-sm text-slate-200">Only an administrator can change these settings.</p>}
      {requirements.data?.updatedAt && <p className="text-xs text-slate-300">Revision {requirements.data.revision} · {requirements.data.updatedBy} · {new Date(requirements.data.updatedAt).toLocaleString()}<br />Reason: {requirements.data.reason}</p>}
    </CardContent>
  </Card>;
}
