import React, { useState, useEffect, useRef } from "react";
import { storageService } from "@/services/storageService";
import {
  PullYardVehicle,
  PullPartItem,
  CoreReturnLog,
  AdmissionPass,
  PullYardVehicleStatus,
} from "@/types/scrap";
import { generateSamplePhoto } from "@/utils/complianceUtils";
import { analyzeVinImage } from "@/services/aiVisionService";
import { PartsInterchangeModal } from "@/components/inventory/PartsInterchangeModal";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Wrench,
  Car,
  Search,
  DollarSign,
  Ticket as TicketIcon,
  RotateCcw,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  Droplets,
  AlertCircle,
  FileText,
  Flame,
  Check,
  FileSpreadsheet,
  Scan,
  Ban,
  Layers3,
  Sparkles,
} from "lucide-react";
import { BulkVehicleUploadModal } from "@/components/inventory/BulkVehicleUploadModal";
import { toast } from "sonner";

export default function PullAPartPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [parts, setParts] = useState<PullPartItem[]>([]);
  const [cores, setCores] = useState<CoreReturnLog[]>([]);
  const [passes, setPasses] = useState<AdmissionPass[]>([]);

  // Search & Filter states
  const [vehSearch, setVehSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PullYardVehicleStatus>("ALL");
  const [partSearch, setPartSearch] = useState("");

  // Vehicle Add / Edit Modal
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [editingVeh, setEditingVeh] = useState<PullYardVehicle | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [interchangeModalOpen, setInterchangeModalOpen] = useState(false);

  const [vehSection, setVehSection] = useState<PullYardVehicle["section"]>("Domestic Trucks & SUVs");
  const [vehYear, setVehYear] = useState(2010);
  const [vehMake, setVehMake] = useState("Ford");
  const [vehModel, setVehModel] = useState("F-150");
  const [vehColor, setVehColor] = useState("");
  const [vehVin, setVehVin] = useState("");
  const [vehStatus, setVehStatus] = useState<PullYardVehicleStatus>("PENDING");
  const [vehParts, setVehParts] = useState("Engine, Transmission, Wheels");
  const [vehPurchasePrice, setVehPurchasePrice] = useState(450);
  const [vehOriginSource, setVehOriginSource] = useState("Tow Origin / Address");
  const [vehNotes, setVehNotes] = useState("");
  const [vehPhotoUrl, setVehPhotoUrl] = useState(generateSamplePhoto("vehicle"));

  const vinCameraRef = useRef<HTMLInputElement>(null);

  // Dismantling Log Modal
  const [logVehicle, setLogVehicle] = useState<PullYardVehicle | null>(null);
  const [catsRemoved, setCatsRemoved] = useState(0);
  const [wheelsRemoved, setWheelsRemoved] = useState(0);
  const [gasDrained, setGasDrained] = useState(false);
  const [oilDrained, setOilDrained] = useState(false);
  const [processorNotes, setProcessorNotes] = useState("");

  // Delete Confirmation Modal
  const [deletingVehicle, setDeletingVehicle] = useState<PullYardVehicle | null>(null);

  // Print Pass Modal
  const [selectedVehForTicket, setSelectedVehForTicket] = useState<PullYardVehicle | null>(null);

  // Core Refund Modal
  const [coreModalOpen, setCoreModalOpen] = useState(false);
  const [coreCustName, setCoreCustName] = useState("");
  const [coreCustId, setCoreCustId] = useState("");
  const [corePartName, setCorePartName] = useState("Alternator / Generator Core");
  const [coreDeposit, setCoreDeposit] = useState(10.00);

  // Gate Pass Modal
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passCustName, setPassCustName] = useState("");
  const [passCustId, setPassCustId] = useState("");
  const [waiverSigned, setWaiverSigned] = useState(true);

  const loadData = () => {
    setVehicles(storageService.getPullYardVehicles());
    setParts(storageService.getPullParts());
    setCores(storageService.getCoreReturns());
    setPasses(storageService.getAdmissionPasses());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddVeh = () => {
    setEditingVeh(null);
    setVehYear(new Date().getFullYear() - 10);
    setVehMake("");
    setVehModel("");
    setVehColor("");
    setVehVin("");
    setVehSection("Domestic Trucks & SUVs");
    setVehStatus("PENDING");
    setVehParts("Engine, Transmission, Wheels");
    setVehPurchasePrice(450);
    setVehOriginSource("");
    setVehNotes("");
    setVehPhotoUrl(generateSamplePhoto("vehicle"));
    setVehModalOpen(true);
  };

  const handleOpenEditVeh = (v: PullYardVehicle) => {
    setEditingVeh(v);
    setVehSection(v.section);
    setVehYear(v.year);
    setVehMake(v.make);
    setVehModel(v.model);
    setVehColor(v.color);
    setVehVin(v.vin);
    setVehStatus(v.status);
    setVehParts(v.partsRemaining.join(", "));
    setVehPurchasePrice(v.purchasePrice || 0);
    setVehOriginSource(v.originSource || "");
    setVehNotes(v.notes || "");
    setVehPhotoUrl(v.photoUrl || generateSamplePhoto("vehicle"));
    setVehModalOpen(true);
  };

  const handleVinPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("AI Vision analyzing dash tag or door jamb VIN photo...", { icon: "✨" });
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const res = await analyzeVinImage(dataUrl);
          if (res.vin) {
            setVehVin(res.vin);
            toast.success(`AI Extracted VIN: ${res.vin}`);
          } else {
            toast.error("Could not read 17-character VIN. Please verify photo angle.");
          }
        } catch (err) {
          console.warn("VIN OCR error:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkipVin = () => {
    const noVinCode = `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVehVin(noVinCode);
    toast.info(`Bypassed VIN. Assigned: ${noVinCode}`);
  };

  const handleSaveVeh = () => {
    if (!vehMake.trim() || !vehModel.trim()) {
      toast.error("Make and Model are required");
      return;
    }

    const partsList = vehParts.split(",").map((s) => s.trim()).filter(Boolean);

    const vehObj: PullYardVehicle = {
      id: editingVeh ? editingVeh.id : `veh-${Date.now()}`,
      section: vehSection,
      year: vehYear,
      make: vehMake,
      model: vehModel,
      color: vehColor,
      vin: vehVin.toUpperCase().trim() || `NO-VIN-${Math.floor(1000 + Math.random() * 9000)}`,
      dateSetInYard: editingVeh ? editingVeh.dateSetInYard : new Date().toISOString(),
      status: vehStatus,
      partsRemaining: partsList.length > 0 ? partsList : ["Body Shell"],
      purchasePrice: vehPurchasePrice,
      originSource: vehOriginSource.trim() || undefined,
      notes: vehNotes.trim() || undefined,
      photoUrl: vehPhotoUrl,
      dismantlingLog: editingVeh?.dismantlingLog || {
        catalyticConvertersRemoved: 0,
        wheelsRemoved: 0,
        gasDrained: false,
        oilDrained: false,
      },
    };

    storageService.savePullYardVehicle(vehObj);
    loadData();
    setVehModalOpen(false);
    toast.success(`${editingVeh ? "Updated" : "Added"} ${vehYear} ${vehMake} ${vehModel}`);
  };

  const handleStatusChange = (vehicle: PullYardVehicle, status: PullYardVehicleStatus) => {
    storageService.savePullYardVehicle({ ...vehicle, status });
    loadData();
    toast.success(`${vehicle.year} ${vehicle.make} ${vehicle.model} marked as ${status}`);
  };

  const handleOpenPullLog = (vehicle: PullYardVehicle) => {
    setLogVehicle(vehicle);
    setCatsRemoved(vehicle.dismantlingLog.catalyticConvertersRemoved);
    setWheelsRemoved(vehicle.dismantlingLog.wheelsRemoved);
    setGasDrained(vehicle.dismantlingLog.gasDrained);
    setOilDrained(vehicle.dismantlingLog.oilDrained);
    setProcessorNotes(vehicle.dismantlingLog.notes || "");
  };

  const handleSavePullLog = (moveToAvailable = false) => {
    if (!logVehicle) return;

    const newStatus: PullYardVehicleStatus = moveToAvailable ? "AVAILABLE" : logVehicle.status;

    storageService.savePullYardVehicle({
      ...logVehicle,
      status: newStatus,
      dismantlingLog: {
        catalyticConvertersRemoved: Math.max(0, catsRemoved),
        wheelsRemoved: Math.min(8, Math.max(0, wheelsRemoved)),
        gasDrained,
        oilDrained,
        notes: processorNotes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    });
    loadData();
    setLogVehicle(null);
    toast.success(
      moveToAvailable
        ? `${logVehicle.year} ${logVehicle.make} ${logVehicle.model} processed & moved to AVAILABLE on yard!`
        : `Dismantling log saved for ${logVehicle.year} ${logVehicle.make} ${logVehicle.model}`
    );
  };

  const handleConfirmRemoveVehicle = () => {
    if (!deletingVehicle) return;
    storageService.deletePullYardVehicle(deletingVehicle.id);
    loadData();
    toast.success(`Removed ${deletingVehicle.year} ${deletingVehicle.make} ${deletingVehicle.model} from database`);
    setDeletingVehicle(null);
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = vehSearch.toLowerCase();
    const matchesSearch =
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      (v.originSource && v.originSource.toLowerCase().includes(q)) ||
      (v.notes && v.notes.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "ALL" ? true : v.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredParts = parts.filter((p) => {
    const q = partSearch.toLowerCase();
    return (
      p.partName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleIssueCoreRefund = () => {
    if (!coreCustName.trim()) {
      toast.error("Customer name is required for core refund");
      return;
    }
    const currentOp = storageService.getSettings().operatorName;
    const newLog: CoreReturnLog = {
      id: `core-${Date.now()}`,
      customerName: coreCustName,
      customerIdNumber: coreCustId || "DL-VERIFIED",
      partName: corePartName,
      coreDepositRefunded: coreDeposit,
      returnedAt: new Date().toISOString(),
      operatorName: currentOp,
    };

    storageService.saveCoreReturn(newLog);
    loadData();
    setCoreModalOpen(false);
    toast.success(`Issued $${coreDeposit.toFixed(2)} Core Deposit Refund Voucher to ${coreCustName}`);
    setCoreCustName("");
    setCoreCustId("");
  };

  const handleIssuePass = () => {
    if (!passCustName.trim()) {
      toast.error("Puller name is required for yard admission pass");
      return;
    }
    if (!waiverSigned) {
      toast.error("Customer must accept safety liability waiver");
      return;
    }

    const currentOp = storageService.getSettings().operatorName;
    const newPass: AdmissionPass = {
      id: `pass-${Date.now()}`,
      customerName: passCustName,
      customerIdNumber: passCustId || "DL-VERIFIED",
      passDate: new Date().toISOString(),
      feePaid: 2.00,
      waiverSigned: true,
      operatorName: currentOp,
    };

    storageService.saveAdmissionPass(newPass);
    loadData();
    setPassModalOpen(false);
    toast.success(`Issued $2.00 Gate Pass Wristband for ${passCustName}!`);
    setPassCustName("");
    setPassCustId("");
  };

  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const pendingCount = vehicles.filter((v) => v.status === "PENDING").length;
  const crushedCount = vehicles.filter((v) => v.status === "CRUSHED").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <input
        type="file"
        ref={vinCameraRef}
        onChange={handleVinPhotoUpload}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Wrench className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Parts Processor & Yard Workstation
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  DISMANTLING & INVENTORY
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Log removed cats, wheels, drained fluids & notes. Move vehicles from PENDING to AVAILABLE or CRUSHED.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setInterchangeModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs gap-1.5 shadow-md"
            >
              <Layers3 className="w-4 h-4 text-amber-300" /> Parts Interchange Search
            </Button>
            <Button
              onClick={() => setBulkUploadOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300" /> Bulk Add CSV
            </Button>
            <Button
              onClick={handleOpenAddVeh}
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs gap-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" /> Single Car
            </Button>
            <Button
              onClick={() => setPassModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-1.5 shadow-lg shadow-amber-950"
            >
              <TicketIcon className="w-4 h-4" /> Issue $2.00 Gate Pass
            </Button>
            <Button
              onClick={() => setCoreModalOpen(true)}
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400" /> Core Refund
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card
            onClick={() => setStatusFilter("ALL")}
            className={`cursor-pointer transition-all ${
              statusFilter === "ALL"
                ? "bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/40"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            } text-white`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">All Yard Vehicles</p>
                <p className="text-2xl font-black text-white font-mono mt-0.5">{vehicles.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Total registered</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                <Car className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setStatusFilter("PENDING")}
            className={`cursor-pointer transition-all ${
              statusFilter === "PENDING"
                ? "bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/40"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            } text-white`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-400 font-medium">Pending Tow Intake</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{pendingCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Needs parts/fluid processing</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setStatusFilter("AVAILABLE")}
            className={`cursor-pointer transition-all ${
              statusFilter === "AVAILABLE"
                ? "bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/40"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            } text-white`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">Available On Yard</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{availableCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ready for pullers</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setStatusFilter("CRUSHED")}
            className={`cursor-pointer transition-all ${
              statusFilter === "CRUSHED"
                ? "bg-slate-900 border-rose-500/60 ring-1 ring-rose-500/40"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            } text-white`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-400 font-medium">Crushed / Stripped</p>
                <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">{crushedCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Archived / Bailer</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Flame className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs Suite */}
        <Tabs defaultValue="finder" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger value="finder" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs gap-1.5">
              <Car className="w-3.5 h-3.5" /> Yard Vehicle Inventory & Dismantling Workstation ({vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Flat Parts Price Catalog ({parts.length})
            </TabsTrigger>
            <TabsTrigger value="cores" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Core Deposit Refunds ({cores.length})
            </TabsTrigger>
            <TabsTrigger value="passes" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs gap-1.5">
              <TicketIcon className="w-3.5 h-3.5" /> Gate Admission Passes ({passes.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VEHICLE YARD WORKSTATION & DISMANTLING TABLE */}
          <TabsContent value="finder" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter Status:</span>
                  {[
                    { id: "ALL", label: "All Vehicles", count: vehicles.length },
                    { id: "PENDING", label: "Pending (Tow Intake)", count: pendingCount, color: "text-amber-400" },
                    { id: "AVAILABLE", label: "Available (On Yard)", count: availableCount, color: "text-emerald-400" },
                    { id: "CRUSHED", label: "Crushed", count: crushedCount, color: "text-rose-400" },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      size="sm"
                      variant={statusFilter === tab.id ? "default" : "outline"}
                      onClick={() => setStatusFilter(tab.id as any)}
                      className={`text-xs h-8 ${
                        statusFilter === tab.id
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {tab.label} <span className="ml-1 opacity-80 font-mono">({tab.count})</span>
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input
                      placeholder="Search vehicle, VIN, origin..."
                      value={vehSearch}
                      onChange={(e) => setVehSearch(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-xs pl-8 w-64"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setBulkUploadOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1 shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" /> Bulk Add CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenAddVeh}
                    className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" /> Single Car
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Photo</TableHead>
                      <TableHead className="text-slate-400">Yard Section</TableHead>
                      <TableHead className="text-slate-400">Vehicle Specs & VIN</TableHead>
                      <TableHead className="text-slate-400">Payout & Origin</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Dismantling & Fluid Log</TableHead>
                      <TableHead className="text-slate-400">Driver & Processor Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs font-sans">
                          No vehicles found matching search and status filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVehicles.map((v) => (
                        <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                          
                          {/* Photo Thumbnail */}
                          <TableCell className="w-16 p-2">
                            <div className="w-12 h-10 rounded-lg bg-slate-950 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                              {v.photoUrl ? (
                                <img src={v.photoUrl} alt="Vehicle thumbnail" className="w-full h-full object-cover" />
                              ) : (
                                <Car className="w-5 h-5 text-slate-600" />
                              )}
                            </div>
                          </TableCell>

                          {/* Section */}
                          <TableCell className="font-sans font-bold text-amber-300">
                            {v.section}
                          </TableCell>

                          {/* Specs & VIN */}
                          <TableCell className="font-sans">
                            <span className="font-bold text-white block">{v.year} {v.make} {v.model}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{v.vin}</span>
                          </TableCell>

                          {/* Payout & Origin */}
                          <TableCell className="font-sans">
                            <span className="font-bold text-emerald-400 block">${v.purchasePrice ? v.purchasePrice.toFixed(2) : '0.00'}</span>
                            <span className="text-[10px] text-slate-400 max-w-[120px] truncate block" title={v.originSource || 'Tow Intake'}>
                              {v.originSource || 'Tow Intake'}
                            </span>
                          </TableCell>

                          {/* Status Selector */}
                          <TableCell className="font-sans">
                            <select
                              value={v.status}
                              onChange={(e) => handleStatusChange(v, e.target.value as PullYardVehicleStatus)}
                              className={`h-7 px-2 text-[10px] font-extrabold rounded border font-mono uppercase cursor-pointer ${
                                v.status === "PENDING"
                                  ? "bg-amber-950 text-amber-300 border-amber-800"
                                  : v.status === "AVAILABLE"
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border-rose-800"
                              }`}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="CRUSHED">CRUSHED</option>
                            </select>
                          </TableCell>

                          {/* Dismantling & Fluid Summary */}
                          <TableCell className="font-sans">
                            <div className="space-y-1 text-[10px]">
                              <div className="flex items-center gap-1">
                                <span className="text-amber-400 font-bold">Cats: {v.dismantlingLog.catalyticConvertersRemoved}</span>
                                <span className="text-slate-500">|</span>
                                <span className="text-sky-400 font-bold">Wheels: {v.dismantlingLog.wheelsRemoved}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={v.dismantlingLog.gasDrained ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                                  Gas: {v.dismantlingLog.gasDrained ? "Drained" : "No"}
                                </span>
                                <span className="text-slate-500">|</span>
                                <span className={v.dismantlingLog.oilDrained ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                                  Oil: {v.dismantlingLog.oilDrained ? "Drained" : "No"}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Notes Section Display */}
                          <TableCell className="font-sans max-w-xs">
                            <div className="space-y-1 text-[10px]">
                              {v.notes && (
                                <p className="text-amber-300/90 truncate" title={v.notes}>
                                  <span className="font-bold text-amber-400">Driver:</span> {v.notes}
                                </p>
                              )}
                              {v.dismantlingLog.notes && (
                                <p className="text-sky-300/90 truncate" title={v.dismantlingLog.notes}>
                                  <span className="font-bold text-sky-400">Processor:</span> {v.dismantlingLog.notes}
                                </p>
                              )}
                              {!v.notes && !v.dismantlingLog.notes && (
                                <span className="text-slate-600 italic">No notes</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Action Buttons */}
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              onClick={() => handleOpenPullLog(v)}
                              className="h-7 text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 gap-1"
                              title="Log Pulled Parts & Fluids"
                            >
                              <Wrench className="w-3 h-3" /> Log Parts
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditVeh(v)}
                              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
                              title="Edit Vehicle Details"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedVehForTicket(v)}
                              className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                              title="Print Yard Pass"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingVehicle(v)}
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50"
                              title="Delete Vehicle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>

                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: FLAT PARTS PRICE SHEET */}
          <TabsContent value="catalog" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" /> Pull-A-Part Flat Part Price & Core Deposit Sheet
                  </CardTitle>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <Input
                    placeholder="Search part name or category..."
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs pl-8 w-64"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Part Category</TableHead>
                      <TableHead className="text-slate-400">Part Description</TableHead>
                      <TableHead className="text-slate-400">Interchange Notes</TableHead>
                      <TableHead className="text-slate-400 text-right">Core Deposit ($)</TableHead>
                      <TableHead className="text-slate-400 text-right">Warranty Fee ($)</TableHead>
                      <TableHead className="text-slate-400 text-right">Part Price ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParts.map((part) => (
                      <TableRow key={part.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-sans">
                          <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                            {part.category}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-sans font-bold text-white text-sm">
                          {part.partName}
                          {part.isPopular && (
                            <Badge className="ml-2 bg-amber-950 text-amber-300 border-amber-800 text-[9px]">POPULAR</Badge>
                          )}
                        </TableCell>

                        <TableCell className="font-sans text-slate-400 text-[11px] max-w-xs truncate">
                          {part.interchangeNotes}
                        </TableCell>

                        <TableCell className="text-right text-amber-400 font-bold">
                          {part.coreDeposit > 0 ? `+$${part.coreDeposit.toFixed(2)}` : "-"}
                        </TableCell>

                        <TableCell className="text-right text-slate-400">
                          {part.warrantyFee > 0 ? `+$${part.warrantyFee.toFixed(2)}` : "Included"}
                        </TableCell>

                        <TableCell className="text-right font-black text-emerald-400 text-base">
                          ${part.price.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CORE RETURN REFUNDS */}
          <TabsContent value="cores" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-emerald-400" /> Customer Core Deposit Refund Desk
                  </CardTitle>
                </div>
                <Button
                  onClick={() => setCoreModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Process Core Deposit Refund
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Returned Timestamp</TableHead>
                      <TableHead className="text-slate-400">Customer Name</TableHead>
                      <TableHead className="text-slate-400">ID Number</TableHead>
                      <TableHead className="text-slate-400">Core Component</TableHead>
                      <TableHead className="text-slate-400">Operator</TableHead>
                      <TableHead className="text-right text-slate-400">Refund Amount ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cores.map((c) => (
                      <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="text-slate-300">
                          {new Date(c.returnedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-sans font-bold text-white">{c.customerName}</TableCell>
                        <TableCell className="text-slate-400">{c.customerIdNumber || "Verified"}</TableCell>
                        <TableCell className="font-sans text-amber-300">{c.partName}</TableCell>
                        <TableCell className="font-sans text-slate-400">{c.operatorName}</TableCell>
                        <TableCell className="text-right font-black text-emerald-400 text-sm">
                          +${c.coreDepositRefunded.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ADMISSION PASSES */}
          <TabsContent value="passes" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <TicketIcon className="w-5 h-5 text-purple-400" /> Pull-A-Part $2.00 Yard Gate Admission Wristbands
                  </CardTitle>
                </div>
                <Button
                  onClick={() => setPassModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Issue Gate Pass
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Pass Serial</TableHead>
                      <TableHead className="text-slate-400">Pass Timestamp</TableHead>
                      <TableHead className="text-slate-400">Puller Customer Name</TableHead>
                      <TableHead className="text-slate-400">ID Credentials</TableHead>
                      <TableHead className="text-slate-400">Safety Waiver Status</TableHead>
                      <TableHead className="text-right text-slate-400">Fee Paid ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passes.map((p) => (
                      <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-bold text-purple-300">{p.id}</TableCell>
                        <TableCell className="text-slate-300">{new Date(p.passDate).toLocaleTimeString()}</TableCell>
                        <TableCell className="font-sans font-bold text-white">{p.customerName}</TableCell>
                        <TableCell className="text-slate-400">{p.customerIdNumber}</TableCell>
                        <TableCell className="font-sans">
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] gap-1">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" /> WAIVER SIGNED
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-400">${p.feePaid.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </main>

      {/* Add / Edit Vehicle Modal */}
      <Dialog open={vehModalOpen} onOpenChange={setVehModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-emerald-400" /> {editingVeh ? "Edit Yard Vehicle" : "Add Vehicle to Yard"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-slate-300">Year *</Label>
                <Input
                  type="number"
                  value={vehYear}
                  onChange={(e) => setVehYear(parseInt(e.target.value) || 2010)}
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Make *</Label>
                <Input
                  value={vehMake}
                  onChange={(e) => setVehMake(e.target.value)}
                  placeholder="Ford"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Model *</Label>
                <Input
                  value={vehModel}
                  onChange={(e) => setVehModel(e.target.value)}
                  placeholder="F-150"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>

            {/* VIN Field with Photo OCR & Skip No VIN */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 font-bold">VIN Number</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleSkipVin}
                  className="h-6 text-[11px] text-rose-400 hover:text-rose-300 gap-1 p-0"
                >
                  <Ban className="w-3 h-3" /> Skip / No VIN
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={vehVin}
                  onChange={(e) => setVehVin(e.target.value.toUpperCase())}
                  placeholder="1FTRF12W88KA10291 or NO-VIN"
                  className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => vinCameraRef.current?.click()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1 shrink-0"
                >
                  <Scan className="w-3.5 h-3.5" /> VIN Photo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Color</Label>
                <Input
                  value={vehColor}
                  onChange={(e) => setVehColor(e.target.value)}
                  placeholder="White"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Purchase Price ($)</Label>
                <Input
                  type="number"
                  value={vehPurchasePrice}
                  onChange={(e) => setVehPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Tow Origin / Source</Label>
                <Input
                  value={vehOriginSource}
                  onChange={(e) => setVehOriginSource(e.target.value)}
                  placeholder="e.g. Tow Drop / Address"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Yard Section</Label>
                <select
                  value={vehSection}
                  onChange={(e) => setVehSection(e.target.value as any)}
                  className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</option>
                  <option value="Ford & Lincoln">Ford & Lincoln</option>
                  <option value="GM & Chevrolet">GM & Chevrolet</option>
                  <option value="Chrysler & Dodge">Chrysler & Dodge</option>
                  <option value="Asian Imports">Asian Imports</option>
                  <option value="European">European</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Status</Label>
              <select
                value={vehStatus}
                onChange={(e) => setVehStatus(e.target.value as any)}
                className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1 font-mono font-bold"
              >
                <option value="PENDING">PENDING</option>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="CRUSHED">CRUSHED</option>
              </select>
            </div>

            <div>
              <Label className="text-slate-300">Tow Driver Notes</Label>
              <Input
                value={vehNotes}
                onChange={(e) => setVehNotes(e.target.value)}
                placeholder="Condition notes..."
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Remaining Parts List (Comma Separated)</Label>
              <Input
                value={vehParts}
                onChange={(e) => setVehParts(e.target.value)}
                placeholder="Engine, Transmission, Doors, Wheels, Fenders"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setVehModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSaveVeh} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              {editingVeh ? "Update Vehicle" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parts Interchange Search Modal */}
      <PartsInterchangeModal
        isOpen={interchangeModalOpen}
        onClose={() => setInterchangeModalOpen(false)}
      />

      {/* Bulk Spreadsheet Upload Modal */}
      <BulkVehicleUploadModal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploadSuccess={loadData}
      />
    </div>
  );
}