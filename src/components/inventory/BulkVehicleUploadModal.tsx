import React, { useState, useRef } from 'react';
import { PullYardVehicle, PullYardVehicleStatus } from '@/types/scrap';
import { storageService } from '@/services/storageService';
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
  RefreshCw,
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

// Quote-aware CSV line splitter
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

// Delimiter auto-detector
function detectDelimiter(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';') && !firstLine.includes(',')) return ';';
  return ',';
}

export const BulkVehicleUploadModal: React.FC<BulkVehicleUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedVehicleRow[]>([]);
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (lines.length === 0) {
      toast.error('The provided spreadsheet file or text is empty.');
      return;
    }

    const delimiter = detectDelimiter(lines[0]);
    const firstLineCols = parseCsvLine(lines[0], delimiter);
    const firstLineLower = firstLineCols.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Flexible Header Synonyms Match
    let idxSection = firstLineLower.findIndex((h) => h.includes('section') || h.includes('zone') || h.includes('category') || h.includes('dept'));
    let idxYear = firstLineLower.findIndex((h) => h.includes('year') || h === 'yr');
    let idxMake = firstLineLower.findIndex((h) => h.includes('make') || h.includes('brand') || h.includes('mfr') || h.includes('manufacturer') || h === 'car' || h === 'vehicle');
    let idxModel = firstLineLower.findIndex((h) => h.includes('model') || h.includes('trim') || h.includes('series') || h.includes('type'));
    let idxColor = firstLineLower.findIndex((h) => h.includes('color') || h.includes('paint') || h === 'clr');
    let idxVin = firstLineLower.findIndex((h) => h.includes('vin') || h.includes('serial'));
    let idxPrice = firstLineLower.findIndex((h) => h.includes('price') || h.includes('payout') || h.includes('cost') || h.includes('paid') || h.includes('amount') || h.includes('val'));
    let idxOrigin = firstLineLower.findIndex((h) => h.includes('origin') || h.includes('source') || h.includes('tow') || h.includes('from') || h.includes('loc'));
    let idxStatus = firstLineLower.findIndex((h) => h.includes('status') || h.includes('state') || h.includes('cond'));
    let idxPhoto = firstLineLower.findIndex((h) => h.includes('photo') || h.includes('image') || h.includes('picture') || h.includes('url') || h.includes('img') || h.includes('link') || h.includes('pic'));
    let idxNotes = firstLineLower.findIndex((h) => h.includes('note') || h.includes('desc') || h.includes('comment') || h.includes('info'));

    // Check if first line is actually data (no headers)
    const hasHeader = idxYear >= 0 || idxMake >= 0 || idxModel >= 0 || idxVin >= 0;
    const startIdx = hasHeader ? 1 : 0;

    const parsed: ParsedVehicleRow[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const col = parseCsvLine(lines[i], delimiter);
      if (col.length < 1 || col.every((c) => !c.trim())) continue;

      let year = idxYear >= 0 && col[idxYear] ? parseInt(col[idxYear]) : 0;
      let make = idxMake >= 0 && col[idxMake] ? col[idxMake] : '';
      let model = idxModel >= 0 && col[idxModel] ? col[idxModel] : '';
      let color = idxColor >= 0 && col[idxColor] ? col[idxColor] : 'Unknown';
      let vin = idxVin >= 0 && col[idxVin] ? col[idxVin] : '';
      let purchasePrice = idxPrice >= 0 && col[idxPrice] ? parseFloat(col[idxPrice].replace(/[^0-9.]/g, '')) || 0 : 0;
      let originSource = idxOrigin >= 0 && col[idxOrigin] ? col[idxOrigin] : 'Bulk CSV Import';
      let rawStatus = idxStatus >= 0 && col[idxStatus] ? col[idxStatus].toUpperCase() : 'PENDING';
      let photoUrl = idxPhoto >= 0 && col[idxPhoto] ? col[idxPhoto] : '';
      let notes = idxNotes >= 0 && col[idxNotes] ? col[idxNotes] : '';
      let rawSection = idxSection >= 0 && col[idxSection] ? col[idxSection] : '';

      // Fallback Smart Column Matchers if header is missing
      if (!year) {
        const yearCol = col.find((c) => /^(19\d{2}|20\d{2})$/.test(c.trim()));
        if (yearCol) year = parseInt(yearCol.trim());
      }
      if (!vin) {
        const vinCol = col.find((c) => c.trim().length === 17 && /^[A-HJ-NPR-Z0-9]+$/i.test(c.trim()));
        if (vinCol) vin = vinCol.trim();
      }
      if (!make && col.length >= 2) {
        // Find text column not matching numeric year
        const textCols = col.filter((c) => c.trim() && !/^\d+$/.test(c.trim()) && !c.includes('http'));
        if (textCols.length >= 1) make = textCols[0];
        if (textCols.length >= 2 && !model) model = textCols[1];
      }

      // Default Year if missing
      if (!year || isNaN(year)) year = new Date().getFullYear() - 10;

      // Section Normalization
      let section: PullYardVehicle['section'] = 'Domestic Trucks & SUVs';
      const sectionMatchStr = `${rawSection} ${make}`.toLowerCase();

      if (sectionMatchStr.includes('ford') || sectionMatchStr.includes('lincoln')) {
        section = 'Ford & Lincoln';
      } else if (sectionMatchStr.includes('gm') || sectionMatchStr.includes('chevy') || sectionMatchStr.includes('chevrolet') || sectionMatchStr.includes('gmc') || sectionMatchStr.includes('cadillac') || sectionMatchStr.includes('buick')) {
        section = 'GM & Chevrolet';
      } else if (sectionMatchStr.includes('dodge') || sectionMatchStr.includes('chrysler') || sectionMatchStr.includes('ram') || sectionMatchStr.includes('jeep')) {
        section = 'Chrysler & Dodge';
      } else if (sectionMatchStr.includes('asian') || sectionMatchStr.includes('import') || ['toyota', 'honda', 'nissan', 'hyundai', 'kia', 'subaru', 'mazda', 'lexus', 'acura', 'infinity'].some((m) => sectionMatchStr.includes(m))) {
        section = 'Asian Imports';
      } else if (sectionMatchStr.includes('euro') || ['bmw', 'mercedes', 'audi', 'volkswagen', 'volvo', 'porsche', 'jaguar'].some((m) => sectionMatchStr.includes(m))) {
        section = 'European';
      }

      // Status Normalization
      let status: PullYardVehicleStatus = 'PENDING';
      if (rawStatus.includes('AVAIL') || rawStatus.includes('YARD') || rawStatus.includes('READY')) status = 'AVAILABLE';
      if (rawStatus.includes('CRUSH') || rawStatus.includes('STRIP') || rawStatus.includes('BAIL')) status = 'CRUSHED';

      const isValid = Boolean(make && make.trim().length > 0);
      const validationError = !isValid ? 'Missing Make name' : undefined;

      parsed.push({
        section,
        year,
        make: make.trim(),
        model: model.trim() || 'Unspecified',
        color: color.trim() || 'Unknown',
        vin: vin.toUpperCase().trim(),
        purchasePrice,
        originSource: originSource.trim() || 'Bulk CSV Import',
        status,
        photoUrl: photoUrl.trim(),
        notes: notes.trim(),
        isValid,
        validationError,
      });
    }

    setParsedRows(parsed);
    if (parsed.length > 0) {
      toast.success(`Successfully parsed ${parsed.length} vehicle records from CSV!`);
    } else {
      toast.error('Could not extract valid vehicle rows. Please check spreadsheet formatting.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info(`Reading ${file.name}...`);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        parseCsvText(text);
      };
      reader.readAsText(file);
    }
    // Reset file input so re-selecting the same file works
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      toast.info(`Processing dropped file: ${file.name}...`);
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
        photoUrl: r.photoUrl.trim() || undefined,
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

    toast.success(`Successfully imported ${count} vehicles into yard inventory!`);
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
              <Upload className="w-3.5 h-3.5" /> 1. Upload or Drop CSV File
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

          {/* TAB 1: FILE UPLOAD & DROP BOX */}
          {activeTab === 'FILE' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-950/40'
                  : 'border-slate-800 bg-slate-900/50 hover:border-emerald-500/50'
              }`}
            >
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Select or Drag & Drop CSV Spreadsheet File</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supported CSV headers: Section, Year, Make, Model, Color, VIN, PurchasePrice, OriginSource, Status, <strong>PhotoUrl</strong>, Notes
                </p>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-950">
                <Upload className="w-4 h-4" /> Browse & Upload CSV Spreadsheet
                <input
                  ref={fileInputRef}
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setParsedRows([])}
                  className="text-slate-400 hover:text-white text-[11px] h-7 gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Clear Preview
                </Button>
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