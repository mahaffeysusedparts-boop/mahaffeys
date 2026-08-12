import React, { useState } from 'react';
import { PullYardVehicle, PullYardVehicleStatus } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { generateSamplePhoto } from '@/utils/complianceUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Car,
  Plus,
  Image,
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkVehicleUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

interface ParsedVehicleRow {
  section: PullYardVehicle['section'];
  year: number;
  make: string;
  model: string;
  color: string;
  vin: string;
  purchasePrice: number;
  originSource: string;
  status: PullYardVehicleStatus;
  photoUrl: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
}

export const BulkVehicleUploadModal: React.FC<BulkVehicleUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedVehicleRow[]>([]);
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');

  // Sample CSV Template Generator
  const downloadSampleCsv = () => {
    const csvContent =
      'Section,Year,Make,Model,Color,VIN,PurchasePrice,OriginSource,Status,PhotoUrl,Notes\n' +
      'Domestic Trucks & SUVs,2008,Ford,F-150,White,1FTRF12W88KA10291,450,1428 Industrial Pkwy,AVAILABLE,https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500,Runs and drives\n' +
      'GM & Chevrolet,2008,Chevrolet,Impala LT,Silver,1G1JC524317109281,350,Vance Towing,PENDING,https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500,Key in ignition\n' +
      'Asian Imports,2011,Toyota,Camry LE,Classic Silver,4T1BF1FK1BU209182,500,Decatur Tow Depot,AVAILABLE,,Cats intact\n' +
      'Asian Imports,2008,Nissan,Altima,Black,1N4AL21E38C209182,300,Highway Police Tow,CRUSHED,,Bailer ready';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Yard_Vehicle_Bulk_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Sample CSV Template!');
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      toast.error('Spreadsheet text must contain a header line and at least 1 vehicle row.');
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Find column indexes
    const idxSection = header.findIndex((h) => h.includes('section'));
    const idxYear = header.findIndex((h) => h.includes('year'));
    const idxMake = header.findIndex((h) => h.includes('make'));
    const idxModel = header.findIndex((h) => h.includes('model'));
    const idxColor = header.findIndex((h) => h.includes('color'));
    const idxVin = header.findIndex((h) => h.includes('vin'));
    const idxPrice = header.findIndex((h) => h.includes('price') || h.includes('payout') || h.includes('cost'));
    const idxOrigin = header.findIndex((h) => h.includes('origin') || h.includes('source') || h.includes('tow'));
    const idxStatus = header.findIndex((h) => h.includes('status'));
    const idxPhoto = header.findIndex((h) => h.includes('photo') || h.includes('image') || h.includes('picture') || h.includes('url'));
    const idxNotes = header.findIndex((h) => h.includes('note') || h.includes('desc'));

    const parsed: ParsedVehicleRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (col.length < 2) continue;

      const rawSection = idxSection >= 0 ? col[idxSection] : '';
      const year = idxYear >= 0 ? parseInt(col[idxYear]) || new Date().getFullYear() - 10 : 2010;
      const make = idxMake >= 0 ? col[idxMake] || '' : '';
      const model = idxModel >= 0 ? col[idxModel] || '' : '';
      const color = idxColor >= 0 ? col[idxColor] || 'Unknown' : 'Unknown';
      const vin = idxVin >= 0 ? col[idxVin] || '' : '';
      const purchasePrice = idxPrice >= 0 ? parseFloat(col[idxPrice]) || 0 : 0;
      const originSource = idxOrigin >= 0 ? col[idxOrigin] || 'Bulk CSV Import' : 'Bulk CSV Import';
      const rawStatus = idxStatus >= 0 ? col[idxStatus].toUpperCase() : 'PENDING';
      const photoUrl = idxPhoto >= 0 && col[idxPhoto] ? col[idxPhoto] : '';
      const notes = idxNotes >= 0 ? col[idxNotes] || '' : '';

      // Normalize section
      let section: PullYardVehicle['section'] = 'Domestic Trucks & SUVs';
      if (rawSection.toLowerCase().includes('ford') || make.toLowerCase().includes('ford')) {
        section = 'Ford & Lincoln';
      } else if (rawSection.toLowerCase().includes('gm') || rawSection.toLowerCase().includes('chevy') || make.toLowerCase().includes('chevrolet')) {
        section = 'GM & Chevrolet';
      } else if (rawSection.toLowerCase().includes('dodge') || rawSection.toLowerCase().includes('chrysler') || make.toLowerCase().includes('dodge')) {
        section = 'Chrysler & Dodge';
      } else if (rawSection.toLowerCase().includes('asian') || rawSection.toLowerCase().includes('import') || ['toyota', 'honda', 'nissan'].includes(make.toLowerCase())) {
        section = 'Asian Imports';
      } else if (rawSection.toLowerCase().includes('euro') || ['bmw', 'mercedes', 'audi', 'volkswagen'].includes(make.toLowerCase())) {
        section = 'European';
      }

      // Normalize status
      let status: PullYardVehicleStatus = 'PENDING';
      if (rawStatus.includes('AVAIL')) status = 'AVAILABLE';
      if (rawStatus.includes('CRUSH') || rawStatus.includes('STRIP')) status = 'CRUSHED';

      const isValid = Boolean(make && model);
      const validationError = !isValid ? 'Missing Make or Model' : undefined;

      parsed.push({
        section,
        year,
        make,
        model,
        color,
        vin: vin.toUpperCase(),
        purchasePrice,
        originSource,
        status,
        photoUrl,
        notes,
        isValid,
        validationError,
      });
    }

    setParsedRows(parsed);
    if (parsed.length > 0) {
      toast.success(`Parsed ${parsed.length} vehicle rows from spreadsheet!`);
    } else {
      toast.error('Could not parse any vehicle rows. Check CSV formatting.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        parseCsvText(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImportVehicles = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid vehicle rows to import. Please check spreadsheet fields.');
      return;
    }

    let count = 0;
    validRows.forEach((r, idx) => {
      const newVeh: PullYardVehicle = {
        id: `veh-bulk-${Date.now()}-${idx}`,
        section: r.section,
        year: r.year,
        make: r.make,
        model: r.model,
        color: r.color,
        vin: r.vin || `BULK-${Math.floor(100000 + Math.random() * 900000)}`,
        dateSetInYard: new Date().toISOString(),
        status: r.status,
        partsRemaining: ['Engine', 'Transmission', 'Doors', 'Wheels', 'Fenders'],
        purchasePrice: r.purchasePrice,
        originSource: r.originSource,
        notes: r.notes || 'Bulk Spreadsheet Import',
        photoUrl: r.photoUrl.trim() || generateSamplePhoto('vehicle'),
        dismantlingLog: {
          catalyticConvertersRemoved: 0,
          wheelsRemoved: 0,
          gasDrained: false,
          oilDrained: false,
        },
      };
      storageService.savePullYardVehicle(newVeh);
      count++;
    });

    toast.success(`Successfully imported ${count} vehicles with photos into yard inventory!`);
    onUploadSuccess();
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="text-base font-bold font-mono">
              Bulk Add Vehicles & Photos from CSV Spreadsheet
            </DialogTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadSampleCsv}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" /> Download Sample CSV
          </Button>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          
          {/* Tab Selection: File Upload vs Paste CSV Text */}
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('FILE')}
              className={`flex-1 py-1.5 rounded-md font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'FILE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> 1. Upload CSV File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PASTE')}
              className={`flex-1 py-1.5 rounded-md font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'PASTE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> 2. Paste CSV Text
            </button>
          </div>

          {/* TAB 1: FILE UPLOAD BOX */}
          {activeTab === 'FILE' && (
            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 bg-slate-900/50 text-center space-y-3 hover:border-emerald-500/50 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Select or drop your vehicle CSV spreadsheet file</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supported CSV headers: Section, Year, Make, Model, Color, VIN, PurchasePrice, OriginSource, Status, <strong>PhotoUrl</strong>, Notes
                </p>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-950">
                <Upload className="w-4 h-4" /> Browse & Upload CSV Spreadsheet
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* TAB 2: PASTE TEXT AREA */}
          {activeTab === 'PASTE' && (
            <div className="space-y-2">
              <Label className="text-slate-300">Paste CSV Rows with Photo URLs from Excel / Google Sheets:</Label>
              <Textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'Section,Year,Make,Model,Color,VIN,PurchasePrice,OriginSource,Status,PhotoUrl,Notes\nDomestic Trucks,2008,Ford,F-150,White,1FTRF12W88KA10291,450,Tow Depot,AVAILABLE,https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500,Good engine'}
                className="bg-slate-900 border-slate-800 text-amber-300 font-mono text-xs"
              />
              <Button
                onClick={() => parseCsvText(pasteText)}
                disabled={!pasteText.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Parse Spreadsheet Data
              </Button>
            </div>
          )}

          {/* PREVIEW TABLE OF PARSED ROWS */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs font-mono">
                    {validCount} Valid Rows Ready
                  </Badge>
                  {parsedRows.length - validCount > 0 && (
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs font-mono">
                      {parsedRows.length - validCount} Invalid Rows Skipped
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">Total parsed: {parsedRows.length} vehicles</span>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-900">
                    <TableRow className="border-slate-800 text-[11px]">
                      <TableHead className="text-slate-400">Photo</TableHead>
                      <TableHead className="text-slate-400">Section</TableHead>
                      <TableHead className="text-slate-400">Vehicle Specs</TableHead>
                      <TableHead className="text-slate-400">VIN Number</TableHead>
                      <TableHead className="text-slate-400">Price & Origin</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Validity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow key={idx} className={`border-slate-800 text-xs font-mono ${row.isValid ? 'hover:bg-slate-900' : 'bg-rose-950/20'}`}>
                        <TableCell className="w-12 p-1.5">
                          <div className="w-10 h-8 rounded bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center">
                            {row.photoUrl ? (
                              <img src={row.photoUrl} alt="CSV photo" className="w-full h-full object-cover" />
                            ) : (
                              <Image className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-300">
                          {row.section}
                        </TableCell>
                        <TableCell className="font-sans font-bold text-white">
                          {row.year} {row.make} {row.model}
                        </TableCell>
                        <TableCell className="text-slate-400">{row.vin || 'Auto-Generated'}</TableCell>
                        <TableCell className="text-emerald-400 font-bold">${row.purchasePrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className="bg-slate-900 text-slate-300 border-slate-700 text-[10px]">
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> VALID
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1 text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-rose-400" /> {row.validationError}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

        </div>

        <DialogFooter className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} className="text-slate-400 text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleImportVehicles}
            disabled={validCount === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" /> Bulk Import {validCount} Valid Vehicles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};