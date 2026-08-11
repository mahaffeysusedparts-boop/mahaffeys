import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import {
  PullYardVehicle,
  PullPartItem,
  CoreReturnLog,
  AdmissionPass,
} from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Wrench,
  Car,
  Search,
  DollarSign,
  Ticket as TicketIcon,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

export default function PullAPartPage() {
  const [vehicles, setVehicles] = useState<PullYardVehicle[]>([]);
  const [parts, setParts] = useState<PullPartItem[]>([]);
  const [cores, setCores] = useState<CoreReturnLog[]>([]);
  const [passes, setPasses] = useState<AdmissionPass[]>([]);

  // Search states
  const [vehSearch, setVehSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");

  // Vehicle Add / Edit Modal
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [editingVeh, setEditingVeh] = useState<PullYardVehicle | null>(null);

  const [vehRow, setVehRow] = useState("Row 104");
  const [vehSpace, setVehSpace] = useState("Space 12");
  const [vehSection, setVehSection] = useState<PullYardVehicle["section"]>("Domestic Trucks & SUVs");
  const [vehYear, setVehYear] = useState(2010);
  const [vehMake, setVehMake] = useState("Ford");
  const [vehModel, setVehModel] = useState("F-150");
  const [vehColor, setVehColor] = useState("White");
  const [vehVin, setVehVin] = useState("1FTRF12W88KA10291");
  const [vehStatus, setVehStatus] = useState<PullYardVehicle["status"]>("FRESH_SET");
  const [vehParts, setVehParts] = useState("Engine Assembly, Transmission, Doors, Fenders, Alloy Wheels");

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
    setVehRow("Row 104");
    setVehSpace("Space 01");
    setVehYear(2012);
    setVehMake("Chevrolet");
    setVehModel("Silverado 1500");
    setVehColor("Black");
    setVehVin("1G1JC524317109281");
    setVehSection("GM & Chevrolet");
    setVehStatus("FRESH_SET");
    setVehParts("Engine Assembly, Automatic Transmission, Doors, Hood, Tailgate");
    setVehModalOpen(true);
  };

  const handleOpenEditVeh = (v: PullYardVehicle) => {
    setEditingVeh(v);
    setVehRow(v.rowNumber);
    setVehSpace(v.spaceNumber);
    setVehSection(v.section);
    setVehYear(v.year);
    setVehMake(v.make);
    setVehModel(v.model);
    setVehColor(v.color);
    setVehVin(v.vin);
    setVehStatus(v.status);
    setVehParts(v.partsRemaining.join(", "));
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
      rowNumber: vehRow,
      spaceNumber: vehSpace,
      section: vehSection,
      year: vehYear,
      make: vehMake,
      model: vehModel,
      color: vehColor,
      vin: vehVin.toUpperCase().trim(),
      dateSetInYard: editingVeh ? editingVeh.dateSetInYard : new Date().toISOString(),
      status: vehStatus,
      partsRemaining: partsList.length > 0 ? partsList : ["Bare Body Shell"],
    };

    storageService.savePullYardVehicle(vehObj);
    loadData();
    setVehModalOpen(false);
    toast.success(`${editingVeh ? "Updated" : "Added"} ${vehYear} ${vehMake} ${vehModel} on ${vehRow}!`);
  };

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const q = vehSearch.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.year.toString().includes(q) ||
      v.rowNumber.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q)
    );
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

  const freshSetCount = vehicles.filter((v) => v.status === "FRESH_SET").length;

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
                  Pull-A-Part Self-Service Yard Suite
                </h1>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                  ROW & PARTS DISPATCH
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Self-service vehicle row locator, flat parts price catalog, core deposit refunds & gate admission passes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenAddVeh}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Car to Row
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
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Vehicles Staged in Yard</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{vehicles.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Across all Row sections</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Car className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Fresh Set Vehicles (&lt;7 Days)</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{freshSetCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">High component availability</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Part Catalog Items</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-0.5">{parts.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Flat parts price sheet</p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Today's Gate Passes</p>
                <p className="text-2xl font-black text-purple-400 font-mono mt-0.5">{passes.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Wristbands issued ($2/ea)</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <TicketIcon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs Suite */}
        <Tabs defaultValue="finder" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger value="finder" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs gap-1.5">
              <Car className="w-3.5 h-3.5" /> Yard Vehicle Row Finder ({vehicles.length})
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

          {/* TAB 1: VEHICLE ROW FINDER */}
          <TabsContent value="finder" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-amber-400" /> Self-Service Puller Vehicle Row Finder
                  </CardTitle>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input
                      placeholder="Search Ford, Impala, Row 104..."
                      value={vehSearch}
                      onChange={(e) => setVehSearch(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-xs pl-8 w-64"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleOpenAddVeh}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Car
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Yard Location</TableHead>
                      <TableHead className="text-slate-400">Section</TableHead>
                      <TableHead className="text-slate-400">Vehicle Specs</TableHead>
                      <TableHead className="text-slate-400">VIN Number</TableHead>
                      <TableHead className="text-slate-400">Date Set In Yard</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Major Components Left</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((v) => (
                      <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-bold text-amber-300 text-sm">
                          {v.rowNumber}
                          <span className="block text-[10px] text-slate-400 font-normal">{v.spaceNumber}</span>
                        </TableCell>

                        <TableCell className="font-sans">
                          <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                            {v.section}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-sans">
                          <span className="font-bold text-white block">{v.year} {v.make} {v.model}</span>
                          <span className="text-[10px] text-slate-400">{v.color}</span>
                        </TableCell>

                        <TableCell className="text-slate-400 text-[11px]">{v.vin}</TableCell>

                        <TableCell className="text-slate-300">
                          {new Date(v.dateSetInYard).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="font-sans">
                          {v.status === "FRESH_SET" && (
                            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> FRESH SET
                            </Badge>
                          )}
                          {v.status === "POPULAR" && (
                            <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                              POPULAR
                            </Badge>
                          )}
                          {v.status === "STRIPPED_SHELL" && (
                            <Badge variant="outline" className="text-rose-400 border-rose-800 text-[10px]">
                              STRIPPED SHELL
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="font-sans max-w-xs truncate text-[11px] text-slate-300">
                          {v.partsRemaining.join(", ")}
                        </TableCell>

                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditVeh(v)}
                            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedVehForTicket(v)}
                            className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" /> Pass
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-emerald-400" /> {editingVeh ? "Edit Staged Vehicle" : "Add Vehicle to Yard Row"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Row Number *</Label>
                <Input
                  value={vehRow}
                  onChange={(e) => setVehRow(e.target.value)}
                  placeholder="Row 104"
                  className="bg-slate-900 border-slate-800 text-amber-300 font-mono font-bold text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Space Number</Label>
                <Input
                  value={vehSpace}
                  onChange={(e) => setVehSpace(e.target.value)}
                  placeholder="Space 12"
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>
            </div>

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
                  className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="FRESH_SET">FRESH SET</option>
                  <option value="POPULAR">POPULAR DEMAND</option>
                  <option value="STRIPPED_SHELL">STRIPPED SHELL</option>
                  <option value="READY_FOR_CRUSHER">READY FOR CRUSHER</option>
                </select>
              </div>
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

      {/* Printable Vehicle Row Pass Modal */}
      {selectedVehForTicket && (
        <Dialog open={!!selectedVehForTicket} onOpenChange={() => setSelectedVehForTicket(null)}>
          <DialogContent className="bg-white text-slate-900 sm:max-w-[420px] font-mono text-xs">
            <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
              <h2 className="text-lg font-black tracking-tight uppercase">APEX PULL-A-PART YARD PASS</h2>
              <p className="text-[10px]">VEHICLE ROW LOCATOR & PARTS GUIDE</p>
            </div>

            <div className="space-y-3 py-2">
              <div className="bg-slate-100 p-3 rounded border border-slate-300 text-center">
                <span className="text-[10px] font-bold text-slate-500 block">YARD STAGING LOCATION</span>
                <span className="text-2xl font-black text-slate-900">{selectedVehForTicket.rowNumber}</span>
                <span className="text-sm font-bold text-slate-700 block">{selectedVehForTicket.spaceNumber}</span>
              </div>

              <div className="space-y-1 text-[11px]">
                <p><span className="font-bold">VEHICLE:</span> {selectedVehForTicket.year} {selectedVehForTicket.make} {selectedVehForTicket.model}</p>
                <p><span className="font-bold">COLOR:</span> {selectedVehForTicket.color}</p>
                <p><span className="font-bold">VIN:</span> {selectedVehForTicket.vin}</p>
                <p><span className="font-bold">SET DATE:</span> {new Date(selectedVehForTicket.dateSetInYard).toLocaleDateString()}</p>
              </div>

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
    </div>
  );
}