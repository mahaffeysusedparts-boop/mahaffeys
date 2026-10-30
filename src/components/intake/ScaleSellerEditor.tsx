import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ComplianceCaptures, Customer, Ticket } from '@/types/scrap';
import type { IntakeRequirements } from '@/types/intakeRequirements';
import { customerService } from '@/services/customerService';
import { scrapBuyingService } from '@/services/scrapBuyingService';
import { useIntakeDraft } from '@/hooks/useIntakeDraft';
import { DraftRecoveryBanner } from './DraftRecoveryBanner';
import { IntakeFieldError, IntakeFieldGuidance, type IntakeIssue } from './IntakeFieldGuidance';
import { INTAKE_PHOTO_FIELDS } from '@/utils/intakeRequirements';
import { ComplianceCaptureModal } from '@/components/compliance/ComplianceCaptureModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Save } from 'lucide-react';

type SellerInput = Parameters<typeof scrapBuyingService.updateSeller>[1];
export function ScaleSellerEditor({ ticket, requirements, onSave, onDirtyChange }: {
  ticket: Ticket; requirements?: IntakeRequirements; onSave: (value: SellerInput) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void;
}) {
  const profile = useQuery({ queryKey: ['intake-seller', ticket.customerId], enabled: !!ticket.customerId,
    queryFn: () => customerService.get(ticket.customerId!), staleTime: 0 });
  const [phone, setPhone] = useState(ticket.customerPhone ?? '');
  const [address, setAddress] = useState(ticket.customerAddress ?? '');
  const [idNumber, setIdNumber] = useState(ticket.customerIdNumber ?? '');
  const [idState, setIdState] = useState('SC');
  const [idType, setIdType] = useState<Customer['idType']>('Driver License');
  const [plate, setPlate] = useState(ticket.vehicleLicensePlate ?? '');
  const [captures, setCaptures] = useState<ComplianceCaptures>(ticket.complianceCaptures ?? {});
  const [dirty, setDirty] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (dirty) return;
    setPhone(ticket.customerPhone ?? ''); setAddress(ticket.customerAddress || profile.data?.address || '');
    setIdNumber(ticket.customerIdNumber || profile.data?.idNumber || '');
    setIdState(profile.data?.idState ?? 'SC'); setIdType(profile.data?.idType ?? 'Driver License');
    setPlate(ticket.vehicleLicensePlate ?? ''); setCaptures(ticket.complianceCaptures ?? {});
  }, [ticket, profile.data, dirty]);
  const draft = useIntakeDraft(`scale-seller:${ticket.id}`, {
    phone: { value: phone, restore: value => { setPhone(value); setDirty(true); } },
    address: { value: address, restore: setAddress }, idNumber: { value: idNumber, restore: setIdNumber },
    idState: { value: idState, restore: setIdState }, idType: { value: idType, restore: setIdType },
    plate: { value: plate, restore: setPlate }, captures: { value: captures, restore: setCaptures },
  }, dirty);
  useEffect(() => { onDirtyChange(dirty || !!draft.recovery || draft.loading); }, [dirty, draft.recovery, draft.loading, onDirtyChange]);
  const issues: IntakeIssue[] = [
    ...(!phone.trim() && requirements?.requirePhone ? [{ target: 'scale-seller-phone', message: 'Seller phone is required.' }] : []),
    ...(!address.trim() && requirements?.requireAddress ? [{ target: 'scale-seller-address', message: 'Seller address is required.' }] : []),
    ...(!idNumber.trim() && requirements?.requireSellerId ? [{ target: 'scale-seller-id', message: 'Seller ID number is required.' }] : []),
    ...(!idState.trim() && (requirements?.requireSellerId || !!idNumber.trim()) ? [{ target: 'scale-seller-state', message: 'Confirm the ID issuing jurisdiction.' }] : []),
    ...(!plate.trim() && requirements?.requireVehiclePlate ? [{ target: 'scale-seller-plate', message: 'Today’s vehicle plate is required.' }] : []),
    ...(requirements?.requirePhotos && INTAKE_PHOTO_FIELDS.some(field => !captures[field]) ? [{ target: 'scale-seller-photos', message: 'Capture all missing intake photos.' }] : []),
  ];
  const message = (target: string) => issues.find(issue => issue.target === target)?.message;
  const save = async () => {
    if (saving || draft.recovery || draft.loading) return;
    if (idNumber.trim() && !idState.trim()) { setError('Confirm the ID issuing jurisdiction beside the ID field.'); return; }
    setSaving(true); setError('');
    try {
      if (await onSave({ phone, address, idNumber, idState, idType, plate, captures })) {
        await draft.clear(); setDirty(false); void profile.refetch();
      } else setError('Seller changes were not saved. Resolve the ownership or save warning and retry.');
    } finally { setSaving(false); }
  };
  const fields = [
    { id: 'scale-seller-phone', label: 'Seller phone', value: phone, set: setPhone, max: 80 },
    { id: 'scale-seller-address', label: 'Seller address', value: address, set: setAddress, max: 500 },
    { id: 'scale-seller-id', label: 'Seller ID number', value: idNumber, set: setIdNumber, max: 120 },
    { id: 'scale-seller-state', label: 'ID issuing jurisdiction', value: idState, set: setIdState, max: 40 },
    { id: 'scale-seller-plate', label: 'Today’s vehicle plate', value: plate, set: setPlate, max: 80 },
  ];
  return <section id="scale-seller-editor" className="space-y-4 rounded-2xl border border-sky-800 bg-slate-900 p-4">
    <h3 className="font-bold text-sky-100">Seller details &amp; missing evidence</h3>
    <p className="text-xs text-slate-200">Correct missing requirements here without leaving the scale desk. Saving updates this ticket and its customer profile together.</p>
    <DraftRecoveryBanner draft={draft}/>
    <IntakeFieldGuidance issues={issues}/>
    {profile.isError && <p role="alert" className="text-xs text-amber-200">Could not load the customer profile. Retry before correcting ID details.<Button variant="link" onClick={() => void profile.refetch()} className="text-amber-100">Retry</Button></p>}
    <fieldset disabled={saving || draft.loading || !!draft.recovery || profile.isLoading || profile.isError} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(field => <div key={field.id}><Label htmlFor={field.id} className="text-xs text-slate-100">{field.label}</Label><Input id={field.id} maxLength={field.max} value={field.value} onChange={event => { field.set(event.target.value); setDirty(true); }} aria-invalid={!!message(field.id)} className="mt-1 h-11 rounded-xl border-slate-700 bg-slate-950 text-white"/><IntakeFieldError message={message(field.id)}/></div>)}<div><Label className="text-xs text-slate-100">ID type</Label><Select value={idType} onValueChange={value => { setIdType(value as Customer['idType']); setDirty(true); }}><SelectTrigger className="mt-1 h-11 rounded-xl border-slate-700 bg-slate-950"><SelectValue/></SelectTrigger><SelectContent>{(['Driver License','State ID','Passport','Military ID'] as const).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div></div>
      <div id="scale-seller-photos" className="space-y-2"><Button onClick={() => setPhotosOpen(true)} variant="outline" className="rounded-xl border-sky-700 bg-sky-950 text-sky-100"><Camera className="mr-2 h-4 w-4"/>Capture missing photos</Button><IntakeFieldError message={message('scale-seller-photos')}/><div className="flex flex-wrap gap-2">{INTAKE_PHOTO_FIELDS.map(field => captures[field] && <img key={field} src={captures[field]} alt={field.replace('PhotoUrl','')} className="h-16 w-20 rounded-lg object-cover"/>)}</div></div>
      <Button disabled={!dirty || saving} onClick={() => void save()} className="rounded-xl bg-sky-700 text-white hover:bg-sky-600"><Save className="mr-2 h-4 w-4"/>{saving ? 'Saving seller details…' : 'Save seller corrections'}</Button>
    </fieldset>
    {dirty && <p className="text-xs text-amber-200">Unsaved seller corrections: save them before completing payment.</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    <ComplianceCaptureModal isOpen={photosOpen} onClose={() => setPhotosOpen(false)} initialCaptures={captures} intakeType="SCRAP_METAL" onSaveCaptures={value => { setCaptures(value); setDirty(true); }}/>
  </section>;
}
