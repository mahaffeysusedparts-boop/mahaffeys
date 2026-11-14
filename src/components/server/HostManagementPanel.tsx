import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network, Rocket, RotateCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/AuthContext';

interface Capabilities { available: boolean; reason?: string; diagnostics?: string[]; management?: string[] }
interface Job { jobId: string; action?: string; status: string; error?: string; steps?: { at: string; message: string }[] }
type WriteAction = 'restart' | 'prepare' | 'deploy' | 'rollback';
const confirmationText: Record<WriteAction, string> = { restart: 'RESTART APP', prepare: 'RUN VERIFIED TESTS', deploy: 'DEPLOY APPROVED PLAN', rollback: 'ROLLBACK DEPLOYMENT' };
const labels: Record<WriteAction, string> = { restart: 'Restart app', prepare: 'Verify revision', deploy: 'Deploy verified plan', rollback: 'Roll back deployment' };
const outline = 'rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white';

async function controlRequest(body: Record<string, unknown>) {
  const response = await fetch(body.action === 'restart' ? '/api/admin/server/restart' : '/api/admin/server/control', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.action === 'restart' ? { confirmation: body.confirmation } : body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.statusMessage || value.message || 'Server action failed. Review the host connector and management policy.');
  return value;
}

export function HostManagementPanel() {
  const { user } = useAuth();
  const storageKey = `mahaffeys_host_job:${user?.id || 'signed-out'}`;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('network');
  const [output, setOutput] = useState('');
  const [revision, setRevision] = useState('');
  const [preparedId, setPreparedId] = useState('');
  const [jobId, setJobId] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [job, setJob] = useState<Job | null>(null);
  const [pending, setPending] = useState<WriteAction | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const activeJob = Boolean(job && ['queued', 'running'].includes(job.status));
  const connected = capabilities?.available === true;

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/admin/server/control', { credentials: 'include' });
      if (!response.ok) throw new Error('Administrator access and a working server connection are required.');
      setCapabilities(await response.json());
    } catch (failure) {
      setCapabilities({ available: false, reason: failure instanceof Error ? failure.message : 'Connection check failed.' });
    } finally { setChecking(false); }
  }, []);
  useEffect(() => { void checkConnection(); }, [checkConnection]);

  const refreshJob = useCallback(async () => {
    if (!connected || !/^[a-f0-9]{32}$/.test(jobId)) return;
    try {
      const result = await controlRequest({ action: 'status', jobId }) as Job;
      setJob(result);
      if (result.action === 'prepare' && result.status === 'succeeded') setPreparedId(result.jobId);
      setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Job status unavailable. Retry after the app is online.'); }
  }, [connected, jobId]);
  useEffect(() => { void refreshJob(); }, [refreshJob]);
  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => { void refreshJob(); }, 5000);
    return () => window.clearInterval(timer);
  }, [activeJob, refreshJob]);

  async function runDiagnostics() {
    setBusy(true); setError(''); setOutput('');
    try {
      const result = await controlRequest({ action: 'diagnostics', report });
      setOutput(result.output);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Diagnostics failed.'); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!pending || confirmation !== confirmationText[pending]) return;
    const action = pending;
    setPending(null); setBusy(true); setError('');
    try {
      const body: Record<string, unknown> = { action, confirmation: confirmationText[action] };
      if (action === 'prepare') body.revision = revision.trim();
      if (action === 'deploy') body.jobId = preparedId.trim();
      if (action === 'rollback') body.jobId = job?.jobId;
      const result = await controlRequest(body) as Job;
      sessionStorage.setItem(storageKey, result.jobId);
      setJobId(result.jobId);
      setJob({ ...result, action });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Server action failed.'); }
    finally { setBusy(false); }
  }
  const openConfirmation = (action: WriteAction) => { setConfirmation(''); setPending(action); };
  const canWrite = (action: WriteAction) => connected && capabilities?.management?.includes(action) && !busy && !activeJob;

  return (
    <section aria-label="Guarded host management" className="my-6 space-y-4">
      <Card className="rounded-3xl border-emerald-500/25 bg-slate-900 text-slate-100">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Host management</CardTitle>
          <Badge className={`rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>{connected ? 'Host connected' : 'Host connector unavailable'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">Control the existing app container, verify redeployments, and inspect Ubuntu diagnostics. No arbitrary terminal commands, root file editor, network changes, or drive formatting.</p>
          {!connected && <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">{capabilities?.reason || 'Checking the administrator-installed host connector…'} Setup guide: <span className="break-all font-mono">docs/HOST_CONTROL_SETUP.md</span></p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={outline} onClick={() => void checkConnection()} disabled={checking}>{checking ? 'Checking…' : 'Check host connection'}</Button>
            <Button className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={!canWrite('restart')} onClick={() => openConfirmation('restart')}><RotateCw className="mr-2 h-4 w-4" /> Restart app</Button>
            <Button asChild variant="outline" className={outline}><Link to="/settings?section=general"><SlidersHorizontal className="mr-2 h-4 w-4" /> Manage app settings</Link></Button>
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-700 p-4">
              <h3 className="flex items-center gap-2 font-bold"><Network className="h-4 w-4 text-sky-400" /> Read-only diagnostics</h3>
              <Label htmlFor="host-report">Host report</Label>
              <Select value={report} onValueChange={setReport}><SelectTrigger id="host-report" className="rounded-xl border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger><SelectContent>{[['network', 'Network settings'], ['containers', 'Container health'], ['storage', 'Drives and storage'], ['version', 'Checkout version'], ['cups', 'Printing diagnostics'], ['printer', 'Printer connectivity']].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
              <Button variant="outline" className={outline} onClick={() => void runDiagnostics()} disabled={!connected || busy || !capabilities?.diagnostics?.includes(report)}>{busy ? 'Working…' : 'Run diagnostics'}</Button>
              <p className="text-xs text-slate-400">Reports may contain private network addresses and paths. No network configuration is changed.</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-700 p-4">
              <h3 className="flex items-center gap-2 font-bold"><Rocket className="h-4 w-4 text-violet-400" /> Guarded redeployment</h3>
              <Label htmlFor="host-revision">Exact Git commit</Label>
              <Input id="host-revision" value={revision} onChange={event => setRevision(event.target.value)} placeholder="40-character lowercase commit from origin/main" className="rounded-xl border-slate-700 bg-slate-950 font-mono" />
              <Button variant="outline" className={outline} disabled={!canWrite('prepare') || !/^[a-f0-9]{40}$/.test(revision.trim())} onClick={() => openConfirmation('prepare')}>Verify revision</Button>
              <Label htmlFor="host-preparation" className="block">Verified preparation job ID</Label>
              <Input id="host-preparation" value={preparedId} onChange={event => setPreparedId(event.target.value)} placeholder="Filled after verification succeeds" className="rounded-xl border-slate-700 bg-slate-950 font-mono" />
              <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500" disabled={!canWrite('deploy') || !/^[a-f0-9]{32}$/.test(preparedId.trim())} onClick={() => openConfirmation('deploy')}>Deploy verified plan</Button>
              <p className="text-xs leading-5 text-slate-400">The server requires successful verification less than one hour old, unchanged baseline, backups, and the existing authorization checks. Only app/CUPS are redeployed; database volumes are preserved.</p>
            </div>
          </div>
          {output && <div><h3 className="mb-2 font-bold">Host diagnostic report</h3><pre data-testid="host-diagnostic-report" className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-slate-700 bg-slate-950 p-4 text-xs leading-5 text-sky-100">{output}</pre></div>}
          <div className="space-y-3 rounded-2xl border border-slate-700 p-4">
            <Label htmlFor="host-job">Management job ID</Label>
            <div className="flex flex-col gap-2 sm:flex-row"><Input id="host-job" value={jobId} onChange={event => { setJob(null); setJobId(event.target.value); }} className="min-w-0 rounded-xl border-slate-700 bg-slate-950 font-mono" placeholder="Paste a server-generated job ID to resume tracking" /><Button variant="outline" className={outline} disabled={!connected || !/^[a-f0-9]{32}$/.test(jobId)} onClick={() => void refreshJob()}>Refresh job status</Button></div>
            {job && <div aria-label="Management job status" className="space-y-2 text-sm"><p><strong>{job.action || 'Management'}:</strong> <span data-testid="host-job-status">{job.status}</span></p><p className="break-all font-mono text-xs text-slate-400">{job.jobId}</p>{job.steps?.map((step, index) => <p key={`${step.at}-${index}`} className="text-slate-300">{step.message}</p>)}{job.error && <p role="alert" className="text-red-200">{job.error}</p>}{job.action === 'deploy' && ['succeeded', 'failed'].includes(job.status) && <Button variant="outline" className={outline} disabled={!canWrite('rollback')} onClick={() => openConfirmation('rollback')}>Roll back deployment</Button>}</div>}
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }}>
        <AlertDialogContent className="rounded-3xl border-slate-700 bg-slate-900 text-slate-100">
          <AlertDialogHeader><AlertDialogTitle>{pending && labels[pending]}?</AlertDialogTitle><AlertDialogDescription className="text-slate-300">{pending === 'restart' ? 'Active requests may pause. Only the existing app container will restart; its image, volumes and other services remain unchanged.' : 'Use a maintenance window. Verification never deploys; deployment and rollback retain the existing server approval, backup and recovery safeguards.'}</AlertDialogDescription></AlertDialogHeader>
          <Label htmlFor="host-confirmation">Type {pending && confirmationText[pending]} to approve</Label><Input id="host-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="rounded-xl border-slate-700 bg-slate-950" autoComplete="off" />
          <AlertDialogFooter><AlertDialogCancel className={outline}>Cancel</AlertDialogCancel><Button className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300" disabled={!pending || confirmation !== confirmationText[pending] || busy} onClick={() => void confirmAction()}>Confirm action</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
