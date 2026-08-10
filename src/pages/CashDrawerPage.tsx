import React, { useState, useEffect } from "react";
import { storageService } from "@/services/storageService";
import { CashDrawerLog } from "@/types/scrap";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Banknote,
  Plus,
  Minus,
  CheckCircle2,
  DollarSign,
  History,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Calculator,
  Receipt,
  Vault,
} from "lucide-react";
import { toast } from "sonner";

export default function CashDrawerPage() {
  const [logs, setLogs] = useState<CashDrawerLog[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);

  // Replenish form
  const [addAmount, setAddAmount] = useState(2000);
  const [addNotes, setAddNotes] = useState("Armored vault cash replenishment");

  // Reconcile physical bill count state
  const [bills100, setBills100] = useState(25);
  const [bills50, setBills50] = useState(10);
  const [bills20, setBills20] = useState(40);
  const [bills10, setBills10] = useState(20);
  const [bills5, setBills5] = useState(10);
  const [bills1, setBills1] = useState(50);

  const loadData = () => {
    setLogs(storageService.getCashDrawerLogs());
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentBalance = logs[0] ? logs[0].balanceAfter : 0;

  // Add Cash Replenishment
  const handleAddCash = () => {
    if (addAmount <= 0) {
      toast.error("Please enter a valid cash amount");
      return;
    }
    const currentOp = storageService.getSettings().operatorName;
    storageService.addCashDrawerEntry({
      type: "VAULT_REPLENISHMENT",
      amount: Math.abs(addAmount),
      operatorName: currentOp,
      notes: addNotes,
    });
    loadData();
    setAddModalOpen(false);
    toast.success(`Added $${addAmount.toFixed(2)} to Cash Drawer Vault`);
  };

  // Reconcile Audit
  const countedTotal =
    bills100 * 100 +
    bills50 * 50 +
    bills20 * 20 +
    bills10 * 10 +
    bills5 * 5 +
    bills1 * 1;

  const discrepancy = countedTotal - currentBalance;

  const handlePerformAudit = () => {
    const currentOp = storageService.getSettings().operatorName;
    storageService.addCashDrawerEntry({
      type: "CLOSING_AUDIT",
      amount: Math.round(discrepancy * 100) / 100,
      operatorName: currentOp,
      notes: `End-of-day physical count audit (${discrepancy >= 0 ? "+" : ""}$${discrepancy.toFixed(2)} discrepancy)`,
    });
    loadData();
    setReconcileModalOpen(false);
    toast.success(`End-of-day cash reconciliation completed!`, {
      description: `Counted Total: $${countedTotal.toFixed(2)}`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Banknote className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Paymaster Cash Drawer & Vault Station
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  REAL-TIME BALANCING
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage cash floats, automatic payout disbursements, armored vault additions, and physical bill counts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setReconcileModalOpen(true)}
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold gap-1.5"
            >
              <Calculator className="w-4 h-4 text-amber-400" /> Physical Bill Audit
            </Button>

            <Button
              onClick={() => setAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-950"
            >
              <Vault className="w-4 h-4" /> Add Cash Float
            </Button>
          </div>
        </div>

        {/* Top Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-emerald-500/30 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Live Cash Drawer Balance</p>
                <p className="text-3xl font-black text-emerald-400 font-mono mt-1">
                  ${currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Available for customer cash vouchers</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Banknote className="w-8 h-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Today's Total Cash Paid Out</p>
                <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                  $
                  {Math.abs(
                    logs
                      .filter((l) => l.type === "PAYOUT_DISBURSEMENT")
                      .reduce((acc, l) => acc + l.amount, 0)
                  ).toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {logs.filter((l) => l.type === "PAYOUT_DISBURSEMENT").length} Cash Ticket Disbursements
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Receipt className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Vault Additions Today</p>
                <p className="text-2xl font-black text-sky-400 font-mono mt-1">
                  $
                  {logs
                    .filter((l) => l.type === "VAULT_REPLENISHMENT" || l.type === "OPENING_FLOAT")
                    .reduce((acc, l) => acc + l.amount, 0)
                    .toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Float & replenishment transfers</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Vault className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History Log Table */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/60 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" /> Cash Drawer Transaction Log
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow className="border-slate-800 text-xs">
                  <TableHead className="text-slate-400">Timestamp</TableHead>
                  <TableHead className="text-slate-400">Transaction Type</TableHead>
                  <TableHead className="text-slate-400">Ticket Ref</TableHead>
                  <TableHead className="text-slate-400">Operator</TableHead>
                  <TableHead className="text-slate-400">Notes</TableHead>
                  <TableHead className="text-right text-slate-400">Amount</TableHead>
                  <TableHead className="text-right text-slate-400">Drawer Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                    <TableCell className="text-slate-300">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>

                    <TableCell className="font-sans">
                      {log.type === "OPENING_FLOAT" && (
                        <Badge className="bg-sky-950 text-sky-300 border-sky-800 text-[10px]">
                          OPENING FLOAT
                        </Badge>
                      )}
                      {log.type === "PAYOUT_DISBURSEMENT" && (
                        <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                          PAYOUT
                        </Badge>
                      )}
                      {log.type === "VAULT_REPLENISHMENT" && (
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                          REPLENISHMENT
                        </Badge>
                      )}
                      {log.type === "CLOSING_AUDIT" && (
                        <Badge className="bg-purple-950 text-purple-300 border-purple-800 text-[10px]">
                          CLOSING AUDIT
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="font-bold text-amber-400 font-mono">
                      {log.ticketId || "-"}
                    </TableCell>

                    <TableCell className="font-sans text-slate-300">{log.operatorName}</TableCell>

                    <TableCell className="font-sans text-slate-400 text-[11px] max-w-xs truncate">
                      {log.notes}
                    </TableCell>

                    <TableCell className={`text-right font-bold text-sm font-mono ${
                      log.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {log.amount >= 0 ? "+" : ""}${log.amount.toFixed(2)}
                    </TableCell>

                    <TableCell className="text-right font-black text-white font-mono text-sm">
                      ${log.balanceAfter.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </main>

      {/* Add Cash Float Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Vault className="w-5 h-5 text-emerald-400" /> Vault Cash Replenishment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-slate-300">Replenishment Amount ($) *</Label>
              <Input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border-slate-800 text-emerald-400 font-bold font-mono text-base mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Notes / Transfer Source</Label>
              <Input
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Armored drop or safe transfer..."
                className="bg-slate-900 border-slate-800 text-white text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleAddCash} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              Add to Drawer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Physical Bill Count Reconcile Modal */}
      <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
        <DialogContent className="bg-slate-950 text-slate-100 border-slate-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" /> Physical Bill Count Audit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-400">Enter the physical bill count in the cash drawer:</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">$100 Bills ({bills100 * 100})</Label>
                <Input
                  type="number"
                  value={bills100}
                  onChange={(e) => setBills100(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">$50 Bills (${bills50 * 50})</Label>
                <Input
                  type="number"
                  value={bills50}
                  onChange={(e) => setBills50(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">$20 Bills (${bills20 * 20})</Label>
                <Input
                  type="number"
                  value={bills20}
                  onChange={(e) => setBills20(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">$10 Bills (${bills10 * 10})</Label>
                <Input
                  type="number"
                  value={bills10}
                  onChange={(e) => setBills10(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">$5 Bills (${bills5 * 5})</Label>
                <Input
                  type="number"
                  value={bills5}
                  onChange={(e) => setBills5(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">$1 Bills (${bills1 * 1})</Label>
                <Input
                  type="number"
                  value={bills1}
                  onChange={(e) => setBills1(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border-slate-800 text-white font-mono text-xs mt-1"
                />
              </div>
            </div>

            {/* Total Comparison Box */}
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Physical Counted Total:</span>
                <span className="font-bold text-white">${countedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Expected System Balance:</span>
                <span>${currentBalance.toFixed(2)}</span>
              </div>
              <div className="pt-1 border-t border-slate-800 flex justify-between font-bold">
                <span>Discrepancy:</span>
                <span className={discrepancy === 0 ? "text-emerald-400" : "text-amber-400"}>
                  {discrepancy >= 0 ? "+" : ""}${discrepancy.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setReconcileModalOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handlePerformAudit} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
              Submit Reconciliation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
