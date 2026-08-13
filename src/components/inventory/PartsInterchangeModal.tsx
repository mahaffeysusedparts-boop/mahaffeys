import React, { useState } from 'react';
import { interchangeService, InterchangeMapping } from '@/services/interchangeService';
import { storageService } from '@/services/storageService';
import { PullYardVehicle } from '@/types/scrap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wrench,
  Search,
  Car,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Layers,
  Info,
  Calendar,
  Layers3,
} from 'lucide-react';

interface PartsInterchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMake?: string;
  initialModel?: string;
  initialYear?: number;
}

export const PartsInterchangeModal: React.FC<PartsInterchangeModalProps> = ({
  isOpen,
  onClose,
  initialMake = 'Ford',
  initialModel = 'F-150',
  initialYear = 2008,
}) => {
  const [searchMake, setSearchMake] = useState(initialMake);
  const [searchModel, setSearchModel] = useState(initialModel);
  const [searchYear, setSearchYear] = useState<number>(initialYear);
  const [searchTerm, setSearchTerm] = useState('');

  const yardVehicles = storageService.getPullYardVehicles();
  const allMappings = interchangeService.getInterchangeMappings();

  // Search results
  const matchingMappings = interchangeService.findInterchangeForVehicle(
    searchMake,
    searchModel,
    searchYear
  );

  const matchingDonorVehicles = interchangeService.findMatchingDonorVehicles(
    searchMake,
    searchModel,
    searchYear,
    yardVehicles
  );

  const filteredMappings = allMappings.filter((m) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      m.partName.toLowerCase().includes(q) ||
      m.interchangeCode.toLowerCase().includes(q) ||
      m.partCategory.toLowerCase().includes(q) ||
      m.compatibleModels.some((c) =>
        `${c.make} ${c.model}`.toLowerCase().includes(q)
      )
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800 p-6 font-sans">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Layers3 className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Parts Interchange & Vehicle Compatibility Explorer
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Cross-reference donor vehicles on the yard that share compatible engines, transmissions, and components.
                </DialogDescription>
              </div>
            </div>

            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
              INTERCHANGE LOOKUP
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          
          {/* Query Vehicle Specs Form Bar */}
          <Card className="bg-slate-900 border-slate-800 text-white p-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Target Vehicle Specs:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Year</label>
                  <Input
                    type="number"
                    value={searchYear}
                    onChange={(e) => setSearchYear(parseInt(e.target.value) || 2008)}
                    className="bg-slate-950 border-slate-800 text-white text-xs font-mono h-9"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Make</label>
                  <Input
                    value={searchMake}
                    onChange={(e) => setSearchMake(e.target.value)}
                    placeholder="e.g. Ford"
                    className="bg-slate-950 border-slate-800 text-white text-xs h-9"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Model</label>
                  <Input
                    value={searchModel}
                    onChange={(e) => setSearchModel(e.target.value)}
                    placeholder="e.g. F-150"
                    className="bg-slate-950 border-slate-800 text-white text-xs h-9"
                  />
                </div>

                <div className="flex items-end">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input
                      placeholder="Filter by component name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-xs pl-8 h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 1: MATCHING DONOR VEHICLES ON YARD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-emerald-400" /> Matching Donor Vehicles Staged on Yard ({matchingDonorVehicles.length})
              </h3>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
                COMPATIBLE DONORS ON LOT
              </Badge>
            </div>

            {matchingDonorVehicles.length === 0 ? (
              <Card className="bg-slate-900/60 border-slate-800 p-6 text-center text-slate-400 text-xs space-y-1">
                <Info className="w-6 h-6 mx-auto text-slate-600" />
                <p className="font-semibold text-slate-300">No donor cars currently staged for {searchYear} {searchMake} {searchModel}</p>
                <p className="text-[11px] text-slate-500">Check general part interchange compatibility list below for cross-brand models.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchingDonorVehicles.map(({ vehicle, interchangeItem }, idx) => (
                  <Card key={idx} className="bg-slate-900 border-2 border-emerald-500/40 text-white p-3.5 shadow-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px] mb-1">
                          SECTION: {vehicle.section}
                        </Badge>
                        <h4 className="font-extrabold text-white text-base">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Color: <span className="text-slate-200">{vehicle.color}</span> | VIN: {vehicle.vin.slice(0, 11)}...
                        </p>
                      </div>

                      <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-center font-mono shrink-0">
                        <span className="text-xs font-black block">{vehicle.rowNumber ?? '—'}</span>
                        <span className="text-[9px] text-amber-400/80">{vehicle.section}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" /> Fits: {interchangeItem.partName}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Status: <strong className="text-emerald-400">{vehicle.status}</strong>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: FULL INTERCHANGE MAPS & CROSS COMPATIBILITY LIST */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> Interchange Cross-Reference Mappings ({filteredMappings.length})
            </h3>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredMappings.map((item) => (
                <Card key={item.id} className="bg-slate-900 border-slate-800 text-white p-4 space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-purple-500/40 text-purple-300 text-[10px]">
                          {item.partCategory}
                        </Badge>
                        <span className="text-xs font-mono text-slate-400">{item.interchangeCode}</span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">{item.partName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                      Interchangeable Vehicle Years & Models:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {item.compatibleModels.map((cm, cIdx) => (
                        <div key={cIdx} className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
                          <span className="font-bold text-amber-300">{cm.startYear}-{cm.endYear} {cm.make} {cm.model}</span>
                          {cm.notes && <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={cm.notes}>{cm.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};