import React, { useState } from 'react';
import { MetalGrade, AutoSalvageCategoryRate, CatalyticConverterCode } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  Car,
  Scale,
  Save,
  Plus,
  Zap,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Search,
  ShieldAlert,
  Flame,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PricingPage() {
  const [metals, setMetals] = useState<MetalGrade[]>(storageService.getMetals());
  const [carRates, setCarRates] = useState<AutoSalvageCategoryRate[]>(storageService.getCarRates());
  const [catCodes, setCatCodes] = useState<CatalyticConverterCode[]>(storageService.getCatCodes());

  // Search & Filters for Cat Codes
  const [catSearch, setCatSearch] = useState('');
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);

  // New Cat Code Form
  const [newCode, setNewCode] = useState('');
  const [newMake, setNewMake] = useState('Ford');
  const [newCategory, setNewCategory] = useState<CatalyticConverterCode['category']>('Domestic Large');
  const [newPtGrams, setNewPtGrams] = useState(2.5);
  const [newPdGrams, setNewPdGrams] = useState(1.8);
  const [newRhGrams, setNewRhGrams] = useState(0.3);
  const [newVal, setNewVal] = useState(180);

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

  // Quick rate adjustment
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

  // Save new Cat Code
  const handleSaveCatCode = () => {
    if (!newCode.trim()) {
      toast.error("OEM Serial Code is required");
      return;
    }
    const newEntry: CatalyticConverterCode = {
      id: `cat-${Date.now()}`,
      code: newCode.toUpperCase().trim(),
      make: newMake,
      category: newCategory,
      ptGrams: newPtGrams,
      pdGrams: newPdGrams,
      rhGrams: newRhGrams,
      avgMarketValue: newVal,
      notes: "Added via Converter Estimator Tool",
    };
    storageService.saveCatCode(newEntry);
    setCatCodes(storageService.getCatCodes());
    setAddCatModalOpen(false);
    toast.success(`Added OEM Catalytic Converter Code: ${newEntry.code}`);
    setNewCode('');
  };

  const filteredCatCodes = catCodes.filter(
    (c) =>
      c.code.toLowerCase().includes(catSearch.toLowerCase()) ||
      c.make.toLowerCase().includes(catSearch.toLowerCase()) ||
      c.category.toLowerCase().includes(catSearch.toLowerCase())
  );

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
              Live yard rate sheets for scrap metal grades ($/lb), car salvage ($/ton), and catalytic converter OEM precious metal estimates
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                storageService.resetPricingToDefaults();
                setMetals(storageService.getMetals());
                setCarRates(storageService.getCarRates());
                setCatCodes(storageService.getCatCodes());
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

        {/* Tabs for Metals, Auto Salvage, and Catalytic Converters */}
        <Tabs defaultValue="metals" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="metals" className="text-xs font-bold flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-400" /> Scrap Metal Rates ($/LB)
            </TabsTrigger>
            <TabsTrigger value="cars" className="text-xs font-bold flex items-center gap-1.5">
              <Car className="w-4 h-4 text-amber-400" /> Auto Salvage Rates ($/TON)
            </TabsTrigger>
            <TabsTrigger value="cats" className="text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" /> Catalytic Converter OEM Serial Lookup
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

          {/* TAB 3: CATALYTIC CONVERTER OEM SERIAL LOOKUP */}
          <TabsContent value="cats" className="space-y-6">
            
            {/* Live Precious Metals Spot Prices Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-slate-900 border-purple-500/30 text-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PLATINUM (Pt) SPOT</span>
                    <p className="text-xl font-black text-purple-300 font-mono mt-0.5">$982.50 / oz</p>
                  </div>
                  <Badge className="bg-purple-950 text-purple-300 border-purple-500/40">Pt 78</Badge>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-purple-500/30 text-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PALLADIUM (Pd) SPOT</span>
                    <p className="text-xl font-black text-sky-300 font-mono mt-0.5">$1,045.00 / oz</p>
                  </div>
                  <Badge className="bg-sky-950 text-sky-300 border-sky-500/40">Pd 46</Badge>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-purple-500/30 text-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RHODIUM (Rh) SPOT</span>
                    <p className="text-xl font-black text-emerald-300 font-mono mt-0.5">$4,750.00 / oz</p>
                  </div>
                  <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40">Rh 45</Badge>
                </CardContent>
              </Card>
            </div>

            {/* Main Table & Search */}
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" /> Catalytic Converter OEM Stamped Code Registry
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Search stamped shell numbers to estimate precious metal assay content and statutory market valuation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input
                      placeholder="Search OEM serial code (e.g. 4R31)..."
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-xs pl-8 w-60"
                    />
                  </div>

                  <Button
                    onClick={() => setAddCatModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Converter Code
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">OEM Serial Code</TableHead>
                      <TableHead className="text-slate-400">Make / Brand</TableHead>
                      <TableHead className="text-slate-400">Converter Category</TableHead>
                      <TableHead className="text-slate-400">Pt (Platinum)</TableHead>
                      <TableHead className="text-slate-400">Pd (Palladium)</TableHead>
                      <TableHead className="text-slate-400">Rh (Rhodium)</TableHead>
                      <TableHead className="text-slate-400 text-right">Est. Market Value ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCatCodes.map((cat) => (
                      <TableRow key={cat.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-bold text-purple-300 font-mono tracking-wider">{cat.code}</TableCell>
                        <TableCell className="font-sans font-semibold text-white">{cat.make}</TableCell>
                        <TableCell className="font-sans">
                          <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                            {cat.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-purple-300 font-bold">{cat.ptGrams}g</TableCell>
                        <TableCell className="text-sky-300 font-bold">{cat.pdGrams}g</TableCell>
                        <TableCell className="text-emerald-300 font-bold">{cat.rhGrams}g</TableCell>
                        <TableCell className="text-right font-extrabold text-emerald-400 font-mono text-sm">
                          ${cat.avgMarketValue.toFixed(2)}
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

      {/* Add Converter Code Modal */}
      <Dialog open={addCatModalOpen} onOpenChange={setAddCatModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Add OEM Catalytic Converter Code
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Stamped OEM Serial Code *</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g. 4R31-5E212-AA"
                className="bg-slate-900 border-slate-800 text-purple-300 font-mono font-bold text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">Manufacturer / Make</Label>
                <Input
                  value={newMake}
                  onChange={(e) => setNewMake(e.target.value)}
                  placeholder="e.g. Ford / Lincoln"
                  className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Category</Label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full h-9 bg-slate-900 border border-slate-800 rounded-md text-xs text-white px-2 mt-1"
                >
                  <option value="Domestic Large">Domestic Large</option>
                  <option value="Foreign Small">Foreign Small</option>
                  <option value="Exotic / High-Grade">Exotic / High-Grade</option>
                  <option value="Aftermarket">Aftermarket</option>
                  <option value="Diesel DPF Filter">Diesel DPF Filter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-slate-300">Pt (Grams)</Label>
                <Input
                  type="number"
                  value={newPtGrams}
                  onChange={(e) => setNewPtGrams(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-purple-300 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-slate-300">Pd (Grams)</Label>
                <Input
                  type="number"
                  value={newPdGrams}
                  onChange={(e) => setNewPdGrams(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-sky-300 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-slate-300">Rh (Grams)</Label>
                <Input
                  type="number"
                  value={newRhGrams}
                  onChange={(e) => setNewRhGrams(parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-emerald-300 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Estimated Market Payout ($)</Label>
              <Input
                type="number"
                value={newVal}
                onChange={(e) => setNewVal(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-bold text-xs mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAddCatModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleSaveCatCode} className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Save Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
