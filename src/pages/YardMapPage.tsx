import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { YardBayLocation } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Map,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Scale,
  DollarSign,
  Plus,
  RefreshCw,
  Sparkles,
  Warehouse,
  Boxes,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export default function YardMapPage() {
  const [bays, setBays] = useState<YardBayLocation[]>([]);
  const [selectedBay, setSelectedBay] = useState<YardBayLocation | null>(null);
  const [editLbs, setEditLbs] = useState(0);

  const loadData = () => {
    setBays(storageService.getYardBays());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenBayModal = (bay: YardBayLocation) => {
    setSelectedBay(bay);
    setEditLbs(bay.currentLbs);
  };

  const handleSaveBayWeight = () => {
    if (!selectedBay) return;
    const updated = bays.map((b) => {
      if (b.id === selectedBay.id) {
        const fillRatio = editLbs / b.capacityLbs;
        let status: YardBayLocation["status"] = "NORMAL";
        if (fillRatio >= 0.9) status = "CRITICAL_FULL";
        else if (fillRatio >= 0.75) status = "NEAR_CAPACITY";

        // Recalculate estimated value proportionally
        const unitVal = b.currentLbs > 0 ? b.estValueUsd / b.currentLbs : 0.5;
        const newEstVal = Math.round(editLbs * (unitVal || 0.5));

        return {
          ...b,
          currentLbs: editLbs,
          status,
          estValueUsd: newEstVal,
          lastUpdated: new Date().toISOString(),
        };
      }
      return b;
    });

    storageService.saveYardBays(updated);
    setBays(updated);
    setSelectedBay(null);
    toast.success(`Updated storage weight for ${selectedBay.bayName}`);
  };

  const totalYardWeight = bays.reduce((acc, b) => acc + b.currentLbs, 0);
  const totalYardValue = bays.reduce((acc, b) => acc + b.estValueUsd, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Map className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Interactive Yard Storage & Inventory Bay Map
                </h1>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">
                  YARD GRID MAP
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time inventory weights, storage capacity limits, and asset valuations across all yard bins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px]">TOTAL YARD ASSET VALUE:</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                ${totalYardValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Top Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Material Weight On-Site</p>
                <p className="text-2xl font-black text-purple-400 font-mono mt-0.5">
                  {totalYardWeight.toLocaleString()} LBS
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Across {bays.length} active yard storage zones</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Warehouse className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Precious Vault Inventory</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                  $
                  {bays
                    .filter((b) => b.categoryType === "PRECIOUS_VAULT")
                    .reduce((acc, b) => acc + b.estValueUsd, 0)
                    .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">High-security copper & converter vaults</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Lock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Full Capacity Alert Bins</p>
                <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                  {bays.filter((b) => b.status === "CRITICAL_FULL").length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Requires shredder or outbound freight transfer</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual Storage Grids Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bays.map((bay) => {
            const fillPct = Math.min(100, Math.round((bay.currentLbs / bay.capacityLbs) * 100));

            return (
              <Card
                key={bay.id}
                onClick={() => handleOpenBayModal(bay)}
                className={`bg-slate-900 border text-white cursor-pointer transition-all hover:scale-[1.02] shadow-xl overflow-hidden ${
                  bay.status === "CRITICAL_FULL"
                    ? "border-rose-500/50 shadow-rose-950/20"
                    : bay.status === "NEAR_CAPACITY"
                    ? "border-amber-500/50"
                    : "border-slate-800"
                }`}
              >
                <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                      {bay.categoryType === "PRECIOUS_VAULT" && <Lock className="w-4 h-4 text-purple-400" />}
                      {bay.categoryType === "CAR_GRID" && <Boxes className="w-4 h-4 text-amber-400" />}
                      {bay.categoryType === "FERROUS_PILE" && <Warehouse className="w-4 h-4 text-blue-400" />}
                      {bay.categoryType === "NON_FERROUS_BIN" && <Warehouse className="w-4 h-4 text-emerald-400" />}
                      {bay.bayName}
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-mono">{bay.gridArea}</p>
                  </div>

                  <Badge
                    className={`text-[10px] ${
                      bay.status === "CRITICAL_FULL"
                        ? "bg-rose-950 text-rose-300 border-rose-800 animate-pulse"
                        : bay.status === "NEAR_CAPACITY"
                        ? "bg-amber-950 text-amber-300 border-amber-800"
                        : "bg-emerald-950 text-emerald-300 border-emerald-800"
                    }`}
                  >
                    {fillPct}% FULL
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Current Weight:</span>
                      <span className="text-white font-bold">{bay.currentLbs.toLocaleString()} / {bay.capacityLbs.toLocaleString()} LBS</span>
                    </div>
                    <Progress value={fillPct} className="h-2 bg-slate-950" />
                  </div>

                  {/* Value and Updated */}
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline font-mono text-xs">
                    <span className="text-slate-400">Estimated Asset Value:</span>
                    <span className="text-emerald-400 font-extrabold text-sm">
                      ${bay.estValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </main>

      {/* Edit Storage Bay Modal */}
      {selectedBay && (
        <Dialog open={!!selectedBay} onOpenChange={() => setSelectedBay(null)}>
          <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-purple-400" /> Adjust Storage Bay Inventory Weight
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                <p className="font-bold text-white">{selectedBay.bayName}</p>
                <p className="text-slate-400 font-mono text-[11px]">Location: {selectedBay.gridArea} | Max Cap: {selectedBay.capacityLbs.toLocaleString()} LBS</p>
              </div>

              <div>
                <Label className="text-slate-300">Update On-Hand Weight (LBS) *</Label>
                <Input
                  type="number"
                  value={editLbs}
                  onChange={(e) => setEditLbs(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-purple-300 font-bold font-mono text-base mt-1"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-800">
              <Button variant="ghost" onClick={() => setSelectedBay(null)} className="text-slate-400">
                Cancel
              </Button>
              <Button onClick={handleSaveBayWeight} className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
                Update Bay Weight
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
