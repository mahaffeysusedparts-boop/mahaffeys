import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { sharedStorage } from "@/services/sharedStorage";
import { ContainerDrop } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Truck,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  Building,
  AlertCircle,
  Scale,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export default function ContainersPage() {
  const [drops, setDrops] = useState<ContainerDrop[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New Drop Form
  const [containerNumber, setContainerNumber] = useState("BOX-20-108");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [binType, setBinType] = useState<ContainerDrop["binType"]>("20-Yard Roll-Off");
  const [assignedDriver, setAssignedDriver] = useState("Driver #1 (Sam Taylor)");
  const [materialCategory, setMaterialCategory] = useState("Aluminum Chips & Turnings");

  const loadData = () => {
    setDrops(storageService.getContainerDrops());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDrop = () => {
    if (!clientName.trim() || !containerNumber.trim()) {
      toast.error("Client Name and Container Number are required");
      return;
    }

    const newDrop: ContainerDrop = {
      id: `drop-${Date.now()}`,
      containerNumber: containerNumber.toUpperCase().trim(),
      clientName,
      clientAddress: clientAddress || "On File",
      clientPhone: clientPhone || "(555) 000-0000",
      dropDate: new Date().toISOString(),
      pickupDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      status: "ON_SITE",
      binType,
      assignedDriver,
      materialCategory,
      estimatedWeightLbs: 5000,
      notes: "Commercial container drop dispatched via Mahaffeys dispatch desk",
    };

    storageService.saveContainerDrop(newDrop);
    loadData();
    setAddModalOpen(false);
    toast.success(`Container ${newDrop.containerNumber} dispatched to ${clientName}!`);

    // Reset
    setClientName("");
    setClientAddress("");
    setClientPhone("");
  };

  const handleUpdateStatus = (id: string, newStatus: ContainerDrop["status"]) => {
    const updated = drops.map((d) => (d.id === id ? { ...d, status: newStatus } : d));
    sharedStorage.setItem("mahaffeys_container_drops", JSON.stringify(updated));
    setDrops(updated);
    toast.success(`Updated container status to ${newStatus.replace(/_/g, " ")}`);
  };

  const filteredDrops = drops.filter(
    (d) =>
      d.containerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.materialCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeOnSiteCount = drops.filter((d) => d.status === "ON_SITE").length;
  const pickupRequestedCount = drops.filter((d) => d.status === "PICKUP_REQUESTED").length;
  const totalEstWeight = drops.reduce((acc, d) => acc + (d.estimatedWeightLbs || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Roll-Off Dumpster & Commercial Dispatch Hub
                </h1>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs">
                  COMMERCIAL FLEET
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage commercial machine shop dumpsters, demolition containers, driver routes, and scale return billing
              </p>
            </div>
          </div>

          <Button
            onClick={() => setAddModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-indigo-950"
          >
            <Plus className="w-4 h-4" /> Dispatch Container Drop
          </Button>
        </div>

        {/* Top Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Containers Active On-Site</p>
                <p className="text-2xl font-black text-indigo-400 font-mono mt-0.5">{activeOnSiteCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">At client machine shops & body yards</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Truck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Pickup Requests Pending</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{pickupRequestedCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ready for yard return & weighing</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Est. Scrap Material Out</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                  {totalEstWeight.toLocaleString()} LBS
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Commercial high-grade metals</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Scale className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" /> Container Placement & Driver Dispatch Ledger
              </CardTitle>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input
                placeholder="Search box #, client, or metal type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs pl-8 w-64"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredDrops.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No active container drops found matching search filter.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 text-xs">
                    <TableHead className="text-slate-400">Container ID</TableHead>
                    <TableHead className="text-slate-400">Commercial Client & Location</TableHead>
                    <TableHead className="text-slate-400">Bin Type & Material</TableHead>
                    <TableHead className="text-slate-400">Driver</TableHead>
                    <TableHead className="text-slate-400">Drop / Due Date</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrops.map((drop) => (
                    <TableRow key={drop.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                      <TableCell className="font-bold text-indigo-400 tracking-wider">
                        {drop.containerNumber}
                      </TableCell>

                      <TableCell className="font-sans">
                        <span className="font-bold text-white block">{drop.clientName}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" /> {drop.clientAddress}
                        </span>
                      </TableCell>

                      <TableCell className="font-sans">
                        <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px] mb-1">
                          {drop.binType}
                        </Badge>
                        <span className="block text-[10px] text-slate-400 font-medium">{drop.materialCategory}</span>
                      </TableCell>

                      <TableCell className="font-sans text-slate-300">{drop.assignedDriver}</TableCell>

                      <TableCell className="text-slate-300">
                        {new Date(drop.dropDate).toLocaleDateString()}
                        <span className="block text-[10px] text-amber-400">Due: {new Date(drop.pickupDueDate).toLocaleDateString()}</span>
                      </TableCell>

                      <TableCell className="font-sans">
                        {drop.status === "ON_SITE" && (
                          <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800 text-[10px]">
                            ON SITE
                          </Badge>
                        )}
                        {drop.status === "PICKUP_REQUESTED" && (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px] animate-pulse">
                            PICKUP REQUESTED
                          </Badge>
                        )}
                        {drop.status === "RETURNED_TO_YARD" && (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                            RETURNED TO YARD
                          </Badge>
                        )}
                        {drop.status === "PROCESSED" && (
                          <Badge variant="outline" className="text-slate-500 border-slate-700 text-[10px]">
                            BILLED / PROCESSED
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right space-x-1">
                        {drop.status === "ON_SITE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(drop.id, "PICKUP_REQUESTED")}
                            className="h-7 text-[10px] bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700"
                          >
                            Mark Pickup Needed
                          </Button>
                        )}
                        {drop.status === "PICKUP_REQUESTED" && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(drop.id, "RETURNED_TO_YARD")}
                            className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            <Scale className="w-3 h-3 mr-1" /> Return & Weigh
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Dispatch Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" /> Dispatch New Commercial Container Drop
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Container Serial # *</Label>
                <Input
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-indigo-300 font-mono font-bold text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Container Type</Label>
                <select
                  value={binType}
                  onChange={(e) => setBinType(e.target.value as any)}
                  className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="20-Yard Roll-Off">20-Yard Roll-Off</option>
                  <option value="40-Yard High-Side">40-Yard High-Side</option>
                  <option value="Lugger Scrap Box">Lugger Scrap Box</option>
                  <option value="Gaylord Wire Bin">Gaylord Wire Bin</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Commercial Client Name *</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Apex Precision Machining"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Drop Site Address</Label>
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="1900 Manufacturing Pkwy, Industrial Park"
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Assigned Truck Driver</Label>
                <Input
                  value={assignedDriver}
                  onChange={(e) => setAssignedDriver(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Scrap Material Category</Label>
                <Input
                  value={materialCategory}
                  onChange={(e) => setMaterialCategory(e.target.value)}
                  placeholder="e.g. Aluminum 6061 Chips"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSaveDrop} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
              Dispatch Container
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
