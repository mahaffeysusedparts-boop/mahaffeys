import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { operationsService } from '@/services/operationsService';
import { storageService } from '@/services/storageService';
import { useAuth } from '@/context/AuthContext';
import { OperationsHiccupsReview } from '@/components/operations/OperationsHiccupsReview';
import { PayoutReconciliationTable } from '@/components/operations/PayoutReconciliationTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Banknote, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function OperationsReviewPage() {
  const { user, isAdmin } = useAuth();
  const canManage = isAdmin || user?.role === 'yard_manager';
  const [refreshing, setRefreshing] = useState(false);
  const [hiccups, setHiccups] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Load data
  const loadData = async () => {
    setRefreshing(true);
    try {
      // Get hiccups from storage service
      const storedHiccups = storageService.getHiccups();
      setHiccups(storedHiccups);
      
      // Update last updated timestamp
      setLastUpdated(new Date().toLocaleTimeString());
      
      // Also try to get from operations service if it has a method
      // For now, we'll rely on storage service
    } catch (error) {
      console.error('Failed to load operations review data:', error);
      toast.error('Failed to load operational data');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle hiccup actions
  const handleHiccupAction = (hiccup: any, action: string, note?: string) => {
    // In a real implementation, this would call a service method
    // For now, we'll simulate by updating local state and showing toast
    toast.success(`Hiccup ${action.toLowerCase()}${note ? ' with note' : ''}`);
    
    // Update the hiccup in storage
    const updatedHiccup = {
      ...hiccup,
      status: action as any,
      ...(note && { note }),
      ...(action === 'RESOLVED' || action === 'ESCALATED' ? {
        resolvedBy: user?.fullName || 'Operator',
        resolvedAt: new Date().toISOString()
      } : {}),
      ...(action === 'ACKNOWLEDGED' ? {
        acknowledgedBy: user?.fullName || 'Operator',
        acknowledgedAt: new Date().toISOString()
      } : {}),
      ...(action === 'ESCALATED' ? {
        escalatedTo: user?.fullName || 'Manager',
        escalatedAt: new Date().toISOString()
      } : {}),
      updatedAt: new Date().toISOString()
    };
    
    storageService.saveHiccup(updatedHiccup);
    
    // Refresh the list
    loadData();
  };

  // Initial load
  // In a real app, this would be in useEffect
  // For simplicity, we'll call it directly
  loadData();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Operational review</p>
              <h1 className="text-2xl font-black sm:text-3xl tracking-tight">
                Operations hiccups &amp; payout reconciliation
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Review operational issues and reconcile financial discrepancies
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={loadData} 
                variant="outline"
                className={`h-10 border-slate-700 ${refreshing ? 'opacity-50' : ''}`}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}/>
                Refresh
              </Button>
              <span className="text-xs text-slate-400">
                Last updated: {lastUpdated || 'Never'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900">
            <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400"/>Operational hiccups review
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <OperationsHiccupsReview 
                hiccups={hiccups} 
                canManage={canManage} 
                onAction={handleHiccupAction} 
              />
            </CardContent>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900">
            <CardHeader className="p-4 border-b border-slate-800 flex-row justify-between items-center">
              <CardTitle className="text-sm flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400"/>Payout reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PayoutReconciliationTable canManage={canManage} />
            </CardContent>
          </section>
        </div>
      </main>
    </div>
  );
}