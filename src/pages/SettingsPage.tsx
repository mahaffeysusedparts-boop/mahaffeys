import React, { useEffect, useRef, useState } from 'react';
import { YardSettings } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { authService } from '@/services/authService';
import { apiRequest } from '@/services/apiClient';
import { ConnectionStatus, sharedStorage } from '@/services/sharedStorage';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Save,
  Scale,
  FileText,
  Database,
  RotateCcw,
  Download,
  Upload,
  Server,
  Wifi,
  WifiOff,
  Globe,
  Copy,
  ExternalLink,
  Check,
  Terminal,
  ShieldCheck,
  SearchCheck,
  ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';

// Finds every /api/uploads/<uuid> reference so the backup can carry the photo
// bytes themselves — otherwise the target server 404s on every snapshot URL.
const UPLOAD_URL_PATTERN = /\/api\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

interface BackupMediaEntry {
  id: string;
  fileName: string;
  contentType: string;
  contentBase64: string;
}

function collectUploadIds(value: unknown, ids: Set<string>) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(UPLOAD_URL_PATTERN)) ids.add(match[1]);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectUploadIds(item, ids));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectUploadIds(item, ids));
  }
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read an image for the backup'));
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });

interface PhotoAuditResult {
  connectedHost: string;
  connectedDatabase: string;
  referencedCount: number;
  missingCount: number;
  mediaInDatabase: number;
}

async function fetchBackupMedia(data: unknown): Promise<{ media: BackupMediaEntry[]; failed: number }> {
  const ids = new Set<string>();
  collectUploadIds(data, ids);
  const media: BackupMediaEntry[] = [];
  let failed = 0;
  for (const id of ids) {
    try {
      const response = await fetch(`/api/uploads/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`Upload ${id} returned ${response.status}`);
      const blob = await response.blob();
      const contentBase64 = await blobToBase64(blob);
      if (!contentBase64) throw new Error(`Upload ${id} is empty`);
      const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      media.push({ id, fileName: `backup-${id}.${extension}`, contentType: blob.type, contentBase64 });
    } catch {
      failed += 1;
    }
  }
  return { media, failed };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<YardSettings>(storageService.getSettings());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(sharedStorage.getStatus());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isAuditingPhotos, setIsAuditingPhotos] = useState(false);
  const [photoAudit, setPhotoAudit] = useState<PhotoAuditResult | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => sharedStorage.subscribe(setConnectionStatus), []);

  const handleChange = (field: keyof YardSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    storageService.saveSettings(settings);
    toast.success('Yard & system settings updated successfully!');
  };

  const currentDomain = settings.customDomain || 'app.mahaffeysusedparts.com';
  const publicIp = '168.220.187.68';
  const privateIp = '192.168.1.210';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const certbotInstallCmd = `sudo apt update && sudo apt install -y certbot python3-certbot-nginx`;
  const sslCertbotCmd = `sudo certbot --nginx -d ${currentDomain.trim()}`;

  const nginxConfigSnippet = `server {
    listen 80;
    server_name ${currentDomain.trim()};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
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

      // Embed every referenced snapshot so photos survive copying this file
      // to another server. Without this the URLs 404 ("Upload not found").
      const { media, failed } = await fetchBackupMedia(data);

      const json = JSON.stringify({ ...data, media }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Mahaffeys_LocalBackup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup downloaded with ${media.length} photo${media.length === 1 ? '' : 's'} embedded`, {
        description: failed > 0 ? `${failed} photo(s) could not be read and were skipped.` : undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to build the backup file');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);

        // Restore the embedded snapshots first so ticket/customer photo URLs
        // resolve before the records referencing them land in the database.
        if (Array.isArray(data.media) && data.media.length > 0) {
          const result = await apiRequest<{ restored: number }>('/api/uploads/import', {
            method: 'POST',
            body: JSON.stringify({ media: data.media }),
          });
          toast.success(`Restored ${result.restored} photo${result.restored === 1 ? '' : 's'} to the server`);
        }

        const state = {
          mahaffeys_metals: data.metals,
          mahaffeys_car_rates: data.carRates,
          mahaffeys_customers: data.customers,
          mahaffeys_tickets: data.tickets,
          mahaffeys_settings: data.settings,
          mahaffeys_cat_codes: data.catCodes,
          mahaffeys_container_drops: data.containerDrops,
          mahaffeys_cash_drawer: data.cashDrawer,
          mahaffeys_yard_bays: data.yardBays,
          mahaffeys_pull_parts: data.pullParts,
          mahaffeys_pull_yard_vehicles: data.pullVehicles,
          mahaffeys_core_returns: data.coreReturns,
          mahaffeys_admission_passes: data.admissionPasses,
        };
        await sharedStorage.importState(Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined)));
        toast.success("Backup imported into the shared PC database");
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to import this backup file");
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

  const runPhotoAudit = async () => {
    setIsAuditingPhotos(true);
    try {
      const result = await apiRequest<PhotoAuditResult>('/api/admin/media-audit');
      setPhotoAudit(result);
      if (result.referencedCount === 0) {
        toast.info('No photo references found in the shared records yet');
      } else if (result.missingCount === 0) {
        toast.success(`All ${result.referencedCount} referenced photo(s) are present in this database`);
      } else {
        toast.warning(`${result.missingCount} of ${result.referencedCount} referenced photo(s) are missing from this database`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Photo audit failed');
    } finally {
      setIsAuditingPhotos(false);
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
              Configure business profile, domain connection, receipt headers, scale drivers, and backups
            </p>
          </div>

          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            <Save className="w-4 h-4 mr-1.5" /> Save Yard Settings
          </Button>
        </div>

        {/* Section 1: Custom Domain & Network Access */}
        <Card className="bg-slate-900 border-2 border-indigo-500/40 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-indigo-950/80 to-slate-950 border-b border-indigo-500/30 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" /> Custom Domain & Public Access Setup
            </CardTitle>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">
              DOMAIN & SSL
            </Badge>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <Label className="text-xs font-bold text-slate-200 block mb-1">
                  Custom Domain Name *
                </Label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-3 text-indigo-400" />
                  <Input
                    value={settings.customDomain || ''}
                    onChange={(e) => handleChange('customDomain', e.target.value)}
                    placeholder="e.g. app.mahaffeysusedparts.com or myyard.com"
                    className="bg-slate-950 border-slate-800 text-indigo-300 font-mono font-bold text-sm pl-9 h-11"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter the full domain name or subdomain pointed to this Linux server.
                </p>
              </div>

              <div className="flex gap-2">
                <a
                  href={`https://${currentDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-indigo-500/40 bg-indigo-950/30 hover:bg-indigo-900/50 text-indigo-300 font-bold text-xs gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> Test Domain Link
                  </Button>
                </a>
              </div>
            </div>

            {/* Step-by-Step Domain Connection Guide */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 text-xs">
              <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Steps to Connect Your Domain
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                
                {/* Step 1: DNS Setup */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-amber-400 font-bold">
                    <span>1. DNS A-Record Configuration</span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">DOMAINS</Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.), add an <strong>A Record</strong>:
                  </p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-0.5 text-[10px] text-slate-200">
                    <p><strong className="text-slate-400">Type:</strong> A</p>
                    <p><strong className="text-slate-400">Host / Name:</strong> {currentDomain.split('.')[0] || 'app'}</p>
                    <p><strong className="text-slate-400">Public WAN IP:</strong> {publicIp}</p>
                    <p><strong className="text-slate-400">Private LAN IP:</strong> {privateIp}</p>
                  </div>
                </div>

                {/* Step 2: SSL Certbot Command */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>2. Install Certbot & Request SSL</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300">LET'S ENCRYPT</Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Run these commands in terminal to install Certbot & enable HTTPS:
                  </p>
                  
                  <div className="space-y-1">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[10px] text-sky-300 font-mono overflow-x-auto">
                      <span>{certbotInstallCmd}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(certbotInstallCmd, 'Install Certbot Command')}
                        className="h-6 px-2 text-[10px] text-slate-400 hover:text-white shrink-0 ml-2"
                      >
                        {copiedField === 'Install Certbot Command' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>

                    <div className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[10px] text-emerald-300 font-mono overflow-x-auto">
                      <span>{sslCertbotCmd}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(sslCertbotCmd, 'Certbot SSL Command')}
                        className="h-6 px-2 text-[10px] text-slate-400 hover:text-white shrink-0 ml-2"
                      >
                        {copiedField === 'Certbot SSL Command' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Nginx Config Snippet Accordion / Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5 font-sans">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" /> Generated Nginx Reverse Proxy Config (/etc/nginx/sites-available/mahaffeys):
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(nginxConfigSnippet, 'Nginx Config')}
                    className="h-7 text-xs text-indigo-300 hover:text-white gap-1"
                  >
                    {copiedField === 'Nginx Config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Nginx Config
                  </Button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-sky-300 font-mono overflow-x-auto">
                  {nginxConfigSnippet}
                </pre>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Section 2: Business Profile */}
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

              <div>
                <Label className="text-xs text-slate-300">Public Yard Hours</Label>
                <Input
                  value={settings.publicHours || ''}
                  onChange={(e) => handleChange('publicHours', e.target.value)}
                  placeholder="Monday–Saturday, 8:00 AM–5:00 PM"
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-300">Public Admission Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.admissionFeeUsd || 0}
                  onChange={(e) => handleChange('admissionFeeUsd', Math.max(0, Number(e.target.value) || 0))}
                  className="bg-slate-950 border-slate-800 text-white text-xs mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-300">Public Safety Requirements</Label>
                <Textarea
                  value={settings.safetyRequirements || ''}
                  onChange={(e) => handleChange('safetyRequirements', e.target.value)}
                  rows={2}
                  placeholder="Required protective equipment and prohibited tools"
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

        {/* Section 3: Scale Communication */}
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

        {/* Section 4: Data Management */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
            <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" /> PC-Hosted Database Management
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${connectionStatus === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                {connectionStatus === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connectionStatus === 'connected' ? 'DATABASE CONNECTED' : connectionStatus.toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3 text-xs text-slate-400">
              <Server className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
              <div>
                <p className="font-semibold text-slate-200">Shared records are stored on your Linux PC ({privateIp}).</p>
                <p className="mt-1">JSON imports migrate yard records only. User passwords remain protected and must be created through secure account registration.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                onClick={handleExportBackup}
                disabled={isExportingBackup}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-emerald-400 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {isExportingBackup ? 'Embedding Photos…' : 'Download JSON Backup'}
              </Button>

              <Button
                onClick={() => importFileInputRef.current?.click()}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-sky-400 text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Import JSON Backup
              </Button>

              <Button
                onClick={runPhotoAudit}
                disabled={isAuditingPhotos}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-400 text-xs font-semibold"
              >
                <SearchCheck className="w-3.5 h-3.5 mr-1.5" />
                {isAuditingPhotos ? 'Auditing…' : 'Audit Photos'}
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

        {/* Photo audit results */}
        {photoAudit && (
          <Card className={`text-white shadow-lg border ${photoAudit.missingCount > 0 ? 'border-amber-500/40 bg-slate-900' : 'border-emerald-500/40 bg-slate-900'}`}>
            <CardHeader className="py-3 px-4 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center gap-2">
                <ImageOff className={`w-4 h-4 ${photoAudit.missingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                Photo Snapshot Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Server connected to:</span>
                <span className="font-bold text-white">{photoAudit.connectedHost} / {photoAudit.connectedDatabase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Photos stored in this database:</span>
                <span className="font-bold text-white">{photoAudit.mediaInDatabase.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Photos referenced by records:</span>
                <span className="font-bold text-white">{photoAudit.referencedCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Referenced photos missing here:</span>
                <span className={`font-bold ${photoAudit.missingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {photoAudit.missingCount.toLocaleString()}
                </span>
              </div>
              {photoAudit.missingCount > 0 && (
                <p className="pt-2 border-t border-slate-800 font-sans leading-relaxed text-slate-400">
                  Yard records sync between databases, but photo bytes only exist in the
                  <strong className="text-slate-200"> media_uploads table of the database shown above</strong>.
                  Missing photos here means they were captured while the server was connected to a different
                  database (or this one was reset). If another deployment still has them, download a JSON backup
                  from that deployment — backups now embed photos — and import it here to restore them.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
}