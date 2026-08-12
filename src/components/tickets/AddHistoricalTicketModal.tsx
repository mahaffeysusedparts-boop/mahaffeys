import React, { useState } from "react";
import { Ticket, ScrapTicketLine, CarIntakeRecord, Customer } from "@/types/scrap";
import { storageService } from "@/services/storageService";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  History,
  Calendar,
  Plus,
  Trash2,
  Car,
  Scale,
  User,
  Hash,
  CheckCircle2,
  Upload,
  Camera,
  CreditCard,
  UserCheck,
  Scan,
  Package,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface AddHistoricalTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddHistoricalTicketModal: React.FC<AddHistoricalTicketModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const metals = storageService.getMetals();
  const customers = storageService.getCustomers();

  // Basic Ticket Details
  const [ticketId, setTicketId] = useState<string>(
    `PAST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [pastDate, setPastDate] = useState<string>(
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 16)
  );
  const [ticketType, setTicketType] = useState<"SCRAP_METAL" | "CAR_SALVAGE">("SCRAP_METAL");

  // Customer Credentials
  const [selectedCustId, setSelectedCustId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerIdNumber, setCustomerIdNumber] = useState<string>("");
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState<string>("");

  // Payment Details
  const [payoutMethod, setPayoutMethod] = useState<Ticket["payoutMethod"]>("Cash");
  const [checkNumber, setCheckNumber] = useState<string>("");
  const [operatorName, setOperatorName] = useState<string>(
    storageService.getSettings().operatorName || "Jackson Hilliard"
  );
  const [notes, setNotes] = useState<string>("Historical paper ticket entered retroactively into system");

  // PAST COMPLIANCE PHOTOS
  const [idPhotoUrl, setIdPhotoUrl] = useState<string>(generateSamplePhoto("id"));
  const [personPhotoUrl, setPersonPhotoUrl] = useState<string>(generateSamplePhoto("person"));
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string>(generateSamplePhoto("vehicle"));
  const [licensePlatePhotoUrl, setLicensePlatePhotoUrl] = useState<string>(generateSamplePhoto("plate"));
  const [loadPhotoUrl, setLoadPhotoUrl] = useState<string>(generateSamplePhoto("load"));

  // SCRAP METAL LINE ITEMS
  const [scrapLines, setScrapLines] = useState<ScrapTicketLine[]>([]);
  const [selectedMetalId, setSelectedMetalId] = useState<string>(metals[0]?.id || "");
  const [lineWeight, setLineWeight] = useState<number>(250);
  const [lineRate, setLineRate] = useState<number>(metals[0]?.ratePerLb || 0.65);

  // CAR SALVAGE DETAILS
  const [vin, setVin] = useState<string>("");
  const [carYear, setYear] = useState<number>(2008);
  const [carMake, setMake] = useState<string>("Ford");
  const [carModel, setModel] = useState<string>("F-150");
  const [carColor, setColor] = useState<string>("White");
  const [carTitleStatus, setTitleStatus] = useState<CarIntakeRecord["titleStatus"]>("Salvage Title");
  const [carWeight, setCarWeight] = useState<number>(3800);
  const [carPayout, setCarPayout] = useState<number>(450);

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.fullName);
      setCustomerPhone(found.phone || "");
      setCustomerIdNumber(found.idNumber);
      if (found.vehicleLicensePlate) setVehicleLicensePlate(found.vehicleLicensePlate);
      if (found.idPhotoUrl) setIdPhotoUrl(found.idPhotoUrl);
    }
  };

  const handleMetalSelect = (metalId: string) => {
    setSelectedMetalId(metalId);
    const found = metals.find((m) => m.id === metalId);
    if (found) {
      setLineRate(found.ratePerLb);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const dataUrl = evt.target.result as string;
          setter(dataUrl);
          toast.success(`Attached ${label} photo`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddScrapLine = () => {
    const metal = metals.find((m) => m.id === selectedMetalId) || metals[0];
    if (!metal || lineWeight <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    const lineTotal = Math.round(lineWeight * lineRate * 100) / 100;
    const newLine: ScrapTicketLine = {
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      metalGradeId: metal.id,
      metalName: metal.name,
      metalCategory: metal.category,
      grossWeight: lineWeight,
      tareWeight: 0,
      netWeight: lineWeight,
      deductionPercent: 0,
      deductionLbs: 0,
      billableWeight: lineWeight,
      ratePerLb: lineRate,
      lineTotal,
    };

    setScrapLines([...scrapLines, newLine]);
    toast.success(`Added ${lineWeight} lbs of ${metal.name}`);
  };

  const handleRemoveScrapLine = (id: string) => {
    setScrapLines(scrapLines.filter((l) => l.id !== id));
  };

  const totalScrapPayout = scrapLines.reduce((acc, l) => acc + l.lineTotal, 0);
  const finalPayoutTotal = ticketType === "SCRAP_METAL" ? totalScrapPayout : carPayout;

  const handleSaveHistoricalTicket = () => {
    if (!ticketId.trim()) {
      toast.error("Receipt / Ticket Number is required");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer / Seller Name is required");
      return;
    }
    if (ticketType === "SCRAP_METAL" && scrapLines.length === 0) {
      toast.error("Add at least one metal line item to record past scrap transaction");
      return;
    }
    if (ticketType === "CAR_SALVAGE" && !vin.trim()) {
      toast.error("Vehicle VIN is required (or enter NO-VIN)");
      return;
    }

    const createdAtIso = pastDate ? new Date(pastDate).toISOString() : new Date().toISOString();

    const carRecord: CarIntakeRecord | undefined =
      ticketType === "CAR_SALVAGE"
        ? {
            vin: vin.toUpperCase().trim(),
            year: carYear,
            make: carMake,
            model: carModel,
            color: carColor,
            titleStatus: carTitleStatus,
            hasCatalyticConverter: true,
            catCondition: "Original OEM",
            hasEngineAndTrans: true,
            hasBattery: true,
            hasAluminumRims: true,
            fluidsDrained: true,
            pricingMode: "FLAT_RATE",
            vehicleWeightLbs: carWeight,
            ratePerTon: 0,
            flatRate: carPayout,
            catBonus: 0,
            engineBonus: 0,
            batteryBonus: 0,
            deductions: 0,
            totalPayout: carPayout,
            purchasePrice: carPayout,
            photoUrl: vehiclePhotoUrl,
          }
        : undefined;

    const historicalTicket: Ticket = {
      id: ticketId.trim(),
      ticketType,
      createdAt: createdAtIso,
      status: "COMPLETED",
      customerId: selectedCustId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerIdNumber: customerIdNumber.trim() || undefined,
      vehicleLicensePlate: vehicleLicensePlate.trim() || undefined,
      scrapLines: ticketType === "SCRAP_METAL" ? scrapLines : undefined,
      carRecord,
      complianceCaptures: {
        idPhotoUrl,
        personPhotoUrl,
        vehiclePhotoUrl,
        licensePlatePhotoUrl,
        loadPhotoUrl,
      },
      grossTotal: finalPayoutTotal,
      totalDeductions: 0,
      finalPayout: Math.round(finalPayoutTotal * 100) / 100,
      payoutMethod,
      checkNumber: payoutMethod === "Check" ? checkNumber : undefined,
      operatorName,
      notes: notes.trim() || "Historical transaction entered retroactively",
    };

    storageService.saveTicket(historicalTicket);
    toast.success(`Recorded Past Transaction #${historicalTicket.id}!`, {
      description: `Amount: $${historicalTicket.finalPayout.toFixed(2)} | Date: ${new Date(createdAtIso).toLocaleDateString()}`,
    });
    onSuccess();
    onClose();
  };

  const photoSlots = [
    { label: "DL / ID Scan", url: idPhotoUrl, setter: setIdPhotoUrl, defaultVal: generateSamplePhoto("id"), icon: CreditCard },
    { label: "Seller Face", url: personPhotoUrl, setter: setPersonPhotoUrl, defaultVal: generateSamplePhoto("person"), icon: UserCheck },
    { label: "Vehicle", url: vehiclePhotoUrl, setter: setVehiclePhotoUrl, defaultVal: generateSamplePhoto("vehicle"), icon: Car },
    { label: "License Plate", url: licensePlatePhotoUrl, setter: setLicensePlatePhotoUrl, defaultVal: generateSamplePhoto("plate"), icon: Scan },
    { label: "Cargo Load", url: loadPhotoUrl, setter: setLoadPhotoUrl, defaultVal: generateSamplePhoto("load"), icon: Package },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[720px] max-h-[92vh] overflow-y-auto font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-base font-bold text-white font-mono">
                Add Historical / Past Scrap Transaction
              </DialogTitle>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              RETROACTIVE ENTRY
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Log past paper receipts, customer credentials, and attach past photos into the system ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Row 1: Ticket Number, Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 flex items-center gap-1 font-bold">
                <Hash className="w-3.5 h-3.5 text-amber-400" /> Ticket / Receipt # *
              </Label>
              <Input
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="e.g. T-2024-0891"
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 flex items-center gap-1 font-bold">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Historical Date & Time *
              </Label>
              <Input
                type="datetime-local"
                value={pastDate}
                onChange={(e) => setPastDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono text-xs mt-1 h-10"
              />
            </div>

            <div>
              <Label className="text-slate-300 font-bold block">Transaction Category *</Label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setTicketType("SCRAP_METAL")}
                  className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 ${
                    ticketType === "SCRAP_METAL"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" /> Scrap Metal
                </button>
                <button
                  type="button"
                  onClick={() => setTicketType("CAR_SALVAGE")}
                  className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 ${
                    ticketType === "CAR_SALVAGE"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800"
                  }`}
                >
                  <Car className="w-3.5 h-3.5" /> Car Salvage
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Customer Credentials */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" /> Seller / Customer Record
              </span>
              {customers.length > 0 && (
                <div className="w-60">
                  <Select value={selectedCustId} onValueChange={handleCustomerSelect}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 text-xs h-8">
                      <SelectValue placeholder="-- Autofill Existing Seller --" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.fullName} ({c.idNumber || c.phone || "On File"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Customer Full Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Robert Henderson"
                  className="bg-slate-950 border-slate-800 text-white font-bold text-xs mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-slate-300">Phone Number</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="bg-slate-950 border-slate-800 text-emerald-400 font-mono text-xs mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-slate-300">Driver License / ID #</Label>
                <Input
                  value={customerIdNumber}
                  onChange={(e) => setCustomerIdNumber(e.target.value)}
                  placeholder="DL-9823145-GA"
                  className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs mt-1 h-9"
                />
              </div>

              <div>
                <Label className="text-slate-300">Vehicle Tag / License Plate</Label>
                <Input
                  value={vehicleLicensePlate}
                  onChange={(e) => setVehicleLicensePlate(e.target.value)}
                  placeholder="7ABC89"
                  className="bg-slate-950 border-slate-800 text-slate-200 font-mono uppercase text-xs mt-1 h-9"
                />
              </div>
            </div>
          </div>

          {/* Row 3: PAST COMPLIANCE PHOTOS UPLOAD */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Upload Past Compliance Photos
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Attach historical image files for audit proof
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {photoSlots.map((slot, idx) => {
                const Icon = slot.icon;
                const isCustom = slot.url && slot.url !== slot.defaultVal;

                return (
                  <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center space-y-1.5">
                    <div className="aspect-video bg-slate-900 rounded overflow-hidden relative flex items-center justify-center border border-slate-800">
                      {slot.url ? (
                        <img src={slot.url} alt={slot.label} className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="w-4 h-4 text-slate-600" />
                      )}
                      {isCustom && (
                        <span className="absolute top-0.5 right-0.5 bg-emerald-500 text-slate-950 p-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-bold text-slate-300 block truncate">{slot.label}</span>

                    <label className="cursor-pointer inline-flex items-center justify-center gap-1 w-full bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-[10px] py-1 px-1.5 rounded border border-slate-700 transition-colors">
                      <Upload className="w-3 h-3 text-amber-400" /> {isCustom ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, slot.setter, slot.label)}
                        className="hidden"
                      />
                    </label>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => slot.setter(slot.defaultVal)}
                        className="text-[9px] text-slate-500 hover:text-red-400 block mx-auto underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ITEM DETAILS SECTION */}
          {ticketType === "SCRAP_METAL" ? (
            /* SCRAP METAL LINES ENTRY */
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-400" /> Historical Scrap Metal Line Items
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] text-slate-400">Metal Grade</Label>
                  <select
                    value={selectedMetalId}
                    onChange={(e) => handleMetalSelect(e.target.value)}
                    className="w-full h-9 bg-slate-900 border border-slate-800 rounded text-xs text-white px-2 mt-1 font-bold"
                  >
                    {metals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (${m.ratePerLb.toFixed(2)}/lb)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Net Weight (Lbs)</Label>
                  <Input
                    type="number"
                    value={lineWeight}
                    onChange={(e) => setLineWeight(parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-800 text-emerald-300 font-mono font-bold text-xs mt-1 h-9"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-400">Rate ($/lb)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={lineRate}
                    onChange={(e) => setLineRate(parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-9"
                  />
                </div>

                <Button
                  onClick={handleAddScrapLine}
                  className="sm:col-span-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Metal Item Line
                </Button>
              </div>

              {/* Scrap Line Items Table */}
              {scrapLines.length > 0 && (
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-950">
                      <TableRow className="border-slate-800 text-[11px]">
                        <TableHead className="text-slate-400">Metal Grade</TableHead>
                        <TableHead className="text-right text-slate-400">Net Lbs</TableHead>
                        <TableHead className="text-right text-slate-400">Rate/lb</TableHead>
                        <TableHead className="text-right text-slate-400">Line Total</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scrapLines.map((line) => (
                        <TableRow key={line.id} className="border-slate-800 text-xs font-mono">
                          <TableCell className="font-sans font-bold text-white">{line.metalName}</TableCell>
                          <TableCell className="text-right text-emerald-300">{line.billableWeight} lbs</TableCell>
                          <TableCell className="text-right text-slate-300">${line.ratePerLb.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-400">${line.lineTotal.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveScrapLine(line.id)}
                              className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            /* CAR SALVAGE ENTRY */
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Car className="w-4 h-4 text-amber-400" /> Historical Vehicle Salvage Details
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2">
                  <Label className="text-slate-300">VIN Number *</Label>
                  <Input
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="1FTRF12W88KA10291 or NO-VIN"
                    className="bg-slate-950 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1 h-9"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Year</Label>
                  <Input
                    type="number"
                    value={carYear}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2008)}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-xs mt-1 h-9"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Make</Label>
                  <Input
                    value={carMake}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Ford"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9 font-bold"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Model</Label>
                  <Input
                    value={carModel}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="F-150"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9 font-bold"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Title Status</Label>
                  <Select value={carTitleStatus} onValueChange={(val) => setTitleStatus(val as any)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                      <SelectItem value="Salvage Title">Salvage Title</SelectItem>
                      <SelectItem value="Clean Title">Clean Title</SelectItem>
                      <SelectItem value="Bill of Sale">Bill of Sale</SelectItem>
                      <SelectItem value="Missing Title (Affidavit)">Missing Title Affidavit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Vehicle Weight (Lbs)</Label>
                  <Input
                    type="number"
                    value={carWeight}
                    onChange={(e) => setCarWeight(parseFloat(e.target.value) || 0)}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-xs mt-1 h-9"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Car Payout Amount ($) *</Label>
                  <Input
                    type="number"
                    value={carPayout}
                    onChange={(e) => setCarPayout(parseFloat(e.target.value) || 0)}
                    className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT & OPERATOR FOOTER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
            <div>
              <Label className="text-slate-300 font-bold">Payout Method</Label>
              <Select value={payoutMethod} onValueChange={(val) => setPayoutMethod(val as any)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="ACH Direct Transfer">ACH Direct Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payoutMethod === "Check" && (
              <div>
                <Label className="text-slate-300 font-bold">Check Number</Label>
                <Input
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="CHK-9021"
                  className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs mt-1 h-9 font-bold"
                />
              </div>
            )}

            <div>
              <Label className="text-slate-300 font-bold">Operator Name</Label>
              <Input
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300 font-bold">Retroactive Entry Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paper ticket #8801 entered retroactively into database..."
              className="bg-slate-900 border-slate-800 text-slate-200 text-xs mt-1 h-9"
            />
          </div>

        </div>

        <DialogFooter className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs font-mono">
            <span className="text-slate-400">Total Payout: </span>
            <span className="text-emerald-400 font-black text-base">${finalPayoutTotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-400 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSaveHistoricalTicket}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-950 h-10"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Past Transaction
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};