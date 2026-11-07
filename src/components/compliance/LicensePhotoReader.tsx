import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PencilLine, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analyzeDriverLicenseImage } from '@/services/aiVisionService';
import type { DLScanResult } from '@/utils/complianceUtils';
import type { LicenseReadResult } from '@/utils/licenseOcr';

export type IdReadStatus = LicenseReadResult['status'] | 'REVIEWED' | 'MANUAL';
interface Props {
  imageUrl: string;
  initialFields?: Partial<DLScanResult>;
  onApply: (fields: DLScanResult) => void;
  onStatus: (status: IdReadStatus, warning: string) => void;
}

export function LicensePhotoReader(props: Props) {
  const callbacks = useRef(props); callbacks.current = props;
  const request = useRef(0);
  const prefix = useId();
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState(true);
  const [result, setResult] = useState<LicenseReadResult | null>(null);
  const [edited, setEdited] = useState(false);
  const [applied, setApplied] = useState(false);
  const [fields, setFields] = useState<DLScanResult>({ fullName: '', idNumber: '', idState: '', idType: 'Driver License', address: '' });

  useEffect(() => {
    const version = ++request.current;
    const initial = callbacks.current.initialFields;
    setFields({ fullName: initial?.fullName || '', idNumber: initial?.idNumber || '', idState: initial?.idState || '', idType: initial?.idType || 'Driver License', address: initial?.address || '' });
    setReading(true); setEdited(false); setApplied(false); setResult(null);
    callbacks.current.onStatus('PARTIAL', 'ID reading is not complete — manually verify the ID details before saving.');
    void analyzeDriverLicenseImage(props.imageUrl).then(value => {
      if (request.current !== version) return;
      setResult(value); setReading(false);
      setFields(current => ({ ...current, fullName: value.fullName || current.fullName, idNumber: value.idNumber || current.idNumber, idState: value.idState || current.idState, address: value.address || current.address, dob: value.dob, expDate: value.expDate }));
      callbacks.current.onStatus(value.status, value.status === 'UNREADABLE'
        ? 'ID photo could not be read — manual entry required.'
        : value.status === 'PARTIAL' ? `ID photo needs manual review: ${value.missingFields.join(', ')} could not be read.` : 'Review extracted ID details against the photo.');
    });
    return () => { request.current++; };
  }, [props.imageUrl, retry]);

  const manual = () => {
    request.current++; setReading(false); setEdited(true); setResult(null);
    callbacks.current.onStatus('UNREADABLE', 'Automatic ID reading was not completed — manual entry required.');
  };
  const apply = () => {
    callbacks.current.onApply(fields);
    const missing = [['fullName', 'Full name'], ['idNumber', 'ID number'], ['idState', 'Issuing state'], ['address', 'Address']] as const;
    const missingLabels = missing.filter(([key]) => !fields[key].trim()).map(([, label]) => label);
    const manualEntry = edited || result?.status !== 'READ';
    callbacks.current.onStatus(manualEntry ? 'MANUAL' : 'REVIEWED', missingLabels.length
      ? `ID details still need manual entry: ${missingLabels.join(', ')}.`
      : manualEntry ? 'ID details were entered or corrected manually; verify them against the photo.' : '');
    setApplied(true);
  };
  const inputs = [['fullName', 'ID full name'], ['idNumber', 'ID number from photo'], ['idState', 'ID issuing state'], ['address', 'ID address']] as const;

  return <section data-testid="license-photo-reader" className="space-y-3 rounded-2xl border border-sky-700 bg-slate-900 p-4 text-slate-100">
    <h3 className="flex items-center gap-2 text-sm font-bold text-sky-100"><PencilLine className="h-4 w-4"/>Review extracted ID details</h3>
    {reading ? <div role="status" className="space-y-2 text-xs text-sky-100"><p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Reading the license photo…</p><Button type="button" variant="outline" onClick={manual} className="rounded-xl border-sky-700 bg-sky-950 text-sky-100">Enter manually instead</Button></div>
      : result?.status === 'READ' ? <p role="status" className="flex items-center gap-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4"/>ID data extracted. Check every field before using it.</p>
      : <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-3 text-xs text-amber-100"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4"/>{result?.status === 'PARTIAL' ? 'Some ID fields could not be read — manual review required.' : 'ID photo could not be read — manual entry required.'}</p>{result?.missingFields.length ? <p className="mt-1">Not read: {result.missingFields.join(', ')}.</p> : null}<p className="mt-1">The photo is retained. Enter or correct the details below, or continue using the intake form.</p></div>}
    <fieldset disabled={reading} className="grid gap-3 sm:grid-cols-2">{inputs.map(([key, label]) => <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}><Label htmlFor={`${prefix}-${key}`} className="text-xs text-slate-100">{label}</Label><Input id={`${prefix}-${key}`} value={fields[key]} maxLength={key === 'address' ? 300 : key === 'fullName' ? 160 : key === 'idState' ? 40 : 120} onChange={event => { setFields(current => ({ ...current, [key]: event.target.value })); setEdited(true); setApplied(false); }} className="mt-1 h-11 rounded-xl border-slate-700 bg-slate-950 text-white"/></div>)}</fieldset>
    {!reading && <div className="flex flex-wrap items-center gap-2"><Button type="button" onClick={apply} className="rounded-xl bg-sky-700 text-white hover:bg-sky-600">Use these ID details</Button><Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)} className="rounded-xl border-slate-600 bg-slate-800 text-white"><RefreshCw className="mr-2 h-4 w-4"/>Retry ID reading</Button>{applied && <span role="status" className="text-xs text-emerald-200">ID details transferred to the intake form.</span>}</div>}
    <p className="text-xs text-slate-300">Reading runs in this browser. No license photo is sent to an AI service. OCR may need an internet connection to download its language files.</p>
  </section>;
}
