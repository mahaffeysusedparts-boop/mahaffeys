import React, { useState, useRef } from 'react';
import { YardSettings } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { authService } from '@/services/authService';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Scale, FileText, Database, RotateCcw, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<YardSettings>(storageService.getSettings());
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof YardSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    storageService.saveSettings(settings);
    toast.success('Yard settings updated successfully!');
  };

  const handleExportBackup = () => {
    const data = {
      metals: storageService.getMetals(),
      carRates: storageService.getCarRates(),
      customers: storageService.getCustomers(),
      tickets: storageService.getTickets(),
      settings: storageService.getSettings(),
      users: authService.getUsers(),
      catCodes: storageService.getCatCodes(),
      containerDrops: storageService.getContainerDrops(),
      cashDrawer: storageService.getCashDrawerLogs(),
      yardBays: storageService.getYardBays(),
      pullParts: storageService.getPullParts(),
      pullVehicles: storageService.getPullYardVehicles(),
      coreReturns: storageService.getCoreReturns(),
      admissionPasses: storageService.getAdmissionPasses(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ScrapFlow_LocalBackup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    toast.success('Local network database backup file downloaded');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.metals) localStorage.setItem('scrapflow_metals', JSON.stringify(data.metals));
        if (data.carRates) localStorage.setItem('scrapflow_car_rates', JSON.stringify(data.carRates));
        if (data.customers) localStorage.setItem('scrapflow_customers', JSON.stringify(data.customers));
        if (data.tickets) localStorage.setItem('scrapflow_tickets', JSON.stringify(data.tickets));
        if (data.settings) localStorage.setItem('scrapflow_settings', JSON.stringify(data.settings));
        if (data.users) localStorage.setItem('scrapflow_users', JSON.stringify(data.users));
        if (data.catCodes) localStorage.setItem('scrapflow_cat_codes', JSON.stringify(data.catCodes));
        if (data.containerDrops) localStorage.setItem('scrapflow_container_drops', JSON.stringify(data.containerDrops));
        if (data.cashDrawer) localStorage.setItem('scrapflow_cash_drawer', JSON.stringify(data.cashDrawer));
        if (data.yardBays) localStorage.setItem('scrapflow_yard_bays', JSON.stringify(data.yardBays));
        if (data.pullParts) localStorage.setItem('scrapflow_pull_parts', JSON.stringify(data.pullParts));
        if (data.pullVehicles) localStorage.setItem('scrapflow_pull_yard_vehicles', JSON.stringify(data.pullVehicles));
        if (data.coreReturns) localStorage.setItem('scrapflow_core_returns', JSON.stringify(data.coreReturns));
        if (data.admissionPasses) localStorage.setItem('scrapflow_admission_passes', JSON.stringify(data.admissionPasses));

        toast.success("Database and Admin account restored successfully!");
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        toast.error("Failed to parse backup file. Please select a valid JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all yard data back to defaults?')) {
      storageService.resetToDefaults();
      setSettings(storageService.getSettings());
      toast.info('Yard data reset to factory defaults');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Hidden File Input for Importing Backup */}
        <input
          type="file"
          ref={importFileInputRef}
          onChange={handleImportBackup}
          accept="application/json,.json"
          className="hidden"
        />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Yard & Hardware System Settings
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure business profile, receipt headers, scale communication drivers, and data backups
            </p>
          </div>

          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            <Save className="w-4 h-4 mr-1.5" /> Save Yard Settings
          </Button>
        </div>

        {/* Section 1: Business Profile */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
            <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Yard Business Information
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-300">Recycling Yard Business Name</Label>
                <Input
                  value={settings.yardName}
                  onChange={(e) => handleChange('yardName', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">State Recycler License #</Label>
                <Input
                  value={settings.licenseNumber}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Physical Address</Label>
                <Input
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">City, State Zip</Label>
                <Input
                  value={settings.cityStateZip}
                  onChange={(e) => handleChange('cityStateZip', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Scale Desk Phone</Label>
                <Input
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Operator Station ID</Label>
                <Input
                  value={settings.operatorName}
                  onChange={(e) => handleChange('operatorName', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>

            {/* Receipt text */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <Label className="text-xs text-slate-300">Printed Voucher Top Header Notice</Label>
                <Textarea
                  value={settings.receiptHeader}
                  onChange={(e) => handleChange('receiptHeader', e.target.value)}
                  rows={2}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Printed Voucher Bottom Footer Notice</Label>
                <Textarea
                  value={settings.receiptFooter}
                  onChange={(e) => handleChange('receiptFooter', e.target.value)}
                  rows={2}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Scale Communication */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
            <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" /> Scale Hardware Communication
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-slate-300">Default Weight Unit</Label>
                <Select
                  value={settings.defaultWeightUnit}
                  onValueChange={(val) => handleChange('defaultWeightUnit', val)}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="LBS">Pounds (LBS)</SelectItem>
                    <SelectItem value="KG">Kilograms (KG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-300">Serial COM Baud Rate</Label>
                <Input
                  type="number"
                  value={settings.serialBaudRate}
                  onChange={(e) => handleChange('serialBaudRate', parseInt(e.target.value) || 9600)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">WebSocket Network Feed URL</Label>
                <Input
                  value={settings.webSocketUrl}
                  onChange={(e) => handleChange('webSocketUrl', e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Data Management */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
            <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" /> Local Network Database Management
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Export or import a complete JSON backup of user accounts, tickets, customer profiles, metal prices, and yard settings.
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleExportBackup}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-emerald-400 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download JSON Backup
              </Button>

              <Button
                onClick={() => importFileInputRef.current?.click()}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-sky-400 text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Import JSON Backup
              </Button>

              <Button
                onClick={handleResetData}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-red-900/50 text-red-400 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Factory Reset
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}