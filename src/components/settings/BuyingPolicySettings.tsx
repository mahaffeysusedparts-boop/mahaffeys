import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { storageService } from '@/services/storageService';
import type { BuyingPolicy } from '@/types/buyingPayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { policyDollarsToCents } from '@/utils/buyingPolicyForm';

type Grade = BuyingPolicy['grades'][number];
type GradeDraft = Omit<Grade, 'cashAtOrAboveCents' | 'sellerDayCashLimitCents' | 'paymentClass'> & {
  paymentClass: NonNullable<Grade['paymentClass']> | '';
  checkThreshold: string;
  dailyCashLimit: string;
  name: string;
  category: string;
};
type PolicyDraft = Omit<BuyingPolicy, 'grades' | 'version'> & { grades: GradeDraft[] };
const paymentClasses = [
  { value: 'FERROUS', label: 'Ferrous (iron / steel)' },
  { value: 'NONFERROUS', label: 'Nonferrous metals' },
  { value: 'ALUMINUM_CANS', label: 'Aluminum cans' },
  { value: 'COPPER', label: 'Copper' },
  { value: 'BEER_KEG', label: 'Beer kegs' },
  { value: 'REQUIRES_SPECIAL_DOCUMENTATION', label: 'Special documentation / blocked in routine intake' },
] as const;
const inputStyle = 'h-11 rounded-xl border-slate-600 bg-slate-950 text-white';

export function BuyingPolicySettings({ policy, loading, onSaved }: { policy?: BuyingPolicy | null; loading: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [validationError, setValidationError] = useState('');
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (value: BuyingPolicy) => scrapBuyingService.policy(value),
    onSuccess: () => {
      toast.success('Reviewed policy saved as a new version');
      setDraft(null); setConfirmed(false); setValidationError('');
      void queryClient.invalidateQueries({ queryKey: ['buying-payment-eligibility'] });
      onSaved();
    },
  });
  const load = () => {
    if (draft && !window.confirm('Discard unsaved changes and reload the saved policy?')) return;
    setDraft({
      sourceUrl: policy?.sourceUrl ?? 'https://www.scstatehouse.gov/code/t16c017.php',
      effectiveFrom: policy?.effectiveFrom ?? '',
      effectiveThrough: policy?.effectiveThrough ?? '',
      reviewer: policy?.reviewer ?? '',
      reviewReference: policy?.reviewReference ?? '',
      grades: storageService.getMetals().map(metal => {
        const saved = policy?.grades.find(grade => grade.gradeId === metal.id);
        return {
          gradeId: metal.id, name: metal.name, category: metal.category,
          classification: saved?.classification ?? 'UNREVIEWED',
          approved: saved?.approved ?? false,
          requirePermit: saved?.requirePermit ?? true,
          paymentClass: saved?.paymentClass ?? '',
          checkThreshold: saved?.cashAtOrAboveCents == null ? '' : (saved.cashAtOrAboveCents / 100).toFixed(2),
          dailyCashLimit: saved?.sellerDayCashLimitCents == null ? '' : (saved.sellerDayCashLimitCents / 100).toFixed(2),
        };
      }),
    });
    setConfirmed(false); setValidationError(''); save.reset();
  };
  const update = (change: Partial<PolicyDraft>) => {
    if (!draft) return;
    setDraft({ ...draft, ...change }); setConfirmed(false); setValidationError(''); save.reset();
  };
  const updateGrade = (id: string, change: Partial<GradeDraft>) => {
    if (draft) update({ grades: draft.grades.map(grade => grade.gradeId === id ? { ...grade, ...change } : grade) });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !confirmed || save.isPending) return;
    try {
      if (draft.effectiveFrom > draft.effectiveThrough) throw new Error('End date must be on or after the start date.');
      if (!draft.sourceUrl.startsWith('https://')) throw new Error('Enter a source link that starts with https://.');
      if (!draft.grades.length) throw new Error('Add material grades before setting up the buying policy.');
      const grades = draft.grades.map(grade => {
        if (!grade.paymentClass) throw new Error(`Choose a payment category for ${grade.name}.`);
        if (!grade.classification.trim()) throw new Error(`Enter a classification / review note for ${grade.name}.`);
        if (grade.paymentClass === 'FERROUS' && grade.category !== 'Ferrous') throw new Error(`${grade.name} is not a ferrous grade. Choose its correct payment category.`);
        return {
          gradeId: grade.gradeId, classification: grade.classification.trim(), approved: grade.approved,
          requirePermit: grade.requirePermit, paymentClass: grade.paymentClass,
          cashAtOrAboveCents: policyDollarsToCents(grade.checkThreshold),
          sellerDayCashLimitCents: policyDollarsToCents(grade.dailyCashLimit),
        };
      });
      save.mutate({ sourceUrl: draft.sourceUrl.trim(), effectiveFrom: draft.effectiveFrom, effectiveThrough: draft.effectiveThrough, reviewer: draft.reviewer.trim(), reviewReference: draft.reviewReference.trim(), grades });
    } catch (error) { setValidationError(error instanceof Error ? error.message : 'Check the entered values.'); }
  };

  return <details className="rounded-2xl border border-emerald-800 bg-slate-950 p-4 sm:p-5">
    <summary className="cursor-pointer text-base font-bold text-emerald-200"><Settings2 className="mr-2 inline h-5 w-5"/>Buying policy settings · administrator</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm leading-relaxed text-slate-200">Choose material categories, turn requirements on or off, and enter payment limits in dollars. No code needed. Saving creates a new reviewed policy version; it does not approve individual tickets.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div><p className="font-semibold text-white">{policy ? 'Saved policy available' : 'No policy saved yet'}</p>{policy && <p className="mt-1 text-xs text-slate-200">{policy.effectiveFrom} through {policy.effectiveThrough} · Reviewed by {policy.reviewer}</p>}</div>
        <Button type="button" onClick={load} disabled={loading || save.isPending} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600">{loading ? 'Loading policy…' : draft ? 'Reload saved values' : policy ? 'Edit saved policy' : 'Set up policy'}</Button>
      </div>
      <p className="flex gap-2 rounded-xl border border-amber-800 bg-amber-950 p-3 text-xs leading-relaxed text-amber-100"><ShieldCheck className="h-5 w-5 shrink-0"/>Use settings verified by your compliance reviewer, local authority or counsel. Legal payment and record requirements still apply, even when a switch is off or a limit is blank. Unknown or prohibited materials must stay unapproved.</p>
      {draft && <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={save.isPending} className="space-y-5">
          <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="font-bold text-emerald-200">1. Source & review details</h3>
            <div className="space-y-2"><Label htmlFor="policy-source">Official source link</Label><Input id="policy-source" type="url" required maxLength={2000} value={draft.sourceUrl} onChange={event => update({sourceUrl:event.target.value})} placeholder="https://…" className={inputStyle}/></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="policy-start">Effective start date</Label><Input id="policy-start" type="date" required value={draft.effectiveFrom} onChange={event => update({effectiveFrom:event.target.value})} className={`${inputStyle} [color-scheme:dark]`}/></div>
              <div className="space-y-2"><Label htmlFor="policy-end">Effective end date</Label><Input id="policy-end" type="date" required min={draft.effectiveFrom || undefined} value={draft.effectiveThrough} onChange={event => update({effectiveThrough:event.target.value})} className={`${inputStyle} [color-scheme:dark]`}/></div>
              <div className="space-y-2"><Label htmlFor="policy-reviewer">Reviewer’s name</Label><Input id="policy-reviewer" required maxLength={200} value={draft.reviewer} onChange={event => update({reviewer:event.target.value})} placeholder="Who verified these requirements?" className={inputStyle}/></div>
              <div className="space-y-2"><Label htmlFor="policy-review-reference">Review reference</Label><Input id="policy-review-reference" required maxLength={500} value={draft.reviewReference} onChange={event => update({reviewReference:event.target.value})} placeholder="Document, approval letter or review record" className={inputStyle}/></div>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="font-bold text-emerald-200">2. Material rules</h3>
            <p className="text-xs text-slate-200">Each current yard grade is listed below. New grades start unapproved. Blank limits mean no additional configured limit—not a legal exemption. A $0 check threshold means always use Check.</p>
            {!draft.grades.length && <p role="alert" className="rounded-xl bg-amber-950 p-4 text-amber-100">No material grades are available. Add them before saving a policy.</p>}
            {draft.grades.map((grade,index) => {
              const prefix = `policy-grade-${index}`;
              const automaticPermit = !!grade.paymentClass && !['FERROUS','ALUMINUM_CANS','REQUIRES_SPECIAL_DOCUMENTATION'].includes(grade.paymentClass);
              return <article key={grade.gradeId} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-bold text-white">{grade.name}</h4><p className="text-xs text-slate-200">{grade.category}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${grade.approved ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200'}`}>{grade.approved ? 'Approved classification' : 'Not approved'}</span></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor={`${prefix}-class`}>Payment category</Label><Select value={grade.paymentClass} onValueChange={value => updateGrade(grade.gradeId,{paymentClass:value as GradeDraft['paymentClass']})} disabled={save.isPending}><SelectTrigger id={`${prefix}-class`} className={`${inputStyle} h-auto min-h-11 text-left [&>span]:whitespace-normal`}><SelectValue placeholder="Choose a category"/></SelectTrigger><SelectContent className="rounded-xl border-slate-600 bg-slate-900 text-white">{paymentClasses.map(option => <SelectItem key={option.value} value={option.value} className="rounded-lg focus:bg-emerald-900 focus:text-white">{option.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor={`${prefix}-note`}>Classification / review note</Label><Input id={`${prefix}-note`} required maxLength={200} value={grade.classification} onChange={event => updateGrade(grade.gradeId,{classification:event.target.value})} placeholder="Reviewer’s material classification" className={inputStyle}/></div>
                  <div className="space-y-2"><Label htmlFor={`${prefix}-threshold`}>Require Check at or above ($)</Label><Input id={`${prefix}-threshold`} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={grade.checkThreshold} onChange={event => updateGrade(grade.gradeId,{checkThreshold:event.target.value})} placeholder="No additional threshold" className={inputStyle}/></div>
                  <div className="space-y-2"><Label htmlFor={`${prefix}-daily`}>Maximum cash per seller / day ($)</Label><Input id={`${prefix}-daily`} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={grade.dailyCashLimit} onChange={event => updateGrade(grade.gradeId,{dailyCashLimit:event.target.value})} placeholder="No additional daily limit" className={inputStyle}/></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 p-3"><Label htmlFor={`${prefix}-approved`} className="text-sm">Approved for purchase classification</Label><Switch id={`${prefix}-approved`} checked={grade.approved} disabled={save.isPending} onCheckedChange={approved => updateGrade(grade.gradeId,{approved})} className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-600"/></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 p-3"><Label htmlFor={`${prefix}-permit`} className="text-sm">Additional seller permit requirement</Label><Switch id={`${prefix}-permit`} checked={grade.requirePermit} disabled={save.isPending} onCheckedChange={requirePermit => updateGrade(grade.gradeId,{requirePermit})} className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-600"/></div>
                </div>
                {automaticPermit && <p className="text-xs text-amber-100">This category independently requires actual seller ID, a valid permit reference and retained documentation. Turning the additional permit switch off does not remove those obligations.</p>}
                {['COPPER','BEER_KEG'].includes(grade.paymentClass) && <p className="text-xs text-amber-100">Copper / beer-keg rules automatically require Check at $25 or more and restrict same-seller cash purchases to one per day. Stricter limits still apply.</p>}
                {grade.paymentClass === 'REQUIRES_SPECIAL_DOCUMENTATION' && <p className="text-xs text-amber-100">This category remains blocked in routine intake, even if its classification is approved. Catalytic converters, coils and prohibited/unknown materials must not be enabled through routine intake.</p>}
              </article>;
            })}
          </section>
          <div className="space-y-3 rounded-xl border border-emerald-800 bg-emerald-950 p-4">
            <h3 className="font-bold text-emerald-200">3. Confirm & save</h3>
            <div className="flex items-start gap-3"><Checkbox id="policy-confirmed" checked={confirmed} disabled={save.isPending} onCheckedChange={value => setConfirmed(value === true)} className="mt-0.5 border-emerald-300 data-[state=checked]:bg-emerald-600"/><Label htmlFor="policy-confirmed" className="text-sm leading-relaxed text-emerald-100">I have the named reviewer’s confirmation and have recorded the source, dates and review reference. These entries are not automatic legal certification.</Label></div>
            {(validationError || save.isError) && <p role="alert" className="text-sm text-amber-200">{validationError || save.error?.message}</p>}
            <Button type="submit" disabled={!confirmed || !draft.grades.length || save.isPending} className="h-12 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500"><Save className="mr-2 h-4 w-4"/>{save.isPending ? 'Saving policy…' : 'Save reviewed policy'}</Button>
            <p className="text-xs text-emerald-100">Changes apply to future eligibility checks. Existing paid tickets and original payment records are not changed.</p>
          </div>
        </fieldset>
      </form>}
    </div>
  </details>;
}
