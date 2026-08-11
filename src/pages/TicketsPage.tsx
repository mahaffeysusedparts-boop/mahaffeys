import React, { useState } from 'react';
import { Ticket } from '@/types/scrap';
import { storageService } from '@/services/storageService';
import { sharedStorage } from '@/services/sharedStorage';
import { Navbar } from '@/components/layout/Navbar';
import { ReceiptModal } from '@/components/receipts/ReceiptModal';
import { calculateComplianceScore } from '@/utils/complianceUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Receipt,
  Search,
  Printer,
  Eye,
  Car,
  Scale,
  Download,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(storageService.getTickets());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CAR_SALVAGE' | 'SCRAP_METAL'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [inspectionTicket, setInspectionTicket] = useState<Ticket | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const handlePrint = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReceiptOpen(true);
  };

  const handleVoidTicket = (id: string) => {
    const updated = tickets.map((t) => (t.id === id ? { ...t, status: 'VOIDED' as const } : t));
    setTickets(updated);
    sharedStorage.setItem('scrapflow_tickets', JSON.stringify(updated));
    toast.info(`Ticket #${id} marked as VOIDED`);
  };

  const handleExportCSV = () => {
    if (tickets.length === 0) return;
    const headers = ['Ticket ID', 'Type', 'Date', 'Customer', 'Plate / VIN', 'Compliance Score', 'Payout Method', 'Final Payout ($)'];
    const rows = tickets.map((t) => {
      const stats = calculateComplianceScore(t.complianceCaptures);
      return [
        t.id,
        t.ticketType,
        new Date(t.createdAt).toLocaleString(),
        `"${t.customerName}"`,
        `"${t.vehicleLicensePlate || t.carRecord?.vin || 'N/A'}"`,
        `"${stats.score}%"`,
        t.payoutMethod,
        t.finalPayout.toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ScrapFlow_Tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Ticket ledger exported to CSV');
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (t.vehicleLicensePlate && t.vehicleLicensePlate.toLowerCase().includes(search.toLowerCase())) ||
      (t.carRecord?.vin && t.carRecord.vin.toLowerCase().includes(search.toLowerCase()));

    const matchesType =
      typeFilter === 'ALL' ? true : t.ticketType === typeFilter;

    return matchesSearch && matchesType;
  });

  const totalPayoutSum = filteredTickets.reduce((acc, t) => (t.status === 'COMPLETED' ? acc + t.finalPayout : acc), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Intake Ticket & Payout Ledger
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Historical records for Pull-A-Part car salvage and scrap metal scale transactions with photo audit proof
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px]">TOTAL PERIOD PAYOUT:</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                ${totalPayoutSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Export CSV
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 text-white shadow-lg">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <Input
                placeholder="Search ticket #, seller name, plate or VIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs pl-9"
              />
            </div>

            <Tabs
              value={typeFilter}
              onValueChange={(val) => setTypeFilter(val as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-slate-950 border border-slate-800 text-xs">
                <TabsTrigger value="ALL" className="text-xs">All Tickets ({tickets.length})</TabsTrigger>
                <TabsTrigger value="CAR_SALVAGE" className="text-xs flex items-center gap-1">
                  <Car className="w-3 h-3 text-amber-400" /> Car Salvage
                </TabsTrigger>
                <TabsTrigger value="SCRAP_METAL" className="text-xs flex items-center gap-1">
                  <Scale className="w-3 h-3 text-emerald-400" /> Scrap Metal
                </TabsTrigger>
              </TabsList>
            </Tabs>

          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardContent className="p-0">
            {filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No intake tickets found matching your filter criteria.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                    <TableHead className="text-slate-400">Ticket ID</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Date & Time</TableHead>
                    <TableHead className="text-slate-400">Customer / Seller</TableHead>
                    <TableHead className="text-slate-400">Details / VIN</TableHead>
                    <TableHead className="text-slate-400">Compliance Audit</TableHead>
                    <TableHead className="text-slate-400 text-right">Method</TableHead>
                    <TableHead className="text-slate-400 text-right">Payout Total</TableHead>
                    <TableHead className="text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredTickets.map((t) => {
                    const caps = t.complianceCaptures || t.carRecord?.complianceCaptures;
                    const stats = calculateComplianceScore(caps);

                    return (
                      <TableRow key={t.id} className="border-slate-800 hover:bg-slate-800/50 text-xs">
                        
                        <TableCell className="font-mono font-bold text-amber-400">
                          {t.id}
                        </TableCell>

                        <TableCell>
                          {t.ticketType === 'CAR_SALVAGE' ? (
                            <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                              <Car className="w-3 h-3 mr-1" /> Auto Salvage
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                              <Scale className="w-3 h-3 mr-1" /> Scrap Metal
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-slate-300">
                          {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>

                        <TableCell className="font-semibold text-white">
                          {t.customerName}
                          <span className="block text-[10px] text-slate-400 font-mono">{t.customerIdNumber || 'ID Verified'}</span>
                        </TableCell>

                        <TableCell className="text-slate-300">
                          {t.ticketType === 'CAR_SALVAGE' && t.carRecord ? (
                            <div>
                              <span className="font-semibold">{t.carRecord.year} {t.carRecord.make} {t.carRecord.model}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">VIN: {t.carRecord.vin}</span>
                            </div>
                          ) : (
                            <div>
                              <span>{t.scrapLines?.length || 0} Scrap Item(s)</span>
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {t.scrapLines?.reduce((acc, l) => acc + l.billableWeight, 0)} lbs total
                              </span>
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            onClick={() => setInspectionTicket(t)}
                            className="cursor-pointer hover:opacity-80 text-[10px] gap-1"
                            variant="outline"
                          >
                            <ShieldCheck className="w-3 h-3 text-blue-400" />
                            {stats.score}% Studio Audit
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right text-slate-300 font-mono">
                          {t.payoutMethod}
                        </TableCell>

                        <TableCell className="text-right font-mono font-extrabold text-emerald-400 text-sm">
                          ${t.finalPayout.toFixed(2)}
                        </TableCell>

                        <TableCell className="text-center">
                          {t.status === 'COMPLETED' ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                              PAID
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">
                              VOIDED
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectionTicket(t)}
                            className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(t)}
                            className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Receipt
                          </Button>

                          {t.status === 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVoidTicket(t.id)}
                              className="h-7 px-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 text-xs"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </main>

      <ReceiptModal
        ticket={selectedTicket}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />

      {inspectionTicket && (
        <Dialog open={!!inspectionTicket} onOpenChange={() => setInspectionTicket(null)}>
          <DialogContent className="max-w-2xl bg-slate-950 text-slate-100 border-slate-800 p-6">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Compliance Photo Proof Audit - Ticket #{inspectionTicket.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Customer ID, Face Shot & License Plate Photo Audit
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                <div>Customer: <strong className="text-white">{inspectionTicket.customerName}</strong></div>
                <div>DL #: <strong className="text-amber-300">{inspectionTicket.customerIdNumber || 'N/A'}</strong></div>
                <div>Plate: <strong className="text-sky-300">{inspectionTicket.vehicleLicensePlate || 'N/A'}</strong></div>
                <div>Payout: <strong className="text-emerald-400">${inspectionTicket.finalPayout.toFixed(2)}</strong></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "DL Scan", url: inspectionTicket.complianceCaptures?.idPhotoUrl },
                  { label: "Seller Face", url: inspectionTicket.complianceCaptures?.personPhotoUrl },
                  { label: "Vehicle", url: inspectionTicket.complianceCaptures?.vehiclePhotoUrl },
                  { label: "License Plate", url: inspectionTicket.complianceCaptures?.licensePlatePhotoUrl },
                  { label: "Cargo Load", url: inspectionTicket.complianceCaptures?.loadPhotoUrl },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                    <div className="aspect-video bg-slate-950 rounded overflow-hidden mb-1 flex items-center justify-center">
                      {item.url ? (
                        <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-slate-600">No Photo</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-300 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}