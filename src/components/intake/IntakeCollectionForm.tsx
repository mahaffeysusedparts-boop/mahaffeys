import React, { useEffect, useState } from 'react';
import { ComplianceCaptures, Customer, Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { customerService, type CustomerInput } from '@/services/customerService';
import { ComplianceCaptureModal } from '@/components/compliance/ComplianceCaptureModal';
import { calculateComplianceScore } from '@/utils/complianceUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CreditCard,
  Hash,
  Loader2,
  Package,
  Phone,
  RefreshCw,
  Scan,
  Scale,
  ShieldCheck,
  Truck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface IntakeCollectionFormProps {
  onBack: () => void;
  onSaved: (ticketId: string) => void;
}

const MAX_ACTIVE_LOADS = 10;

const emptyCaptures: ComplianceCaptures = {
  personPhotoUrl: undefined,
  idPhotoUrl: undefined,
  vehiclePhotoUrl: undefined,
  licensePlatePhotoUrl: undefined,
  loadPhotoUrl: undefined,
};

export const IntakeCollectionForm: React.FC<IntakeCollectionFormProps> = ({ onBack, onSaved }) => {
  const [ticketNumber, setTicketNumber] = useState<string>(() => storageService.generateScrapReceiptNumber());
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerIdNumber, setCustomerIdNumber] = useState('');
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState('');
  const [notes, setNotes] = useState('');

  const [captures, setCaptures] = useState<ComplianceCaptures>(emptyCaptures);
  const [captureOpen, setCaptureOpen] = useState(false);

  const compliance = calculateComplianceScore(captures, 'SCRAP_METAL');

  useEffect(() => {
    if (!customerSearchOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setCustomerSearchLoading(true);
      setCustomerSearchError('');
      try {
        const result = await customerService.list({ search: customerSearch.trim(), pageSize: 20 });
        if (active) setCustomerResults(result.customers);
      } catch (error) {
        if (active) {
          setCustomerResults([]);
          setCustomerSearchError(error instanceof Error ? error.message : 'Unable to search customers');
        }
      } finally {
        if (active) setCustomerSearchLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerSearch, customerSearchOpen]);

  const handleRegenerateNumber = () => {
    const next = storageService.generateScrapReceiptNumber();
    setTicketNumber(next);
    toast.info(`Generated receipt #${next}`);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomer(customer);
    setSelectedCustomerLabel(customer.isCommercial && customer.companyName
      ? `${customer.companyName} — ${customer.fullName}`
      : customer.fullName);
    setCustomerName(customer.fullName);
    setCustomerPhone(customer.phone || '');
    setCustomerIdNumber(customer.idNumber);
    setVehicleLicensePlate(customer.vehicleLicensePlate || '');
    // The selected customer's registry photo always wins — freshly retaking it
    // in the compliance studio below will overwrite this again.
    setCaptures((prev) => ({ ...prev, idPhotoUrl: customer.idPhotoUrl }));
    if (customer.idPhotoUrl) {
      toast.success('ID photo pulled from their customer record');
    }
    setCustomerSearchOpen(false);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error('Enter the seller name before saving this intake');
      return;
    }

    const activeLoads = storageService.getTickets().filter(
      (t) => t.ticketType === 'SCRAP_METAL' && t.status === 'PENDING'
    );
    if (activeLoads.length >= MAX_ACTIVE_LOADS) {
      toast.error(`Up to ${MAX_ACTIVE_LOADS} intakes can be open at once. Complete or clear one first.`);
      return;
    }

    const finalId = ticketNumber.trim() || storageService.generateScrapReceiptNumber();
    if (storageService.getTickets().some((t) => t.id === finalId)) {
      toast.error(`Receipt #${finalId} is already used. Edit the number or generate a new one.`);
      return;
    }

    setSaving(true);
    try {
      let customerId = selectedCustomerId;
      const customerInput: CustomerInput = {
        fullName: customerName.trim(),
        phone: customerPhone.trim(),
        idType: selectedCustomer?.idType ?? 'Driver License',
        idNumber: customerIdNumber.trim(),
        idState: selectedCustomer?.idState ?? 'GA',
        address: selectedCustomer?.address ?? '',
        vehicleLicensePlate: vehicleLicensePlate.trim().toUpperCase(),
        vehicleState: selectedCustomer?.vehicleState,
        notes: selectedCustomer?.notes,
        idPhotoUrl: captures.idPhotoUrl,
        isCommercial: selectedCustomer?.isCommercial ?? false,
        companyName: selectedCustomer?.companyName,
        businessAddress: selectedCustomer?.businessAddress,
      };

      if (customerId) {
        const updatedCustomer = await customerService.update(customerId, customerInput);
        setSelectedCustomer(updatedCustomer);
        setSelectedCustomerLabel(updatedCustomer.isCommercial && updatedCustomer.companyName
          ? `${updatedCustomer.companyName} — ${updatedCustomer.fullName}`
          : updatedCustomer.fullName);
        toast.success('Customer profile updated');
      } else if (customerIdNumber.trim()) {
        const newCustomer = await customerService.create(customerInput);
        customerId = newCustomer.id;
        setSelectedCustomerId(newCustomer.id);
        setSelectedCustomer(newCustomer);
        setSelectedCustomerLabel(newCustomer.fullName);
        toast.success('New customer profile created');
      }

      const ticket: Ticket = {
        id: finalId,
        ticketType: 'SCRAP_METAL',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        customerId: customerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerIdNumber: customerIdNumber.trim() || undefined,
        vehicleLicensePlate: vehicleLicensePlate.trim().toUpperCase() || undefined,
        scrapLines: [],
        complianceCaptures: captures,
        grossTotal: 0,
        totalDeductions: 0,
        finalPayout: 0,
        payoutMethod: 'Cash',
        operatorName: storageService.getSettings().operatorName,
        notes: notes.trim() || 'Seller info & photos collected — awaiting scale IN weighing.',
      };

      storageService.saveTicket(ticket);

      if (!customerPhone.trim() || !customerIdNumber.trim()) {
        toast.warning('Phone or ID number is missing', {
          description: customerIdNumber.trim()
            ? 'Capture the phone number before the final payout is issued.'
            : 'An ID number is required to add this seller to the customer registry.',
        });
      }

      toast.success(`Intake #${finalId} saved`, {
        description: 'Seller details & photos stored. Continue to the scale to log the IN weight.',
      });
      onSaved(finalId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save this intake');
    } finally {
      setSaving(false);
    }
  };

  const photoSlots = [
    { title: 'ID / License', icon: CreditCard, val: captures.idPhotoUrl },
    { title: 'Seller Face', icon: UserCheck, val: captures.personPhotoUrl },
    { title: 'Vehicle 45°', icon: Truck, val: captures.vehiclePhotoUrl },
    { title: 'License Plate', icon: Scan, val: captures.licensePlatePhotoUrl },
    { title: 'Cargo Load', icon: Package, val: captures.loadPhotoUrl },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 sm:pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-white">Scrap Intake — Part 1</h1>
              <Badge className="border border-emerald-500/40 bg-emerald-500/15 font-mono text-xs text-emerald-300">
                SELLER &amp; PHOTOS
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Collect the seller's information and compliance photos, save, then weigh IN/OUT later at the scale desk.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Receipt #</p>
            <Input
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              className="mt-1 h-8 w-36 border-slate-700 bg-slate-900 text-center font-mono text-sm font-bold text-amber-300"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRegenerateNumber}
            title="Auto-generate a new receipt number"
            className="h-10 gap-1 border-slate-700 bg-slate-800 text-xs text-slate-300 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" /> New #
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Seller + Photos */}
        <div className="space-y-6 lg:col-span-2">
          {/* Seller card */}
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-sm font-black text-emerald-400 ring-1 ring-emerald-500/30">1</span>
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-300">
                  Customer / Seller Profile
                </CardTitle>
              </div>
              <Badge className="border border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-300">
                SEARCH OR ADD NEW
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-300">Find Registered Customer</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="mt-1 h-11 w-full justify-between rounded-xl border-slate-800 bg-slate-950 px-3 text-xs font-normal text-white hover:bg-slate-900"
                      >
                        <span className="truncate">{selectedCustomerLabel || 'Search existing customers...'}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] rounded-xl border-slate-700 bg-slate-900 p-0 text-white shadow-2xl">
                      <Command shouldFilter={false} className="rounded-xl bg-slate-900 text-white">
                        <CommandInput
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          placeholder="Name, company, phone, ID, address..."
                          className="text-xs text-white placeholder:text-slate-500"
                        />
                        <CommandList>
                          {customerSearchLoading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Searching...</div>
                          ) : customerSearchError ? (
                            <div className="px-4 py-6 text-center text-xs text-rose-300">{customerSearchError}</div>
                          ) : (
                            <>
                              <CommandEmpty>No matching customer found. Enter seller details to create one on save.</CommandEmpty>
                              <CommandGroup heading="Customers">
                                {customerResults.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.id}
                                    onSelect={() => handleCustomerSelect(customer)}
                                    className="items-start rounded-lg px-3 py-2.5 text-white data-[selected=true]:bg-emerald-950"
                                  >
                                    <Check className={`mr-2 mt-0.5 h-4 w-4 text-emerald-400 ${selectedCustomerId === customer.id ? 'opacity-100' : 'opacity-0'}`} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-xs font-bold">{customer.isCommercial && customer.companyName ? customer.companyName : customer.fullName}</span>
                                        {customer.isCommercial && <Badge className="rounded-full bg-cyan-950 text-[8px] text-cyan-300">Commercial</Badge>}
                                      </div>
                                      <p className="truncate text-[10px] text-slate-400">{customer.isCommercial ? `${customer.fullName} · ` : ''}{customer.phone || customer.idNumber}</p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Seller Name *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="mt-1 h-11 border-slate-800 bg-slate-950 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="flex items-center gap-1 text-xs text-slate-300">
                    <Phone className="h-3 w-3 text-emerald-400" /> Phone Number
                  </Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="mt-1 h-11 border-slate-800 bg-slate-950 font-mono text-xs font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Driver License / ID #</Label>
                  <Input
                    value={customerIdNumber}
                    onChange={(e) => setCustomerIdNumber(e.target.value)}
                    placeholder="e.g. DL-4481029-GA"
                    className="mt-1 h-11 border-slate-800 bg-slate-950 font-mono text-xs text-amber-300"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Vehicle License Plate</Label>
                  <Input
                    value={vehicleLicensePlate}
                    onChange={(e) => setVehicleLicensePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. TOW-912 (GA)"
                    className="mt-1 h-11 border-slate-800 bg-slate-950 font-mono text-xs uppercase text-slate-200"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-300">Intake Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional — material description, directions, etc."
                  className="mt-1 h-11 border-slate-800 bg-slate-950 text-xs text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos card */}
          <Card className="border-blue-500/40 bg-slate-900 text-white shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-blue-500/30 bg-gradient-to-r from-blue-950/80 to-slate-950 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-950 text-sm font-black text-blue-300 ring-1 ring-blue-500/30">2</span>
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
                  Compliance Photo Capture
                </CardTitle>
              </div>
              <Badge
                className={`font-mono text-xs ${
                  compliance.score === 100
                    ? 'border border-emerald-500/40 bg-emerald-950 text-emerald-400'
                    : 'border border-amber-500/40 bg-amber-950 text-amber-400'
                }`}
              >
                {compliance.score}% Captured
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {photoSlots.map((slot) => {
                  const Icon = slot.icon;
                  return (
                    <button
                      key={slot.title}
                      type="button"
                      onClick={() => setCaptureOpen(true)}
                      className={`group rounded-xl border p-2 text-center transition-all active:scale-[0.98] ${
                        slot.val
                          ? 'border-emerald-500/60 bg-slate-800/90 hover:border-emerald-400'
                          : 'border-slate-800 bg-slate-950/80 hover:border-blue-500/60'
                      }`}
                    >
                      <div className="relative mb-1 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950">
                        {slot.val ? (
                          <img src={slot.val} alt={slot.title} className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="h-5 w-5 text-slate-500" />
                        )}
                        {slot.val && (
                          <span className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5 text-slate-950">
                            <CheckCircle2 className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[11px] font-semibold text-slate-200">{slot.title}</span>
                      <span className="text-[9px] font-semibold text-slate-500">
                        {slot.val ? 'CAPTURED' : 'TAP TO ADD'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => setCaptureOpen(true)}
                className="h-11 w-full gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500"
              >
                <Camera className="h-4 w-4" /> Open Photo Compliance Studio
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary + Save */}
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900 text-white shadow-xl">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-sm font-black text-emerald-400 ring-1 ring-emerald-500/30">3</span>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-300">
                Save &amp; Send to Scale
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt #:</span>
                  <span className="font-bold text-amber-400">{ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seller:</span>
                  <span className="font-bold text-white">{customerName || 'Not entered'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-bold text-emerald-400">{customerPhone || 'Not entered'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ID #:</span>
                  <span className="font-bold text-amber-300">{customerIdNumber || 'Not entered'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Photos:</span>
                  <span className="font-bold text-emerald-400">{compliance.score}%</span>
                </div>
              </div>

              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-12 w-full gap-2 bg-emerald-600 text-sm font-extrabold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                {saving ? 'Saving Intake...' : 'Save Intake & Continue to Scale'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </Button>

              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                Saving stores this intake in the active queue. At the scale desk you can log this load's IN weight,
                switch to another transaction, and come back to log the OUT weight.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            <p>
              Photos and seller details satisfy the state 5-point record. Signatures are completed on the printed
              voucher at payout.
            </p>
          </div>
        </div>
      </div>

      <ComplianceCaptureModal
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        initialCaptures={captures}
        onSaveCaptures={(next) => setCaptures(next)}
        intakeType="SCRAP_METAL"
      />
    </div>
  );
};
