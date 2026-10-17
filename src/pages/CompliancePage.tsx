import React, { useState, useEffect, useMemo } from "react";
import { storageService } from "@/services/storageService";
import { useAuth } from "@/context/AuthContext";
import { Ticket, NMVTISReportLog } from "@/types/scrap";
import {
  validateVin,
  generateNMVTISCsv,
  generateLawEnforcementLogCsv,
  downloadFile,
  calculateReadiness,
  getReportStatus,
  validateExportBatch,
  getReportStatusLabel,
  getCurrentOperatorName,
  getNmvtisStatus,
  isNmvtisBannerActive,
} from "@/utils/complianceUtils";
import { buildEvidencePackage, downloadEvidencePackage, EVIDENCE_MAX_TICKETS } from "@/utils/evidencePackage";
import {
  analyzeDriverLicenseImage,
  analyzeLicensePlateImage,
  AILicenseAnalysisResult,
  AILicensePlateResult,
} from "@/services/aiVisionService";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  Search,
  Eye,
  ShieldAlert,
  Award,
  Sparkles,
  Wand2,
  Loader2,
  Scan,
  CreditCard,
  Building,
  PackageCheck,
  CalendarClock,
  SendHorizonal,
  FileCheck,
  AlertOctagon,
} from "lucide-react";
import { toast } from "sonner";

export const CompliancePage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<NMVTISReportLog[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "READY" | "EXPORTED" | "CONFIRMED" | "DISCREPANCY">("ALL");
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);
  const [reportAllOpen, setReportAllOpen] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);

  // Export preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Submission confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingLogId, setConfirmingLogId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState("");

  // AI Vision Inspection State inside Modal
  const [isAiInspecting, setIsAiScanning] = useState(false);
  const [aiDlResult, setAiDlResult] = useState<AILicenseAnalysisResult | null>(null);
  const [aiPlateResult, setAiPlateResult] = useState<AILicensePlateResult | null>(null);

  const yardSettings = storageService.getSettings();
  const operatorName = getCurrentOperatorName(yardSettings, user);

  const loadData = () => {
    const allTickets = storageService.getTickets();
    const allLogs = storageService.getNMVTISLogs();
    setTickets(allTickets);
    setLogs(allLogs);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Vehicle tickets only (CAR_SALVAGE with a carRecord)
  const vehicleTickets = useMemo(
    () => tickets.filter((t) => t.ticketType === 'CAR_SALVAGE' && t.carRecord),
    [tickets]
  );

  // Readiness summary — computed from actual intake type, not a fixed KPI
  const readinessSummary = useMemo(() => {
    const summary = { complete: 0, incomplete: 0, invalidData: 0, pendingExport: 0 };
    vehicleTickets.forEach((t) => {
      const r = calculateReadiness(t);
      if (r.status === 'COMPLETE') summary.complete++;
      else if (r.status === 'INCOMPLETE') summary.incomplete++;
      else if (r.status === 'INVALID_DATA') summary.invalidData++;
      else if (r.status === 'PENDING_EXPORT') summary.pendingExport++;
    });
    return summary;
  }, [vehicleTickets]);

  // Filtered tickets based on search + status filter
  const filteredTickets = useMemo(() => {
    return vehicleTickets.filter((t) => {
      const record = t.carRecord!;
      const lifecycle = getReportStatus(t);
      const vinValid = validateVin(record.vin).isValid;

      if (statusFilter === "READY" && lifecycle !== 'READY') return false;
      if (statusFilter === "EXPORTED" && lifecycle !== 'EXPORTED') return false;
      if (statusFilter === "CONFIRMED" && lifecycle !== 'SUBMISSION_CONFIRMED') return false;
      if (statusFilter === "DISCREPANCY" && lifecycle !== 'DISCREPANCY') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchVin = record.vin.toLowerCase().includes(q);
        const matchCustomer = t.customerName.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchMake = record.make.toLowerCase().includes(q);
        return matchVin || matchCustomer || matchId || matchMake;
      }

      return true;
    });
  }, [vehicleTickets, statusFilter, searchTerm]);

  const pendingCount = readinessSummary.complete + readinessSummary.incomplete + readinessSummary.invalidData;
  const pendingVehicleTickets = vehicleTickets.filter(
    (t) => !calculateReadiness(t).isExported
  );

  const nmvtisStatus = getNmvtisStatus(logs, yardSettings);
  const nmvtisBannerActive = isNmvtisBannerActive(nmvtisStatus);

  const reportedCount = readinessSummary.pendingExport;
  const confirmedCount = vehicleTickets.filter((t) => calculateReadiness(t).isConfirmed).length;
  const discrepancyCount = readinessSummary.invalidData;

  const totalPayoutPending = vehicleTickets
    .filter((t) => !calculateReadiness(t).isExported)
    .reduce((acc, t) => acc + t.finalPayout, 0);

  const handleToggleSelectAll = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(filteredTickets.map((t) => t.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedTicketIds.includes(id)) {
      setSelectedTicketIds(selectedTicketIds.filter((item) => item !== id));
    } else {
      setSelectedTicketIds([...selectedTicketIds, id]);
    }
  };

  // Run AI Vision OCR on Ticket Photos inside Inspection Modal
  const handleRunAiAudit = async (ticket: Ticket) => {
    const captures = ticket.complianceCaptures || ticket.carRecord?.complianceCaptures;
    if (!captures) {
      toast.error("No compliance photos attached to run AI audit");
      return;
    }

    setIsAiScanning(true);
    setAiDlResult(null);
    setAiPlateResult(null);
    toast.info("AI Vision analyzing attached compliance photos...", { icon: "✨" });

    try {
      if (captures.idPhotoUrl) {
        const dlResult = await analyzeDriverLicenseImage(captures.idPhotoUrl);
        setAiDlResult(dlResult);
      }

      if (captures.licensePlatePhotoUrl) {
        const plateRes = await analyzeLicensePlateImage(captures.licensePlatePhotoUrl);
        setAiPlateResult(plateRes);
      }

      toast.success("AI OCR Inspection Complete!", {
        description: "Review extracted photo text against registered ticket records.",
      });
    } catch (err) {
      console.warn("AI OCR Audit Error:", err);
      toast.error("Unable to extract text from attached images.");
    } finally {
      setIsAiScanning(false);
    }
  };

  // ── Export workflow: preview → download (Exported) → confirm (Submission confirmed) ──

  const getExportTargets = () => {
    return selectedTicketIds.length > 0
      ? vehicleTickets.filter((t) => selectedTicketIds.includes(t.id))
      : filteredTickets;
  };

  const handleOpenExportPreview = () => {
    const targets = getExportTargets();
    if (targets.length === 0) {
      toast.error("No vehicle salvage records available to export");
      return;
    }
    setPreviewOpen(true);
  };

  const handleExportNMVTISBatch = () => {
    const targets = getExportTargets();
    if (targets.length === 0) return;

    const validation = validateExportBatch(targets);
    if (!validation.canExport) {
      toast.error("Export blocked — resolve data issues first", {
        description: `${validation.blockedRows.length} record(s) have invalid data or missing evidence.`,
      });
      return;
    }

    setIsExporting(true);
    const csvContent = generateNMVTISCsv(targets, yardSettings.nmvtisReportingId || yardSettings.licenseNumber);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const batchId = `NMVTIS-BATCH-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const filename = `${batchId}.csv`;

    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");

    const targetIds = targets.map((t) => t.id);
    storageService.markTicketsAsNMVTISReported(targetIds, batchId);

    const newLog: NMVTISReportLog = {
      id: `log-${Date.now()}`,
      batchId,
      exportedAt: new Date().toISOString(),
      ticketCount: targets.length,
      ticketIds: targetIds,
      status: "EXPORTED",
      exportedBy: operatorName,
      downloadUrl: filename,
    };

    storageService.saveNMVTISLog(newLog);
    loadData();
    setSelectedTicketIds([]);
    setPreviewOpen(false);
    toast.success(`Exported ${targets.length} vehicle records to NMVTIS CSV!`, {
      description: `Batch ID: ${batchId} — status: Exported (not yet submitted to NMVTIS)`,
    });
  };

  const handleExportPoliceLog = () => {
    const csvContent = generateLawEnforcementLogCsv(tickets, yardSettings.yardName);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Police_Scrap_Metal_Log_${dateStr}.csv`;
    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
    toast.success("State Law Enforcement Anti-Theft Log Exported!");
  };

  // One-click batch: marks every pending vehicle as reported, logs one batch entry,
  // and downloads the NMVTIS CSV in a single action.
  const handleReportAllPending = () => {
    if (pendingVehicleTickets.length === 0) {
      toast.info("No vehicles are pending NMVTIS reporting");
      return;
    }

    const validation = validateExportBatch(pendingVehicleTickets);
    if (!validation.canExport) {
      toast.error("Export blocked — resolve data issues first", {
        description: `${validation.blockedRows.length} record(s) have invalid data or missing evidence.`,
      });
      return;
    }

    const csvContent = generateNMVTISCsv(pendingVehicleTickets, yardSettings.nmvtisReportingId || yardSettings.licenseNumber);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const batchId = `NMVTIS-BATCH-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    downloadFile(csvContent, `${batchId}.csv`, "text/csv;charset=utf-8;");

    const targetIds = pendingVehicleTickets.map((t) => t.id);
    storageService.markTicketsAsNMVTISReported(targetIds, batchId);

    storageService.saveNMVTISLog({
      id: `log-${Date.now()}`,
      batchId,
      exportedAt: new Date().toISOString(),
      ticketCount: targetIds.length,
      ticketIds: targetIds,
      status: "EXPORTED",
      exportedBy: operatorName,
      downloadUrl: `${batchId}.csv`,
    });

    loadData();
    setSelectedTicketIds([]);
    setReportAllOpen(false);
    toast.success(`Exported ${targetIds.length} vehicles to NMVTIS CSV`, {
      description: `Batch ${batchId} · status: Exported (not yet submitted to NMVTIS)`,
    });
  };

  // Mark a batch as submission-confirmed by an operator
  const handleConfirmSubmission = () => {
    if (!confirmingLogId) return;
    const log = logs.find((l) => l.id === confirmingLogId);
    if (!log) return;

    const now = new Date().toISOString();
    const updatedLog: NMVTISReportLog = {
      ...log,
      status: "SUBMISSION_CONFIRMED",
      submissionConfirmedBy: operatorName,
      submissionConfirmedAt: now,
      submissionNote: confirmNote || undefined,
    };
    storageService.saveNMVTISLog(updatedLog);
    storageService.markTicketsAsNMVTISConfirmed(log.ticketIds, operatorName, now, confirmNote || undefined);

    loadData();
    setConfirmOpen(false);
    setConfirmingLogId(null);
    setConfirmNote("");
    toast.success("Submission confirmed", {
      description: `Batch ${log.batchId} marked as submitted by ${operatorName} at ${new Date().toLocaleString()}`,
    });
  };

  // Evidence ZIP: works with the multi-select, or the whole filtered view.
  const handlePackageEvidence = async (scopeTickets?: Ticket[]) => {
    const targets = scopeTickets ?? (selectedTicketIds.length > 0
      ? vehicleTickets.filter((t) => selectedTicketIds.includes(t.id))
      : filteredTickets);

    if (targets.length === 0) {
      toast.error("No vehicle records selected to package");
      return;
    }
    if (targets.length > EVIDENCE_MAX_TICKETS) {
      toast.error(`Too many tickets for one package (${targets.length})`, {
        description: `Cap is ${EVIDENCE_MAX_TICKETS} — split the selection by month.`,
      });
      return;
    }

    setIsPackaging(true);
    const toastId = toast.loading("Building evidence package…", {
      description: "Collecting compliance photos and CSVs",
    });
    try {
      const result = await buildEvidencePackage(targets, {
        settings: yardSettings,
        operatorName,
        onProgress: (done, total) => {
          if (total > 0 && done % 5 === 0) {
            toast.loading("Building evidence package…", {
              id: toastId,
              description: `${done}/${total} photos collected`,
            });
          }
        },
      });
      downloadEvidencePackage(result);
      toast.success(`Evidence package ready — ${result.fileCount} files`, {
        id: toastId,
        description: `${result.fileName}${result.skippedPhotos ? ` · ${result.skippedPhotos} photo(s) skipped` : ""}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evidence packaging failed", { id: toastId });
    } finally {
      setIsPackaging(false);
    }
  };

  // ── Export preview validation ──
  const exportPreview = useMemo(() => {
    const targets = getExportTargets();
    if (targets.length === 0) return null;
    return validateExportBatch(targets);
  }, [selectedTicketIds, filteredTickets, tickets]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  NMVTIS Compliance & Legal Hub
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  FEDERAL AUTO SALVAGE COMPLIANT
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                National Motor Vehicle Title Information System (NMVTIS) Batch Reporter & State Anti-Theft Registry
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleExportPoliceLog}
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Law Enforcement Log (CSV)
            </Button>
            <Button
              onClick={() => handlePackageEvidence()}
              disabled={isPackaging}
              variant="outline"
              className="border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 text-xs gap-1.5"
            >
              {isPackaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Package Evidence ({selectedTicketIds.length > 0 ? selectedTicketIds.length : filteredTickets.length})
            </Button>
            <Button
              onClick={handleOpenExportPreview}
              variant="outline"
              className="border-blue-500/40 bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 text-xs gap-1.5"
            >
              <Download className="w-4 h-4" /> Export Selected ({selectedTicketIds.length > 0 ? selectedTicketIds.length : filteredTickets.length})
            </Button>
            <Button
              onClick={() => setReportAllOpen(true)}
              disabled={pendingCount === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 shadow-lg shadow-blue-950"
            >
              <SendHorizonal className="w-4 h-4" /> Report All Pending ({pendingCount})
            </Button>
          </div>
        </div>

        {/* NMVTIS CADENCE BANNER — amber within 7 days of due, rose once overdue */}
        {nmvtisBannerActive && (
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 ${
              nmvtisStatus.isOverdue
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <CalendarClock
                className={`w-5 h-5 mt-0.5 shrink-0 ${nmvtisStatus.isOverdue ? "text-rose-400 animate-pulse" : "text-amber-400"}`}
              />
              <div>
                <p className={`text-sm font-bold ${nmvtisStatus.isOverdue ? "text-rose-300" : "text-amber-200"}`}>
                  {nmvtisStatus.isOverdue
                    ? `NMVTIS report overdue — was due ${nmvtisStatus.dueDate.toLocaleDateString()}`
                    : `NMVTIS report due ${nmvtisStatus.dueDate.toLocaleDateString()} — ${nmvtisStatus.daysUntilDue} day${nmvtisStatus.daysUntilDue === 1 ? "" : "s"}`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {pendingCount} vehicle{pendingCount === 1 ? "" : "s"} pending ·{" "}
                  {nmvtisStatus.lastBatchDate
                    ? `last batch ${new Date(nmvtisStatus.lastBatchDate).toLocaleDateString()}`
                    : "no batch exported yet"}
                  {" · "}cadence set in Settings
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setReportAllOpen(true)}
              disabled={pendingCount === 0}
              className={`text-white font-bold text-xs shrink-0 ${
                nmvtisStatus.isOverdue ? "bg-rose-600 hover:bg-rose-500" : "bg-amber-600 hover:bg-amber-500"
              }`}
            >
              <SendHorizonal className="w-4 h-4 mr-1.5" /> Report All Pending Now
            </Button>
          </div>
        )}

        {/* Readiness KPI cards — computed, not hard-coded */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Ready for Export</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{readinessSummary.complete}</p>
                <p className="text-[11px] text-slate-500 mt-1">All evidence present &amp; VIN valid</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Incomplete Records</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-1">{readinessSummary.incomplete}</p>
                <p className="text-[11px] text-slate-500 mt-1">Missing required photos</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Invalid Data</p>
                <p className="text-2xl font-black text-rose-400 font-mono mt-1">{readinessSummary.invalidData}</p>
                <p className="text-[11px] text-slate-500 mt-1">VIN or critical field issues</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertOctagon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Exported / Awaiting Confirmation</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-1">{readinessSummary.pendingExport}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {confirmedCount} confirmed · ${totalPayoutPending.toFixed(2)} value pending
                </p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vehicles" className="w-full space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger value="vehicles" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <Car className="w-3.5 h-3.5" /> Junk Vehicle Salvage Records ({vehicleTickets.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> NMVTIS Batch Export Logs ({logs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Car className="w-5 h-5 text-blue-400" /> Vehicle Intake & NMVTIS Audit Desk
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500 mt-1">
                      Readiness is calculated per intake type. Voided tickets are excluded from active reporting.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <Input
                        placeholder="Search VIN, customer, make..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-xs pl-8 w-48 sm:w-64"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                      {(["ALL", "READY", "EXPORTED", "CONFIRMED", "DISCREPANCY"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                            statusFilter === st ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredTickets.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs">No vehicle salvage intake records matched the filter.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-950/80">
                      <TableRow className="border-slate-800 text-xs">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedTicketIds.length === filteredTickets.length && filteredTickets.length > 0}
                            onCheckedChange={handleToggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="text-slate-400">Ticket ID / Date</TableHead>
                        <TableHead className="text-slate-400">VIN Number</TableHead>
                        <TableHead className="text-slate-400">Vehicle Description</TableHead>
                        <TableHead className="text-slate-400">Title Document</TableHead>
                        <TableHead className="text-slate-400">Seller Details</TableHead>
                        <TableHead className="text-slate-400">Readiness</TableHead>
                        <TableHead className="text-slate-400">NMVTIS Status</TableHead>
                        <TableHead className="text-right text-slate-400">Payout</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => {
                        const rec = ticket.carRecord!;
                        const vinAudit = validateVin(rec.vin);
                        const readiness = calculateReadiness(ticket);
                        const lifecycle = getReportStatus(ticket);
                        const isSelected = selectedTicketIds.includes(ticket.id);

                        const readinessColor =
                          readiness.status === 'COMPLETE'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            : readiness.status === 'INVALID_DATA'
                            ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                            : readiness.status === 'PENDING_EXPORT'
                            ? 'bg-sky-950 text-sky-400 border-sky-500/40'
                            : 'bg-amber-950 text-amber-400 border-amber-500/40';

                        const lifecycleColor =
                          lifecycle === 'SUBMISSION_CONFIRMED'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            : lifecycle === 'EXPORTED'
                            ? 'bg-amber-950 text-amber-400 border-amber-500/40'
                            : lifecycle === 'DISCREPANCY'
                            ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-600';

                        return (
                          <TableRow
                            key={ticket.id}
                            className={`border-slate-800 hover:bg-slate-800/40 text-xs font-mono transition-colors ${
                              isSelected ? "bg-blue-950/30" : ""
                            }`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelectOne(ticket.id)}
                              />
                            </TableCell>

                            <TableCell className="font-sans font-semibold text-white">
                              {ticket.id}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {new Date(ticket.createdAt).toLocaleDateString()}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-bold tracking-wider font-mono ${
                                    vinAudit.isValid ? "text-amber-300" : "text-rose-400 underline"
                                  }`}
                                >
                                  {rec.vin}
                                </span>
                                {!vinAudit.isValid && (
                                  <Badge className="bg-rose-950 text-rose-400 border-rose-500/40 text-[9px] p-0.5">
                                    INVALID
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="font-sans text-slate-200">
                              {rec.year} {rec.make} {rec.model}
                              <span className="block text-[10px] text-slate-400">{rec.color} | {rec.vehicleWeightLbs} LBS</span>
                            </TableCell>

                            <TableCell className="font-sans">
                              <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                                {rec.titleStatus}
                              </Badge>
                            </TableCell>

                            <TableCell className="font-sans">
                              <span className="text-white font-medium block">{ticket.customerName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{ticket.customerIdNumber || "—"}</span>
                            </TableCell>

                            <TableCell className="font-sans">
                              <Badge className={`text-[10px] ${readinessColor}`}>
                                {readiness.status === 'COMPLETE' ? 'Ready' : readiness.status === 'INVALID_DATA' ? 'Invalid Data' : readiness.status === 'PENDING_EXPORT' ? 'Exported' : 'Incomplete'}
                              </Badge>
                              {readiness.missingItems.length > 0 && (
                                <div className="mt-1 text-[9px] text-slate-500">
                                  Missing: {readiness.missingItems.join(', ')}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="font-sans">
                              {lifecycle === 'SUBMISSION_CONFIRMED' ? (
                                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-[10px] gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Submission Confirmed
                                </Badge>
                              ) : lifecycle === 'EXPORTED' ? (
                                <Badge className="bg-amber-950 text-amber-400 border-amber-500/40 text-[10px] gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" /> Exported
                                </Badge>
                              ) : lifecycle === 'DISCREPANCY' ? (
                                <Badge className="bg-rose-950 text-rose-400 border-rose-500/40 text-[10px] gap-1">
                                  <AlertOctagon className="w-3 h-3 text-rose-400" /> Discrepancy
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-950 text-slate-400 border-slate-600 text-[10px] gap-1">
                                  <ShieldAlert className="w-3 h-3 text-slate-400" /> Ready
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-bold text-emerald-400 font-mono text-sm">
                              ${ticket.finalPayout.toFixed(2)}
                            </TableCell>

                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTicketForModal(ticket);
                                  setAiDlResult(null);
                                  setAiPlateResult(null);
                                }}
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
              <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" /> NMVTIS Batch Export Audit Log
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500 mt-1">
                  Download = Exported. Only click "Confirm Submission" after NMVTIS has actually received the batch.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950/80">
                    <TableRow className="border-slate-800 text-xs">
                      <TableHead className="text-slate-400">Batch Identifier</TableHead>
                      <TableHead className="text-slate-400">Export Timestamp</TableHead>
                      <TableHead className="text-slate-400">Vehicle Records Count</TableHead>
                      <TableHead className="text-slate-400">Operator</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Confirmed By</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                        <TableCell className="font-bold text-blue-400">{log.batchId}</TableCell>
                        <TableCell className="text-slate-300">{new Date(log.exportedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-slate-200 font-bold">{log.ticketCount} Vehicles</TableCell>
                        <TableCell className="text-slate-400 font-sans">{log.exportedBy}</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] ${
                              log.status === 'SUBMISSION_CONFIRMED'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                                : log.status === 'EXPORTED'
                                ? 'bg-amber-950 text-amber-400 border-amber-500/40'
                                : log.status === 'DISCREPANCY'
                                ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                                : 'bg-slate-950 text-slate-400 border-slate-600'
                            }`}
                          >
                            {getReportStatusLabel(log)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 font-sans">
                          {log.submissionConfirmedBy
                            ? `${log.submissionConfirmedBy} @ ${new Date(log.submissionConfirmedAt!).toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {log.status === 'EXPORTED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setConfirmingLogId(log.id);
                                setConfirmNote("");
                                setConfirmOpen(true);
                              }}
                              className="h-7 text-xs text-sky-400 hover:text-sky-300 hover:bg-slate-800"
                              title="Mark as submission confirmed"
                            >
                              <SendHorizonal className="w-3.5 h-3.5" /> Confirm
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* EXPORT PREVIEW DIALOG */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl bg-slate-950 text-slate-100 border-slate-800 p-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-400" /> NMVTIS Export Preview
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Review the batch before downloading. Voided records are excluded. Blocked rows must be resolved before export.
              </DialogDescription>
            </DialogHeader>

            {exportPreview && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Total Selected</p>
                    <p className="text-xl font-black text-white">{exportPreview.totalTickets}</p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Included</p>
                    <p className="text-xl font-black text-emerald-400">{exportPreview.includedTickets}</p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Excluded (Voided)</p>
                    <p className="text-xl font-black text-slate-400">{exportPreview.excludedVoided}</p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Blocked</p>
                    <p className="text-xl font-black text-rose-400">{exportPreview.blockedRows.length}</p>
                  </div>
                </div>

                {exportPreview.warnedRows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Review Before Export ({exportPreview.warnedRows.length} record{exportPreview.warnedRows.length === 1 ? '' : 's'})
                    </p>
                    <div className="max-h-32 overflow-y-auto rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-1">
                      {exportPreview.warnedRows.map((row) => (
                        <div key={row.ticketId} className="text-[11px] font-mono">
                          <span className="text-amber-300">{row.ticketId}</span>
                          {row.vin && <span className="text-slate-500"> · VIN: {row.vin}</span>}
                          <div className="text-slate-400 mt-0.5">{row.warnings.join('; ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {exportPreview.blockedRows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4" /> Blocked Records ({exportPreview.blockedRows.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-1">
                      {exportPreview.blockedRows.map((row) => (
                        <div key={row.ticketId} className="text-[11px] font-mono">
                          <span className="text-rose-300">{row.ticketId}</span>
                          {row.vin && <span className="text-slate-500"> · VIN: {row.vin}</span>}
                          <div className="text-slate-400 mt-0.5">{row.issues.join('; ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(false)}
                    className="border-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExportNMVTISBatch}
                    disabled={isExporting || !exportPreview.canExport}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                  >
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {isExporting ? 'Exporting...' : `Download CSV (${exportPreview.includedTickets} records)`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* SUBMISSION CONFIRMATION DIALOG */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[520px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                <SendHorizonal className="w-5 h-5 text-emerald-400" /> Confirm NMVTIS Submission?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-400">
                This marks the batch as <strong className="text-white">Submission Confirmed</strong> — meaning NMVTIS has
                actually received and accepted the data. This action is attributed to <strong className="text-sky-300">{operatorName}</strong>{' '}
                and cannot be undone. Only click confirm after verifying the external submission.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmation note (optional)</label>
              <Input
                placeholder="e.g. NMVTIS confirmation #12345"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                className="bg-slate-900 border-slate-700 text-xs mt-1"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                className="text-slate-400 text-xs"
                onClick={() => {
                  setConfirmNote("");
                  setConfirmingLogId(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSubmission}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Submission
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* COMPLIANCE INSPECTION & AI VISION AUDIT DIALOG */}
        {selectedTicketForModal && (
          <Dialog open={!!selectedTicketForModal} onOpenChange={() => setSelectedTicketForModal(null)}>
            <DialogContent className="max-w-3xl bg-slate-950 text-slate-100 border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="border-b border-slate-800 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-400" />
                      Salvage Record Compliance Inspection - #{selectedTicketForModal.id}
                    </DialogTitle>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRunAiAudit(selectedTicketForModal)}
                      disabled={isAiInspecting}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5"
                    >
                      {isAiInspecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      Run AI Photo OCR Audit
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePackageEvidence([selectedTicketForModal])}
                      disabled={isPackaging}
                      className="border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 font-bold text-xs gap-1.5"
                    >
                      {isPackaging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                      Package Evidence
                    </Button>

                    <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 font-mono">
                      {selectedTicketForModal.carRecord?.vin}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">

                {/* AI OCR Verification Box */}
                {(aiDlResult || aiPlateResult) && (
                  <Card className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-900 border-2 border-purple-500/50 text-white p-3.5 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                      <span className="font-extrabold text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" /> AI OCR Audit Cross-Check Verification
                      </span>
                      <Badge className="bg-purple-900 text-purple-200 border-purple-500/40 text-[10px]">
                        AI OCR SCAN COMPLETE
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                      {aiDlResult && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Extracted Name:</span>
                          <span className="text-white font-bold">{aiDlResult.fullName}</span>
                        </div>
                      )}
                      {aiDlResult && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Extracted DL #:</span>
                          <span className="text-amber-300 font-bold">{aiDlResult.idNumber} ({aiDlResult.idState})</span>
                        </div>
                      )}
                      {aiPlateResult && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Extracted License Plate:</span>
                          <span className="text-sky-300 font-bold">{aiPlateResult.plateNumber} ({aiPlateResult.state})</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Seller Name</span>
                    <span className="text-white font-bold">{selectedTicketForModal.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Driver License</span>
                    <span className="text-amber-300 font-bold">{selectedTicketForModal.customerIdNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">License Plate</span>
                    <span className="text-sky-300 font-bold">{selectedTicketForModal.vehicleLicensePlate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Vehicle Spec</span>
                    <span className="text-slate-200">
                      {selectedTicketForModal.carRecord?.year} {selectedTicketForModal.carRecord?.make} {selectedTicketForModal.carRecord?.model}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Title Status</span>
                    <span className="text-emerald-400 font-bold">{selectedTicketForModal.carRecord?.titleStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Payout Amount</span>
                    <span className="text-emerald-400 font-extrabold">${selectedTicketForModal.finalPayout.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Attached Studio Photos:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: "DL / State ID", url: selectedTicketForModal.complianceCaptures?.idPhotoUrl },
                      { label: "Seller Headshot", url: selectedTicketForModal.complianceCaptures?.personPhotoUrl },
                      { label: "Vehicle Snapshot", url: selectedTicketForModal.complianceCaptures?.vehiclePhotoUrl },
                      { label: "License Plate OCR", url: selectedTicketForModal.complianceCaptures?.licensePlatePhotoUrl },
                      { label: "Cargo Load View", url: selectedTicketForModal.complianceCaptures?.loadPhotoUrl },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-center">
                        <div className="aspect-video bg-slate-950 rounded overflow-hidden mb-1 flex items-center justify-center">
                          {item.url ? (
                            <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-600">No Image Captured</span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-300">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* REPORT ALL PENDING CONFIRMATION — shows the count + VIN preview */}
        <AlertDialog open={reportAllOpen} onOpenChange={setReportAllOpen}>
          <AlertDialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[520px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                <SendHorizonal className="w-5 h-5 text-blue-400" /> Export all pending vehicles to NMVTIS CSV?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-400">
                This downloads a CSV for <strong className="text-white">{pendingVehicleTickets.length}</strong> pending
                vehicle ticket{pendingVehicleTickets.length === 1 ? "" : "s"} and records them as <strong className="text-amber-300">Exported</strong>.
                Downloading does <strong className="text-white">not</strong> confirm submission to NMVTIS — use the
                batch log to confirm after the external submission is verified.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1 font-mono text-[11px]">
              {pendingVehicleTickets.slice(0, 50).map((t) => (
                <div key={t.id} className="flex justify-between gap-3">
                  <span className="text-amber-300">{t.carRecord?.vin || 'NO VIN'}</span>
                  <span className="text-slate-500 truncate">{t.customerName}</span>
                </div>
              ))}
              {pendingVehicleTickets.length > 50 && (
                <p className="text-slate-500 pt-1">…and {pendingVehicleTickets.length - 50} more</p>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className="text-slate-400 text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReportAllPending}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                <SendHorizonal className="w-3.5 h-3.5 mr-1.5" /> Export {pendingVehicleTickets.length} Vehicles
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};