import React, { useState } from 'react';
import { MetalGrade, AutoSalvageCategoryRate } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Car,
  Scale,
  Save,
  Plus,
  Zap,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PricingPage() {
  const [metals, setMetals] = useState<MetalGrade[]>(storageService.getMetals());
  const [carRates, setCarRates] = useState<AutoSalvageCategoryRate[]>(storageService.getCarRates());

  // Editing states
  const handleMetalRateChange = (id: string, newRate: number) => {
    const updated = metals.map((m) => (m.id === id ? { ...m, ratePerLb: newRate } : m));
    setMetals(updated);
  };

  const handleSaveMetals = () => {
    storageService.saveMetals(metals);
    toast.success('Scrap metal prices updated & saved');
  };

  const handleCarRateChange = (id: string, field: keyof AutoSalvageCategoryRate, value: number) => {
    const updated = carRates.map((c) => (c.id === id ? { ...c, [field]: value } : c));
    setCarRates(updated);
  };

  const handleSaveCarRates = () => {
    storageService.saveCarRates(carRates);
    toast.success('Auto salvage category rates saved');
  };

  // Quick rate adjustment (e.g. +$0.10/lb to all Non-Ferrous)
  const handleBulkMetalBump = (category: string, delta: number) => {
    const updated = metals.map((m) => {
      if (m.category === category) {
        return { ...m, ratePerLb: Math.max(0.01, Math.round((m.ratePerLb + delta) * 100) / 100) };
      }
      return m;
    });
    setMetals(updated);
    storageService.saveMetals(updated);
    toast.success(`Adjusted ${category} rates by ${delta > 0 ? '+' : ''}$${delta.toFixed(2)}/lb`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Metal & Auto Salvage Pricing Catalog
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live yard rate sheets for scrap metal grades ($/lb) and Pull-a-Part car salvage ($/ton)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                storageService.resetToDefaults();
                setMetals(storageService.getMetals());
                setCarRates(storageService.getCarRates());
                toast.info('Price catalog reset to factory default rates');
              }}
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Defaults
            </Button>
          </div>
        </div>

        {/* Tabs for Metals vs Auto Salvage Rates */}
        <Tabs defaultValue="metals" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="metals" className="text-xs font-bold flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-400" /> Scrap Metal Rates ($/LB)
            </TabsTrigger>
            <TabsTrigger value="cars" className="text-xs font-bold flex items-center gap-1.5">
              <Car className="w-4 h-4 text-amber-400" /> Auto Salvage Rates ($/TON)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Scrap Metals Catalog */}
          <TabsContent value="metals" className="space-y-6">
            
            {/* Quick Bulk Bump Toolbar */}
            <Card className="bg-slate-900/90 border-slate-800 text-white p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Quick Category Market Adjustments:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkMetalBump('Non-Ferrous', 0.10)}
                    className="h-8 bg-slate-800 border-slate-700 hover:bg-slate-700 text-emerald-400 text-xs font-mono"
                  >
                    Non-Ferrous +$0.10/lb
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkMetalBump('Non-Ferrous', -0.10)}
                    className="h-8 bg-slate-800 border-slate-700 hover:bg-slate-700 text-red-400 text-xs font-mono"
                  >
                    Non-Ferrous -$0.10/lb
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkMetalBump('Ferrous', 0.01)}
                    className="h-8 bg-slate-800 border-slate-700 hover:bg-slate-700 text-emerald-400 text-xs font-mono"
                  >
                    Steel/Iron +$0.01/lb
                  </Button>
                  <Button
                    onClick={handleSaveMetals}
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs ml-auto"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" /> Save All Metal Rates
                  </Button>
                </div>
              </div>
            </Card>

            {/* Metal Rates Table */}
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Category</TableHead>
                      <TableHead className="text-slate-400">Grade Name</TableHead>
                      <TableHead className="text-slate-400">Yard Code</TableHead>
                      <TableHead className="text-slate-400">Description</TableHead>
                      <TableHead className="text-slate-400 text-right w-40">Live Rate ($ / LB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metals.map((m) => (
                      <TableRow key={m.id} className="border-slate-800 hover:bg-slate-800/40 text-xs">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              m.category === 'Non-Ferrous'
                                ? 'border-amber-500/40 text-amber-300'
                                : m.category === 'Ferrous'
                                ? 'border-blue-500/40 text-blue-300'
                                : 'border-purple-500/40 text-purple-300'
                            }`}
                          >
                            {m.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-white font-sans">{m.name}</TableCell>
                        <TableCell className="font-mono text-slate-400">{m.code}</TableCell>
                        <TableCell className="text-slate-400 text-[11px] max-w-xs truncate">{m.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-500 font-mono">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={m.ratePerLb}
                              onChange={(e) => handleMetalRateChange(m.id, parseFloat(e.target.value) || 0)}
                              className="w-24 h-8 bg-slate-950 border-slate-700 text-emerald-400 font-mono font-bold text-xs text-right"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Auto Salvage Rates */}
          <TabsContent value="cars" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white">
                    Pull-A-Part Vehicle Category Tonnage Rates
                  </CardTitle>
                  <p className="text-xs text-slate-400">
                    Configure base rate per ton and component bonuses (catalytic converter, engine, battery)
                  </p>
                </div>
                <Button
                  onClick={handleSaveCarRates}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Auto Rates
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Vehicle Category</TableHead>
                      <TableHead className="text-slate-400">Rate per Ton ($)</TableHead>
                      <TableHead className="text-slate-400">Cat Converter Bonus ($)</TableHead>
                      <TableHead className="text-slate-400">Engine / Trans Bonus ($)</TableHead>
                      <TableHead className="text-slate-400">Battery Bonus ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carRates.map((r) => (
                      <TableRow key={r.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-sans font-bold text-white">
                          {r.categoryName}
                          <span className="block text-[10px] font-normal text-slate-400">{r.description}</span>
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={r.ratePerTon}
                            onChange={(e) => handleCarRateChange(r.id, 'ratePerTon', parseFloat(e.target.value) || 0)}
                            className="w-28 h-8 bg-slate-950 border-slate-700 text-emerald-400 font-bold text-xs"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={r.flatBonusWithCat}
                            onChange={(e) => handleCarRateChange(r.id, 'flatBonusWithCat', parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 bg-slate-950 border-slate-700 text-amber-300 text-xs"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={r.flatBonusWithEngine}
                            onChange={(e) => handleCarRateChange(r.id, 'flatBonusWithEngine', parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 bg-slate-950 border-slate-700 text-amber-300 text-xs"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={r.flatBonusWithBattery}
                            onChange={(e) => handleCarRateChange(r.id, 'flatBonusWithBattery', parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 bg-slate-950 border-slate-700 text-amber-300 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </main>
    </div>
  );
}
