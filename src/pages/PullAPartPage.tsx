import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import {
  PullYardVehicle,
  PullPartItem,
  CoreReturnLog,
  AdmissionPass,
  PullYardVehicleStatus,
} from "@/types/scrap";
import { generateSamplePhoto } from "@/utils/complianceUtils";
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
      vin: vehVin.toUpperCase().trim(),
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

  // Filter vehicles
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
              onClick={() => setBulkUploadOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300" /> Bulk Add Spreadsheet (CSV)
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

      {/* Dismantling & Parts Pull Logger Modal */}
      {logVehicle && (
        <Dialog open={!!logVehicle} onOpenChange={() => setLogVehicle(null)}>
          <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" /> Parts Dismantling & Processing Logger
              </DialogTitle>
              <p className="text-xs text-slate-400 font-mono">
                {logVehicle.year} {logVehicle.make} {logVehicle.model} ({logVehicle.section})
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              
              {/* Catalytic Converters Removed Counter */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">Catalytic Converters Removed</span>
                  <span className="text-[10px] text-slate-400">Count of cats harvested</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCatsRemoved((c) => Math.max(0, c - 1))}
                    className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white font-bold"
                  >
                    -
                  </Button>
                  <span className="font-mono font-bold text-lg text-amber-400 w-6 text-center">{catsRemoved}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCatsRemoved((c) => c + 1)}
                    className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white font-bold"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Wheels Removed Counter */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">Wheels Removed</span>
                  <span className="text-[10px] text-slate-400">Rims / tires pulled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setWheelsRemoved((w) => Math.max(0, w - 1))}
                    className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white font-bold"
                  >
                    -
                  </Button>
                  <span className="font-mono font-bold text-lg text-sky-400 w-6 text-center">{wheelsRemoved}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setWheelsRemoved((w) => Math.min(8, w + 1))}
                    className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-white font-bold"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Fluids Drained Switches */}
              <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-amber-400" /> Gas Drained
                  </span>
                  <Switch
                    checked={gasDrained}
                    onCheckedChange={setGasDrained}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-amber-400" /> Oil Drained
                  </span>
                  <Switch
                    checked={oilDrained}
                    onCheckedChange={setOilDrained}
                  />
                </div>
              </div>

              {/* Processor Notes Section */}
              <div className="space-y-1">
                <Label className="text-slate-300 font-semibold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-sky-400" /> Processor Dismantling Notes
                </Label>
                <Textarea
                  rows={3}
                  value={processorNotes}
                  onChange={(e) => setProcessorNotes(e.target.value)}
                  placeholder="e.g. Pulled 5.4L engine block & transmission, OEM cats removed, battery stored in vault..."
                  className="bg-slate-900 border-slate-800 text-slate-200 text-xs"
                />
              </div>

            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                onClick={() => setLogVehicle(null)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSavePullLog(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Save Dismantling Log
              </Button>
              <Button
                onClick={() => handleSavePullLog(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1"
              >
                <Check className="w-4 h-4" /> Save & Move to Yard (Set Available)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVehicle && (
        <Dialog open={!!deletingVehicle} onOpenChange={() => setDeletingVehicle(null)}>
          <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Remove Vehicle from Yard?
              </DialogTitle>
            </DialogHeader>

            <div className="py-2 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to completely remove <strong className="text-white">{deletingVehicle.year} {deletingVehicle.make} {deletingVehicle.model}</strong> ({deletingVehicle.vin}) from the yard database?
              </p>
              <p className="text-rose-400 text-[11px]">This action cannot be undone.</p>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setDeletingVehicle(null)} className="text-slate-400 text-xs">
                Cancel
              </Button>
              <Button onClick={handleConfirmRemoveVehicle} className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs">
                Delete Vehicle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit Vehicle Modal */}
      <Dialog open={vehModalOpen} onOpenChange={setVehModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[520px]">
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
                <Label className="text-slate-300">VIN Number</Label>
                <Input
                  value={vehVin}
                  onChange={(e) => setVehVin(e.target.value)}
                  placeholder="1FTRF12W88KA10291"
                  className="bg-slate-900 border-slate-800 text-amber-300 font-mono text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Purchase Price ($)</Label>
                <Input
                  type="number"
                  value={vehPurchasePrice}
                  onChange={(e) => setVehPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Tow Origin / Source</Label>
                <Input
                  value={vehOriginSource}
                  onChange={(e) => setVehOriginSource(e.target.value)}
                  placeholder="e.g. Tow Drop / Address"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
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

      {/* Core Refund Modal */}
      <Dialog open={coreModalOpen} onOpenChange={setCoreModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-emerald-400" /> Core Deposit Cash Refund
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Customer Full Name *</Label>
              <Input
                value={coreCustName}
                onChange={(e) => setCoreCustName(e.target.value)}
                placeholder="e.g. Robert Henderson"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Driver License / Photo ID #</Label>
              <Input
                value={coreCustId}
                onChange={(e) => setCoreCustId(e.target.value)}
                placeholder="e.g. DL-9823145-GA"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Core Component Returned</Label>
              <Input
                value={corePartName}
                onChange={(e) => setCorePartName(e.target.value)}
                className="bg-slate-900 border-slate-800 text-amber-300 font-medium text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Core Refund Amount ($) *</Label>
              <Input
                type="number"
                value={coreDeposit}
                onChange={(e) => setCoreDeposit(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-bold font-mono text-base mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setCoreModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleIssueCoreRefund} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              Issue Refund Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gate Admission Pass Modal */}
      <Dialog open={passModalOpen} onOpenChange={setPassModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-amber-400" /> $2.00 Yard Gate Admission Wristband
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Yard Puller Full Name *</Label>
              <Input
                value={passCustName}
                onChange={(e) => setPassCustName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Driver License / ID #</Label>
              <Input
                value={passCustId}
                onChange={(e) => setPassCustId(e.target.value)}
                placeholder="e.g. ID-881920-GA"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="waiver"
                  checked={waiverSigned}
                  onCheckedChange={(c) => setWaiverSigned(!!c)}
                />
                <label htmlFor="waiver" className="text-[11px] font-semibold text-slate-200 cursor-pointer">
                  Puller signs yard safety goggles & waiver agreement
                </label>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                No jacks, torches, or open toes allowed. Puller enters yard at own risk.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setPassModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleIssuePass} className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold">
              Issue $2.00 Wristband Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Vehicle Ticket Modal */}
      {selectedVehForTicket && (
        <Dialog open={!!selectedVehForTicket} onOpenChange={() => setSelectedVehForTicket(null)}>
          <DialogContent className="bg-white text-slate-900 sm:max-w-[420px] font-mono text-xs">
            <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
              <h2 className="text-lg font-black tracking-tight uppercase">APEX PULL-A-PART YARD PASS</h2>
              <p className="text-[10px]">VEHICLE LOCATOR & PARTS GUIDE</p>
            </div>

            <div className="space-y-3 py-2">
              <div className="bg-slate-100 p-3 rounded border border-slate-300 text-center">
                <span className="text-[10px] font-bold text-slate-500 block">YARD SECTION</span>
                <span className="text-xl font-black text-slate-900">{selectedVehForTicket.section}</span>
              </div>

              <div className="space-y-1 text-[11px]">
                <p><span className="font-bold">VEHICLE:</span> {selectedVehForTicket.year} {selectedVehForTicket.make} {selectedVehForTicket.model}</p>
                <p><span className="font-bold">COLOR:</span> {selectedVehForTicket.color}</p>
                <p><span className="font-bold">VIN:</span> {selectedVehForTicket.vin}</p>
                <p><span className="font-bold">STATUS:</span> {selectedVehForTicket.status}</p>
                {selectedVehForTicket.originSource && (
                  <p><span className="font-bold">ORIGIN:</span> {selectedVehForTicket.originSource}</p>
                )}
                {selectedVehForTicket.purchasePrice && (
                  <p><span className="font-bold">PAYOUT:</span> ${selectedVehForTicket.purchasePrice.toFixed(2)}</p>
                )}
                <p><span className="font-bold">SET DATE:</span> {new Date(selectedVehForTicket.dateSetInYard).toLocaleDateString()}</p>
              </div>

              {selectedVehForTicket.notes && (
                <div className="border-t border-slate-300 pt-2 text-[10px]">
                  <p className="font-bold text-slate-700">DRIVER NOTES:</p>
                  <p className="text-slate-800">{selectedVehForTicket.notes}</p>
                </div>
              )}

              {selectedVehForTicket.dismantlingLog.notes && (
                <div className="border-t border-slate-300 pt-2 text-[10px]">
                  <p className="font-bold text-slate-700">PROCESSOR NOTES:</p>
                  <p className="text-slate-800">{selectedVehForTicket.dismantlingLog.notes}</p>
                </div>
              )}

              <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-600">
                <p className="font-bold">PARTS AVAILABLE:</p>
                <p>{selectedVehForTicket.partsRemaining.join(", ")}</p>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-300">
              <Button onClick={() => window.print()} className="w-full bg-slate-900 text-white font-bold text-xs">
                <Printer className="w-4 h-4 mr-1.5" /> Print Locator Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Spreadsheet Upload Modal */}
      <BulkVehicleUploadModal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploadSuccess={loadData}
      />
    </div>
  );
}
</dyad-file>

Now let's update `PublicInventoryPage.tsx` to remove Row and Space references from searching, cards, and locator passes.<dyad-write path="src/pages/PublicInventoryPage.tsx" description="Removing Row and Space references from PublicInventoryPage">
import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { PullYardVehicle } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Car,
  Search,
  Sparkles,
  Printer,
  Wrench,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Bell,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function PublicInventoryPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [partFilter, setPartFilter] = useState<string>("ALL");
  const [selectedVehicle, setSelectedVehicle] = useState<PullYardVehicle | null>(null);

  // Notify Me Request State
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [reqMake, setReqMake] = useState("Honda");
  const [reqModel, setReqModel] = useState("Civic");
  const [reqPhone, setReqPhone] = useState("");

  const loadData = () => {
    setVehicles(storageService.getPullYardVehicles());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.vin.toLowerCase().includes(q);

    const matchesSection = selectedSection === "ALL" ? true : v.section === selectedSection;

    const matchesPart =
      partFilter === "ALL"
        ? true
        : v.partsRemaining.some((p) => p.toLowerCase().includes(partFilter.toLowerCase()));

    return matchesSearch && matchesSection && matchesPart;
  });

  const handleSendNotifyRequest = () => {
    if (!reqPhone.trim()) {
      toast.error("Please enter a contact phone or email");
      return;
    }
    toast.success(`Vehicle Alert Created for ${reqMake} ${reqModel}!`, {
      description: "We will SMS text you the moment this vehicle passes through the intake scale desk.",
    });
    setNotifyOpen(false);
    setReqPhone("");
  };

  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono uppercase tracking-widest px-3 py-1">
                  LIVE YARD CATALOG
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono">
                  UPDATED EVERY 15 MIN
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Public Vehicle Inventory & Part Locator
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Search self-service harvest vehicles staged on the lot. See available components, photos, and fresh vehicle arrivals.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Button
                onClick={() => setNotifyOpen(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 h-10 gap-1.5 shadow-lg shadow-amber-950"
              >
                <Bell className="w-4 h-4" /> Request Vehicle Alert
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Search & Filtering Bar */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Text Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search Year, Make, Model, or VIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs pl-9 h-10"
                />
              </div>

              {/* Yard Section Filter */}
              <div>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-10">
                    <SelectValue placeholder="All Yard Sections" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="ALL">All Yard Sections ({vehicles.length} Vehicles)</SelectItem>
                    <SelectItem value="Domestic Trucks & SUVs">Domestic Trucks & SUVs</SelectItem>
                    <SelectItem value="Ford & Lincoln">Ford & Lincoln</SelectItem>
                    <SelectItem value="GM & Chevrolet">GM & Chevrolet</SelectItem>
                    <SelectItem value="Asian Imports">Asian Imports</SelectItem>
                    <SelectItem value="Chrysler & Dodge">Chrysler & Dodge</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Specific Part Component Filter */}
              <div>
                <Select value={partFilter} onValueChange={setPartFilter}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-10">
                    <SelectValue placeholder="Filter by Needed Component" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="ALL">All Available Components</SelectItem>
                    <SelectItem value="Engine">Engine / Short Block</SelectItem>
                    <SelectItem value="Transmission">Transmission</SelectItem>
                    <SelectItem value="Doors">Doors & Panels</SelectItem>
                    <SelectItem value="Wheels">Alloy Wheels & Rims</SelectItem>
                    <SelectItem value="Headlights">Headlights / Lenses</SelectItem>
                    <SelectItem value="Fenders">Fenders / Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Vehicle Catalog Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" /> Currently Staged Vehicles ({filteredVehicles.length})
            </h2>
            <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs font-mono">
              {availableCount} Available Vehicles On Lot
            </Badge>
          </div>

          {filteredVehicles.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 text-slate-400 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">No vehicles found matching your criteria</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search filters or set a vehicle request alert to get notified when a matching car enters the intake station.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedSection("ALL");
                  setPartFilter("ALL");
                }}
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
              >
                Clear All Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((veh) => {
                const daysAgo = Math.floor(
                  (Date.now() - new Date(veh.dateSetInYard).getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <Card
                    key={veh.id}
                    onClick={() => setSelectedVehicle(veh)}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-amber-500/70 transition-all duration-200 cursor-pointer shadow-xl overflow-hidden flex flex-col justify-between"
                  >
                    <CardHeader className="py-4 px-5 bg-slate-950/80 border-b border-slate-800 flex flex-row items-start justify-between">
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                          {veh.section}
                        </Badge>
                        <CardTitle className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                          {veh.year} {veh.make} {veh.model}
                        </CardTitle>
                        <p className="text-xs text-slate-400 font-mono">
                          Color: <span className="text-slate-200">{veh.color}</span>
                        </p>
                      </div>

                      {/* Photo Thumbnail or Badge */}
                      <div className="text-right shrink-0">
                        <div className="w-16 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                          {veh.photoUrl ? (
                            <img src={veh.photoUrl} alt="Vehicle thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <Car className="w-6 h-6 text-slate-600" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4 flex-1">
                      {/* Status Badges */}
                      <div className="flex items-center justify-between text-xs">
                        {veh.status === "AVAILABLE" ? (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px] gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" /> AVAILABLE ({daysAgo === 0 ? "Today" : `${daysAgo}d ago`})
                          </Badge>
                        ) : veh.status === "PENDING" ? (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-[10px]">
                            PENDING INTAKE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-800 text-rose-400 text-[10px]">
                            CRUSHED / STRIPPED
                          </Badge>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono truncate max-w-[120px]">
                          VIN: {veh.vin.slice(0, 11)}...
                        </span>
                      </div>

                      {/* Parts Available checklist */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Available Components ({veh.partsRemaining.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {veh.partsRemaining.map((part, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                            >
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:bg-amber-950/30 transition-colors">
                      <span>View Vehicle Details Pass</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Vehicle Detailed Location & Printable Ticket Modal */}
      {selectedVehicle && (
        <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border-slate-800 p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                  {selectedVehicle.section}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-white mt-2">
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Self-Service Vehicle Locator & Component Sheet
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Color:</span>
                  <span className="text-white font-bold">{selectedVehicle.color}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Full VIN:</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date Set In Yard:</span>
                  <span className="text-slate-200">{new Date(selectedVehicle.dateSetInYard).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Available Parts Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Intact Parts Available for Harvesting:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {selectedVehicle.partsRemaining.map((part, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center gap-1.5 text-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{part}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules Reminder */}
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-[11px] text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Yard Safety Rules:
                </div>
                <p className="text-slate-300">
                  Must wear closed-toe boots & safety glasses. Jacks, torches, and power cutting saws are strictly prohibited on the lot.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800">
              <Button onClick={() => window.print()} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5">
                <Printer className="w-4 h-4" /> Print / Save Vehicle Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Request Vehicle Alert Modal */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Create Vehicle Arrival Alert
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              We'll send an instant text message the moment a matching vehicle passes through the intake station.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Make *</label>
                <Input
                  value={reqMake}
                  onChange={(e) => setReqMake(e.target.value)}
                  placeholder="e.g. Honda"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vehicle Model *</label>
                <Input
                  value={reqModel}
                  onChange={(e) => setReqModel(e.target.value)}
                  placeholder="e.g. Civic"
                  className="bg-slate-900 border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">SMS Mobile Phone # *</label>
              <Input
                value={reqPhone}
                onChange={(e) => setReqPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="bg-slate-900 border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSendNotifyRequest} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
              Subscribe Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}