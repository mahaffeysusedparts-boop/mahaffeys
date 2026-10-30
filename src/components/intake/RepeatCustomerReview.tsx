import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Customer } from '@/types/scrap';
import { apiRequest } from '@/services/apiClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Car, History, Package } from 'lucide-react';

export interface CustomerHistory {
  previousTicket: { id: string; createdAt: string; status: string; vehicleLicensePlate?: string } | null;
  lastVehicle: { year: number; make: string; model: string; vin: string } | null;
  commonMaterials: { name: string; visits: number }[];
  historyCount: number;
}
export function RepeatCustomerReview({ customer, onCancel, onConfirm, suggestMaterials = false, currentPlate }: {
  customer: Customer | null;
  onCancel: () => void;
  onConfirm: (customer: Customer, plate: string, materials: string[]) => void;
  suggestMaterials?: boolean;
  currentPlate?: string;
}) {
  const [reusePlate, setReusePlate] = useState(false);
  const [reuseMaterials, setReuseMaterials] = useState(false);
  useEffect(() => { setReusePlate(false); setReuseMaterials(false); }, [customer?.id]);
  const history = useQuery({ queryKey: ['customer-intake-history', customer?.id], enabled: !!customer,
    queryFn: () => apiRequest<CustomerHistory>(`/api/customers/${encodeURIComponent(customer!.id)}/history`), staleTime: 0 });
  const plate = currentPlate || history.data?.previousTicket?.vehicleLicensePlate || customer?.vehicleLicensePlate || '';
  return <Dialog open={!!customer} onOpenChange={open => { if (!open) onCancel(); }}><DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-sky-700 bg-slate-900 text-slate-100"><DialogHeader><DialogTitle className="flex items-center gap-2 text-sky-100"><History className="h-5 w-5"/>Review returning seller</DialogTitle><DialogDescription className="text-slate-300">Confirm current details before reusing them. Existing form fields will be replaced.</DialogDescription></DialogHeader>
    {customer && <div className="space-y-4"><div className="rounded-xl bg-sky-950 p-4"><p className="font-bold">{customer.fullName}</p><p className="mt-1 text-sm">{customer.phone || 'No phone on file'} · {customer.address || 'No address on file'}</p><p className="mt-1 text-xs">ID jurisdiction: {customer.idState || 'Not supplied'} · {customer.idPhotoUrl ? 'Saved ID photo available' : 'No saved ID photo'}</p></div>
      {history.isLoading && <p role="status" className="text-sm text-sky-100">Loading previous visits…</p>}
      {history.isError && <div role="alert" className="rounded-xl bg-amber-950 p-3 text-sm text-amber-100">History is unavailable. You can still confirm the registered seller details.<Button variant="link" onClick={() => void history.refetch()} className="text-amber-100">Retry history</Button></div>}
      {history.data && <div className="space-y-3 text-sm"><div><p className="font-bold text-sky-200">Previous ticket</p><p>{history.data.previousTicket ? `#${history.data.previousTicket.id} · ${new Date(history.data.previousTicket.createdAt).toLocaleDateString()} · ${history.data.previousTicket.status}` : 'No previous tickets linked to this profile.'}</p></div><div><p className="flex items-center gap-2 font-bold text-sky-200"><Car className="h-4 w-4"/>Last purchased vehicle</p><p>{history.data.lastVehicle ? `${history.data.lastVehicle.year} ${history.data.lastVehicle.make} ${history.data.lastVehicle.model} · ${history.data.lastVehicle.vin}` : 'No purchased vehicle on file.'}</p></div><div><p className="flex items-center gap-2 font-bold text-sky-200"><Package className="h-4 w-4"/>Commonly sold materials</p><p>{history.data.commonMaterials.map(item => `${item.name} (${item.visits} visits)`).join(', ') || 'No weighed material history.'}</p></div></div>}
      {plate && <label className="flex items-start gap-2 rounded-xl border border-slate-700 p-3 text-sm"><input type="checkbox" checked={reusePlate} onChange={e => setReusePlate(e.target.checked)} className="mt-1 accent-sky-500"/>I confirmed that plate {plate} belongs to today's vehicle.</label>}
      {suggestMaterials && !!history.data?.commonMaterials.length && <label className="flex items-start gap-2 rounded-xl border border-slate-700 p-3 text-sm"><input type="checkbox" checked={reuseMaterials} onChange={e => setReuseMaterials(e.target.checked)} className="mt-1 accent-sky-500"/>Add common materials to the intake notes as unweighed suggestions.</label>}
      <p className="text-xs text-slate-300">VIN, weights, prices, payments and current-load photos are never copied from a previous ticket.</p>
      <div className="flex gap-2"><Button onClick={() => { onConfirm(customer, reusePlate ? plate : '', reuseMaterials ? history.data?.commonMaterials.map(item => item.name) ?? [] : []); onCancel(); }} className="flex-1 rounded-xl bg-sky-700 text-white hover:bg-sky-600">Confirm &amp; reuse seller details</Button><Button onClick={onCancel} variant="outline" className="rounded-xl border-slate-600 bg-slate-900 text-slate-100">Cancel</Button></div>
    </div>}
  </DialogContent></Dialog>;
}
