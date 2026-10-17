import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, AlertCircle, TrendingUp, TrendingDown, DollarSign, Banknote } from 'lucide-react';
import { downloadCsv } from '@/utils/exportUtils';
import { ReconciliationEntry, ReconciliationStatus, ReconciliationType } from '@/types/operations';
import { storageService } from '@/services/storageService';
import { toast } from 'sonner';

const typeLabel = (type: ReconciliationType) => {
  switch (type) {
    case 'PAYOUT': return 'Ticket payout';
    case 'CASH_DRAWER': return 'Cash drawer';
    case 'SHIPMENT_SETTLEMENT': return 'Shipment settlement';
  }
};

const statusColor = (status: ReconciliationStatus) => {
  switch (status) {
    case 'OPEN': return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    case 'RESOLVED': return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    case 'ADJUSTED': return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
    case 'VOIDED': return 'bg-slate-500/15 border-slate-500/40 text-slate-300';
  }
};

export function PayoutReconciliationTable({ canManage }: { canManage: boolean }) {
  const [reconciliations, setReconciliations] = useState<ReconciliationEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<ReconciliationStatus | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<ReconciliationType | 'ALL'>('ALL');
  const [adjustmentOpen, setAdjustmentOpen] = useState<ReconciliationEntry | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');

  // Load reconciliations on mount
  // In a real app, this would use useQuery or similar
  // For now, we'll load from storageService directly
  const loadReconciliations = () => {
    setReconciliations(storageService.getReconciliations());
  };

  // Simulate loading on mount
  // In practice, this would be handled by a data fetching library
  // We'll call it once when component mounts
  // For simplicity in this example, we'll assume data is already loaded
  // In a real implementation, you'd use useEffect or similar

  const filteredReconciliations = reconciliations.filter(rec => {
    const statusMatch = filterStatus === 'ALL' || rec.status === filterStatus;
    const typeMatch = filterType === 'ALL' || rec.type === filterType;
    return statusMatch && typeMatch;
  });

  const handleAdjustment = (rec: ReconciliationEntry) => {
    setAdjustmentOpen(rec);
    setAdjustmentAmount(Math.abs(rec.variance).toFixed(2));
  };

  const handleAdjustmentSubmit = () => {
    if (!adjustmentOpen) return;
    
    const adjustmentAmountNum = parseFloat(adjustmentAmount);
    const isPositive = adjustmentOpen.variance > 0;
    
    // Create adjustment entry
    const adjustmentEntry: ReconciliationEntry = {
      id: `adj-${Date.now()}`,
      type: adjustmentOpen.type,
      status: 'RESOLVED',
      referenceId: adjustmentOpen.referenceId,
      expectedAmount: adjustmentOpen.expectedAmount,
      actualAmount: adjustmentOpen.actualAmount + (isPositive ? adjustmentAmountNum : -adjustmentAmountNum),
      variance: 0,
      varianceReason: `Manual adjustment to resolve variance`,
      resolvedBy: 'Current User', // In real app, get from auth
      resolvedAt: new Date().toISOString(),
      adjustmentEntry: adjustmentOpen.id,
      note: `Adjustment of ${isPositive ? '+' : '-'}${adjustmentAmount} applied`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update original reconciliation
    const updatedRec: ReconciliationEntry = {
      ...adjustmentOpen,
      status: 'ADJUSTED',
      adjustmentEntry: adjustmentEntry.id,
      note: `${adjustmentOpen.note || ''} | Adjusted by ${isPositive ? '+' : '-'}${adjustmentAmount}`.trim(),
      updatedAt: new Date().toISOString()
    };
    
    // Save both entries
    storageService.saveReconciliation(adjustmentEntry);
    storageService.saveReconciliation(updatedRec);
    
    // Refresh list
    loadReconciliations();
    
    setAdjustmentOpen(null);
    setAdjustmentAmount('');
    
    // Also add a cash drawer log entry for the adjustment
    storageService.addCashDrawerEntry({
      type: 'PAYOUT_DISBURSEMENT',
      amount: isPositive ? adjustmentAmountNum : -adjustmentAmountNum,
      ticketId: adjustmentOpen.referenceId,
      operatorName: 'Current User'
    });
    
    toast.success('Adjustment applied successfully');
  };

  const handleExportCsv = () => {
    const csvData = filteredReconciliations.map(rec => ({
      'ID': rec.id,
      'Type': typeLabel(rec.type),
      'Status': rec.status,
      'Reference ID': rec.referenceId,
      'Expected Amount': rec.expectedAmount.toFixed(2),
      'Actual Amount': rec.actualAmount.toFixed(2),
      'Variance': rec.variance.toFixed(2),
      'Variance Reason': rec.varianceReason || '',
      'Resolved By': rec.resolvedBy || '',
      'Resolved At': rec.resolvedAt ? new Date(rec.resolvedAt).toLocaleString() : '',
      'Note': rec.note || '',
      'Created At': new Date(rec.createdAt).toLocaleString()
    }));
    
    downloadCsv(`payout-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`, csvData);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Financial reconciliation</p>
            <h2 className="text-xl font-black sm:text-2xl tracking-tight">Payout reconciliation</h2>
            <p className="mt-1 text-xs text-slate-400">Compare expected vs actual payouts and resolve discrepancies.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-[10px] text-slate-400">Status:</Label>
              <select 
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ReconciliationStatus)}
                className="h-9 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-slate-200"
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ADJUSTED">Adjusted</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="type-filter" className="text-[10px] text-slate-400">Type:</Label>
              <select 
                id="type-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ReconciliationType)}
                className="h-9 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-slate-200"
              >
                <option value="ALL">All types</option>
                <option value="PAYOUT">Ticket payout</option>
                <option value="CASH_DRAWER">Cash drawer</option>
                <option value="SHIPMENT_SETTLEMENT">Shipment settlement</option>
              </select>
            </div>
            <Button onClick={handleExportCsv} variant="outline" className="border-slate-700 text-xs">
              <DollarSign className="w-3.5 h-3.5 mr-1.5"/>Export
            </Button>
            {canManage && <Button onClick={() => {
              // Generate sample reconciliation data for demo
              const sampleRec: ReconciliationEntry = {
                id: `rec-${Date.now()}`,
                type: 'PAYOUT',
                status: 'OPEN',
                referenceId: `TICKET-${Math.floor(Math.random() * 1000)}`,
                expectedAmount: 150.00,
                actualAmount: 125.00,
                variance: -25.00,
                varianceReason: 'Cash payout shortfall',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              storageService.saveReconciliation(sampleRec);
              loadReconciliations();
              toast.success('Sample reconciliation added');
            }} className="bg-emerald-600 hover:bg-emerald-500 text-xs">
              <Banknote className="w-3.5 h-3.5 mr-1.5"/>Add sample
            </Button>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
        <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-400"/>Reconciliation entries
          </CardTitle>
          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {filteredReconciliations.length} matching
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReconciliations.length ? (
            <Table className="w-full text-sm">
              <TableHeader className="bg-slate-950/80">
                <TableRow className="border-slate-800 hover:bg-slate-950 text-xs">
                  <TableHead className="text-slate-400 w-10">#</TableHead>
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400">Reference</TableHead>
                  <TableHead className="text-right text-slate-400">Expected</TableHead>
                  <TableHead className="text-right text-slate-400">Actual</TableHead>
                  <TableHead className="text-right text-slate-400">Variance</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {canManage && <TableHead className="text-slate-400">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReconciliations.map((rec, index) => (
                  <TableRow key={rec.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-slate-300">{index + 1}</TableCell>
                    <TableCell className="text-slate-300">{typeLabel(rec.type)}</TableCell>
                    <TableCell className="text-slate-300 font-mono">{rec.referenceId}</TableCell>
                    <TableCell className="text-right text-slate-300 font-mono">${rec.expectedAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-slate-300 font-mono">${rec.actualAmount.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono ${rec.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rec.variance >= 0 ? `+${rec.variance.toFixed(2)}` : `${rec.variance.toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColor(rec.status)}>{rec.status}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-center">
                        {rec.status === 'OPEN' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleAdjustment(rec)} 
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-500"
                          >
                            <DollarSign className="w-3 h-3 mr-1"/>Adjust
                          </Button>
                        )}
                        {rec.status === 'ADJUSTED' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 text-xs border-slate-700"
                          >
                            <Check className="w-3 h-3 mr-1"/>View
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-center text-slate-500">
              No reconciliation entries match the current filters.
              {canManage && (
                <Button 
                  className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-xs"
                  onClick={() => {
                    // Add a few sample entries
                    const samples = [
                      {
                        type: 'PAYOUT' as const,
                        referenceId: `TICKET-${Math.floor(Math.random() * 1000)}`,
                        expectedAmount: 200.00,
                        actualAmount: 175.00,
                        variance: -25.00,
                        varianceReason: 'Underpaid ticket'
                      },
                      {
                        type: 'CASH_DRAWER' as const,
                        referenceId: `CD-${Math.floor(Math.random() * 100)}`,
                        expectedAmount: 500.00,
                        actualAmount: 520.00,
                        variance: 20.00,
                        varianceReason: 'Overage in cash drawer'
                      }
                    ];
                    
                    samples.forEach(sample => {
                      const rec: ReconciliationEntry = {
                        id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        type: sample.type,
                        status: 'OPEN',
                        referenceId: sample.referenceId,
                        expectedAmount: sample.expectedAmount,
                        actualAmount: sample.actualAmount,
                        variance: sample.variance,
                        varianceReason: sample.varianceReason,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      };
                      storageService.saveReconciliation(rec);
                    });
                    
                    loadReconciliations();
                    toast.success('Sample data added');
                  }}
                >
                  Add sample data
                </Button>
              )}
            </p>
          )}
        </CardContent>
      </section>

      {adjustmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="relative bg-slate-900 rounded-lg p-6 shadow-xl border border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-100">
                  Adjust reconciliation: {typeLabel(adjustmentOpen.type)}
                </h3>
                <Button 
                  onClick={() => setAdjustmentOpen(null)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <AlertCircle className="h-4 w-4"/>
                </Button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-1">Reference: {adjustmentOpen.referenceId}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-500">Expected amount</p>
                    <p className="text-lg font-mono text-slate-300">${adjustmentOpen.expectedAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Actual amount</p>
                    <p className="text-lg font-mono text-slate-300">${adjustmentOpen.actualAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Current variance</p>
                    <p className={`text-lg font-mono ${adjustmentOpen.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {adjustmentOpen.variance >= 0 ? `+${adjustmentOpen.variance.toFixed(2)}` : `${adjustmentOpen.variance.toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Adjustment amount</p>
                    <Input 
                      type="number"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      className="h-10 bg-slate-950 border-slate-700 text-slate-300"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Label>Adjustment reason</Label>
                <Input 
                  value={adjustmentOpen.note || ''}
                  onChange={(e) => {/* In a real app, we'd update the note */}}
                  className="h-10 bg-slate-950 border-slate-700"
                  placeholder="Reason for this adjustment..."
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button 
                  onClick={() => setAdjustmentOpen(null)}
                  variant="outline"
                  className="h-10 border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAdjustmentSubmit}
                  className="h-10 bg-emerald-600 hover:bg-emerald-500"
                >
                  Apply adjustment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}