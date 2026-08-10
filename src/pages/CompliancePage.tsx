import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { Ticket, NMVTISReportLog, ComplianceCaptures } from "@/types/scrap";
import {
  validateVin,
  generateNMVTISCsv,
  generateLawEnforcementLogCsv,
  downloadFile,
  calculateComplianceScore,
} from "@/utils/complianceUtils";
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
  ShieldCheck,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CreditCard,
  Fingerprint,
  FileText,
  Building,
  UserCheck,
  ShieldAlert,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "sonner";

export const CompliancePage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<NMVTISReportLog[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "REPORTED" | "DISCREPANCY">("ALL");
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);

  const yardSettings = storageService.getSettings();

  const loadData = () => {
    const allTickets = storageService.getTickets();
    const allLogs = storageService.getNMVTISLogs();
    setTickets(allTickets);
    setLogs(allLogs);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter salvage vehicle tickets
  const vehicleTickets = tickets.filter((t) => t.ticketType === 'CAR_SALVAGE' && t.carRecord);

  const filteredTickets = vehicleTickets.filter((t) => {
    const record = t.carRecord!;
    const isReported = t.complianceCaptures?.nmvtisReported || record.complianceCaptures?.nmvtisReported;
    const vinValid = validateVin(record.vin).isValid;

    if (statusFilter === "PENDING" && isReported) return false;
    if (statusFilter === "REPORTED" && !isReported) return false;
    if (statusFilter === "DISCREPANCY" && vinValid) return false;

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

  // Calculate Metrics
  const pendingCount = vehicleTickets.filter(
    (t) => !(t.complianceCaptures?.nmvtisReported || t.carRecord?.complianceCaptures?.nmvtisReported)
  ).length;

  const reportedCount = vehicleTickets.filter(
    (t) => t.complianceCaptures?.nmvtisReported || t.carRecord?.complianceCaptures?.nmvtisReported
  ).length;

  const discrepancyCount = vehicleTickets.filter(
    (t) => t.carRecord && !validateVin(t.carRecord.vin).isValid
  ).length;

  const totalPayoutPending = vehicleTickets
    .filter((t) => !(t.complianceCaptures?.nmvtisReported || t.carRecord?.complianceCaptures?.nmvtisReported))
    .reduce((acc, t) => acc + t.finalPayout, 0);

  // Toggle selection
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

  // Export NMVTIS Batch CSV
  const handleExportNMVTISBatch = () => {
    const targets = selectedTicketIds.length > 0
      ? vehicleTickets.filter((t) => selectedTicketIds.includes(t.id))
      : filteredTickets;

    if (targets.length === 0) {
      toast.error("No vehicle salvage records available to export");
      return;
    }

    const csvContent = generateNMVTISCsv(targets, yardSettings.nmvtisReportingId || yardSettings.licenseNumber);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const batchId = `NMVTIS-BATCH-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const filename = `${batchId}.csv`;

    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");

    // Record log & mark tickets reported
    const targetIds = targets.map((t) => t.id);
    storageService.markTicketsAsNMVTISReported(targetIds, batchId);

    const newLog: NMVTISReportLog = {
      id: `log-${Date.now()}`,
      batchId,
      exportedAt: new Date().toISOString(),
      ticketCount: targets.length,
      ticketIds: targetIds,
      status: "EXPORTED",
      exportedBy: yardSettings.operatorName,
      downloadUrl: filename,
    };

    storageService.saveNMVTISLog(newLog);
    loadData();
    setSelectedTicketIds([]);
    toast.success(`Exported ${targets.length} vehicle records to NMVTIS CSV!`, {
      description: `Batch ID: ${batchId}`,
    });
  };

  // Export Law Enforcement Anti-Theft Scrap Log
  const handleExportPoliceLog = () => {
    const csvContent = generateLawEnforcementLogCsv(tickets, yardSettings.yardName);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Police_Scrap_Metal_Log_${dateStr}.csv`;
    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
    toast.success("State Law Enforcement Anti-Theft Log Exported!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8">
      
      {/* Header Banner */}
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

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportPoliceLog}
            variant="outline"
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Law Enforcement Log (CSV)
          </Button>
          <Button
            onClick={handleExportNMVTISBatch}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 shadow-lg shadow-blue-950"
          >
            <Download className="w-4 h-4" /> Export NMVTIS Batch ({selectedTicketIds.length > 0 ? selectedTicketIds.length : filteredTickets.length})
          </Button>
        </div>
      </div>

      {/* Top Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending NMVTIS Export</p>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">{pendingCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">${totalPayoutPending.toFixed(2)} Value Pending</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Reported Vehicles</p>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{reportedCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">Uploaded to NMVTIS DB</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">VIN Discrepancy Alerts</p>
              <p className="text-2xl font-black text-rose-400 font-mono mt-1">{discrepancyCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">Non-17 Char or Invalid VINs</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Compliance Rate</p>
              <p className="text-2xl font-black text-sky-400 font-mono mt-1">100%</p>
              <p className="text-[11px] text-slate-500 mt-1">Photo + DL + Thumbprint Sealed</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Award className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="vehicles" className="w-full space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
            <Car className="w-3.5 h-3.5" /> Junk Vehicle Salvage Records ({vehicleTickets.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> NMVTIS Batch Export Logs ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: VEHICLE SALVAGE TABLE */}
        <TabsContent value="vehicles" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
            <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Car className="w-5 h-5 text-blue-400" /> Vehicle Intake & NMVTIS Audit Desk
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Select junk vehicles to validate VIN format, seller photo ID compliance, and generate NMVTIS CSV batch records.
                  </CardDescription>
                </div>

                {/* Filters */}
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
                    {(["ALL", "PENDING", "REPORTED", "DISCREPANCY"] as const).map((st) => (
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
                      <TableHead className="text-slate-400">Compliance Audit</TableHead>
                      <TableHead className="text-slate-400">NMVTIS Status</TableHead>
                      <TableHead className="text-right text-slate-400">Payout</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => {
                      const rec = ticket.carRecord!;
                      const vinAudit = validateVin(rec.vin);
                      const isReported = ticket.complianceCaptures?.nmvtisReported || rec.complianceCaptures?.nmvtisReported;
                      const isSelected = selectedTicketIds.includes(ticket.id);
                      const stats = calculateComplianceScore(ticket.complianceCaptures);

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
                            <span className="text-[10px] text-slate-400 font-mono">{ticket.customerIdNumber}</span>
                          </TableCell>

                          <TableCell className="font-sans">
                            <Badge
                              className={`text-[10px] ${
                                stats.score === 100
                                  ? "bg-emerald-950 text-emerald-400 border-emerald-500/40"
                                  : "bg-amber-950 text-amber-400 border-amber-500/40"
                              }`}
                            >
                              {stats.score}% Compliant
                            </Badge>
                          </TableCell>

                          <TableCell className="font-sans">
                            {isReported ? (
                              <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Reported
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-950 text-amber-400 border-amber-500/40 text-[10px] gap-1">
                                <Clock className="w-3 h-3 text-amber-400" /> Pending Export
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
                              onClick={() => setSelectedTicketForModal(ticket)}
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

        {/* TAB 2: EXPORT BATCH LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden">
            <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" /> NMVTIS Batch Export Audit Log
              </CardTitle>
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
                        <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-[10px]">
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compliance Inspector Detail Modal */}
      {selectedTicketForModal && (
        <Dialog open={!!selectedTicketForModal} onOpenChange={() => setSelectedTicketForModal(null)}>
          <DialogContent className="max-w-3xl bg-slate-950 text-slate-100 border-slate-800 p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    Salvage Record Compliance Inspection - #{selectedTicketForModal.id}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Full photo proof studio audit & NMVTIS submission status
                  </DialogDescription>
                </div>
                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40">
                  {selectedTicketForModal.carRecord?.vin}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Customer & Title details grid */}
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

              {/* Photos Gallery */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Attached Studio Photos & Biometrics:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "DL / State ID", url: selectedTicketForModal.complianceCaptures?.idPhotoUrl },
                    { label: "Seller Headshot", url: selectedTicketForModal.complianceCaptures?.personPhotoUrl },
                    { label: "Vehicle Snapshot", url: selectedTicketForModal.complianceCaptures?.vehiclePhotoUrl },
                    { label: "License Plate OCR", url: selectedTicketForModal.complianceCaptures?.licensePlatePhotoUrl },
                    { label: "Cargo Load View", url: selectedTicketForModal.complianceCaptures?.loadPhotoUrl },
                    { label: "Biometric Thumbprint", url: selectedTicketForModal.complianceCaptures?.thumbprintDataUrl },
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
    </div>
  );
};
