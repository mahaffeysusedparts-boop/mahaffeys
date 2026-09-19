import { useCallback, useEffect, useState } from 'react';
import type { Customer } from '@/types/scrap';
import { customerService, type CustomerInput } from '@/services/customerService';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Building2, Car, ChevronLeft, ChevronRight, CreditCard, Edit3, Loader2, RefreshCw, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 25;
const emptyForm: CustomerInput = {
  fullName: '',
  phone: '',
  idType: 'Driver License',
  idNumber: '',
  idState: 'GA',
  address: '',
  vehicleLicensePlate: '',
  isCommercial: false,
  companyName: '',
  businessAddress: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await customerService.list({ search: debouncedSearch, page, pageSize: PAGE_SIZE });
      setCustomers(result.customers);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      setCustomers([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openAdd = () => {
    setEditingCustomer(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      fullName: customer.fullName,
      phone: customer.phone || '',
      idType: customer.idType,
      idNumber: customer.idNumber,
      idState: customer.idState,
      address: customer.address || '',
      vehicleLicensePlate: customer.vehicleLicensePlate || '',
      vehicleState: customer.vehicleState || '',
      notes: customer.notes || '',
      idPhotoUrl: customer.idPhotoUrl,
      isCommercial: customer.isCommercial,
      companyName: customer.companyName || '',
      businessAddress: customer.businessAddress || '',
    });
    setModalOpen(true);
  };

  const updateForm = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveCustomer = async () => {
    if (!form.fullName.trim() || !form.idNumber.trim()) {
      toast.error('Full name and ID number are required for state compliance');
      return;
    }
    if (form.isCommercial && !form.companyName?.trim()) {
      toast.error('Company name is required for commercial accounts');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, form);
        toast.success(`Updated ${form.fullName.trim()}`);
      } else {
        await customerService.create(form);
        toast.success(`Registered ${form.fullName.trim()}`);
      }
      setModalOpen(false);
      setEditingCustomer(null);
      await loadCustomers();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Seller Compliance & Customer Registry</h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">Searchable seller and commercial profiles stored securely across workstations</p>
          </div>
          <Button onClick={openAdd} className="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500">
            <UserPlus className="mr-1.5 h-4 w-4" /> Register Customer
          </Button>
        </div>

        <Card className="rounded-2xl border-slate-800 bg-slate-900 text-white shadow-lg">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search name, company, ID, phone, plate, or address..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded-xl border-slate-800 bg-slate-950 pl-9 text-xs text-white"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400">{total.toLocaleString()} customer{total === 1 ? '' : 's'}</span>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-slate-800 bg-slate-900 text-white shadow-xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> Loading customers...</div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-sm font-semibold text-rose-300">{error}</p>
                <Button variant="outline" onClick={() => void loadCustomers()} className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700"><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button>
              </div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">No customers match this search.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="w-12 text-slate-400">ID</TableHead>
                      <TableHead className="text-slate-400">Customer / Company</TableHead>
                      <TableHead className="text-slate-400">ID Credentials</TableHead>
                      <TableHead className="text-slate-400">Phone & Plate</TableHead>
                      <TableHead className="text-right text-slate-400">Lifetime Weight</TableHead>
                      <TableHead className="text-right text-slate-400">Lifetime Payouts</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="border-slate-800 text-xs hover:bg-slate-800/50">
                        <TableCell>
                          <div className="flex h-8 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                            {customer.idPhotoUrl ? <img src={customer.idPhotoUrl} alt="Customer ID" className="h-full w-full object-cover" /> : <CreditCard className="h-4 w-4 text-slate-600" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2 font-bold text-white">
                            {customer.isCommercial && customer.companyName ? customer.companyName : customer.fullName}
                            {customer.isCommercial && <Badge className="rounded-full border border-cyan-500/40 bg-cyan-950 px-2 text-[9px] font-bold uppercase tracking-wide text-cyan-300">Commercial</Badge>}
                          </div>
                          {customer.isCommercial && <span className="block text-[10px] text-slate-300">Contact: {customer.fullName}</span>}
                          <span className="block max-w-xs text-[10px] font-normal text-slate-400">{customer.isCommercial ? customer.businessAddress || customer.address || 'No address on file' : customer.address || 'No address on file'}</span>
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">
                          <Badge variant="outline" className="mr-1.5 rounded-full border-slate-700 text-[10px] text-emerald-400">{customer.idType}</Badge>
                          {customer.idNumber} ({customer.idState})
                        </TableCell>
                        <TableCell className="text-slate-300">
                          <div className="text-[11px]">{customer.phone || 'No phone listed'}</div>
                          {customer.vehicleLicensePlate && <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-amber-400"><Car className="h-3 w-3" /> Tag: {customer.vehicleLicensePlate}</div>}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-300">{customer.totalWeightLbs.toLocaleString()} LBS</TableCell>
                        <TableCell className="text-right font-mono font-extrabold text-emerald-400">${customer.totalPayouts.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(customer)} className="h-8 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Edit3 className="mr-1 h-3.5 w-3.5 text-emerald-400" /> Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-xl border-slate-700 bg-slate-900 text-white"><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
            <span className="text-xs font-semibold text-slate-400">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-xl border-slate-700 bg-slate-900 text-white">Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        )}
      </main>

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-slate-800 bg-slate-900 text-slate-100 sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              {editingCustomer ? <Edit3 className="h-5 w-5 text-emerald-400" /> : <UserPlus className="h-5 w-5 text-emerald-400" />}
              {editingCustomer ? 'Edit Customer Profile' : 'Register Customer Profile'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-950/40 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-900 text-cyan-300"><Building2 className="h-4 w-4" /></span>
                <div><Label htmlFor="commercial" className="font-bold text-white">Commercial account</Label><p className="mt-0.5 text-[10px] text-cyan-200/70">Add company and business location details</p></div>
              </div>
              <Switch id="commercial" checked={form.isCommercial} onCheckedChange={(checked) => updateForm('isCommercial', checked)} className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-slate-700" />
            </div>

            {form.isCommercial && (
              <div className="grid gap-3 rounded-xl border border-cyan-500/20 bg-slate-950/60 p-3 sm:grid-cols-2">
                <div><Label className="text-slate-300">Company Name *</Label><Input value={form.companyName || ''} onChange={(event) => updateForm('companyName', event.target.value)} placeholder="Mahaffey Logistics" className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
                <div><Label className="text-slate-300">Business Address</Label><Input value={form.businessAddress || ''} onChange={(event) => updateForm('businessAddress', event.target.value)} placeholder="Business location" className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
              </div>
            )}

            <div><Label className="text-slate-300">{form.isCommercial ? 'Authorized Contact Name *' : 'Full Name *'}</Label><Input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="e.g. Marcus Vance" className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label className="text-slate-300">ID Type</Label><select value={form.idType} onChange={(event) => updateForm('idType', event.target.value as Customer['idType'])} className="mt-1 h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white"><option>Driver License</option><option>State ID</option><option>Passport</option><option>Military ID</option></select></div>
              <div><Label className="text-slate-300">ID Number *</Label><Input value={form.idNumber} onChange={(event) => updateForm('idNumber', event.target.value)} className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label className="text-slate-300">Phone Number</Label><Input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="(555) 000-0000" className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
              <div><Label className="text-slate-300">Default License Plate</Label><Input value={form.vehicleLicensePlate || ''} onChange={(event) => updateForm('vehicleLicensePlate', event.target.value.toUpperCase())} placeholder="TOW-912" className="mt-1 border-slate-800 bg-slate-950 font-mono uppercase text-white" /></div>
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div><Label className="text-slate-300">Residential Address</Label><Input value={form.address} onChange={(event) => updateForm('address', event.target.value)} placeholder="Street, city, state, ZIP" className="mt-1 border-slate-800 bg-slate-950 text-white" /></div>
              <div><Label className="text-slate-300">ID State</Label><Input value={form.idState} onChange={(event) => updateForm('idState', event.target.value.toUpperCase())} className="mt-1 border-slate-800 bg-slate-950 text-center uppercase text-white" /></div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button variant="ghost" disabled={saving} onClick={() => setModalOpen(false)} className="text-slate-400">Cancel</Button>
            <Button disabled={saving} onClick={() => void saveCustomer()} className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingCustomer ? 'Update Profile' : 'Save Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
