import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authService } from '@/services/authService';
import { scaleEvidenceService, type ScaleEvidenceConfiguration } from '@/services/scaleEvidenceService';
import { scaleService } from '@/services/scaleService';
import { SCALE_EVIDENCE_CATEGORIES, SCALE_EVIDENCE_LABELS, type ScaleEvidenceCameraMappings } from '@/types/scaleEvidence';
import { toast } from 'sonner';

export function ScaleEvidenceCameraSettings() {
  const client = useQueryClient();
  const config = useQuery({ queryKey: ['scale-evidence-config'], queryFn: scaleEvidenceService.configuration, refetchOnWindowFocus: false });
  const [scaleId,setScaleId] = useState(scaleService.getCurrentScaleId() ?? '');
  const [mappings,setMappings] = useState<ScaleEvidenceCameraMappings>({});
  const [saving,setSaving] = useState(false);
  const [testing,setTesting] = useState<string | null>(null);
  const [error,setError] = useState('');
  const [preview,setPreview] = useState<{ url: string; cameraId: string; capturedAt: string | null } | null>(null);
  const request = useRef<AbortController | null>(null);
  const selected = config.data?.scales.find(scale => scale.id === scaleId);
  const canManage = ['admin','yard_manager'].includes(authService.getCurrentUser()?.role ?? '');

  useEffect(() => {
    if (config.data && !config.data.scales.some(scale => scale.id === scaleId)) setScaleId(config.data.scales[0]?.id ?? '');
  },[config.data,scaleId]);
  useEffect(() => { setMappings(selected?.evidenceCameras ?? {}); setError(''); setPreview(null); request.current?.abort(); },[selected]);
  useEffect(() => () => { request.current?.abort(); },[]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); },[preview]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);setError('');
    try {
      const result = await scaleEvidenceService.saveConfiguration(selected.id,mappings,selected.evidenceCameras);
      client.setQueryData<ScaleEvidenceConfiguration>(['scale-evidence-config'],previous => previous ? {
        ...previous,scales: previous.scales.map(scale => scale.id === result.scaleId ? { ...scale,evidenceCameras: result.mappings } : scale),
      } : previous);
      toast.success('Scale evidence cameras saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Camera settings could not be saved');
    } finally { setSaving(false); }
  };

  const testCamera = async (cameraId: string) => {
    request.current?.abort();
    const controller = new AbortController();request.current = controller;
    setTesting(cameraId);setError('');setPreview(null);
    let objectUrl: string | null = null;
    try {
      const response = await fetch(`/api/cameras/${encodeURIComponent(cameraId)}/snapshot?t=${Date.now()}`,{ credentials:'include',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]) });
      if (!response.ok) throw new Error('Snapshot unavailable. Check the Cameras page and server network access.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Camera returned a non-image response');
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();image.src = objectUrl;await image.decode();
      if (controller.signal.aborted) return;
      setPreview({url:objectUrl,cameraId,capturedAt:response.headers.get('X-Snapshot-Captured-At')});
      objectUrl = null;
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Snapshot unavailable');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (request.current === controller) setTesting(null);
    }
  };

  const distinct = [...new Set(Object.values(mappings))];
  const missing = SCALE_EVIDENCE_CATEGORIES.filter(category => !mappings[category]);
  return <section className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3" aria-label="Scale Evidence Cameras">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Camera className="h-4 w-4 text-sky-400" /> Scale Evidence Cameras</h3>
    <p className="text-xs text-slate-400">Assignments only; camera connections and credentials stay on the Cameras page. Test framing and plate readability before use.</p>
    {config.isPending ? <p className="text-xs text-slate-400">Loading camera configuration…</p> : config.isError ? <div className="space-y-2"><p className="text-xs text-amber-300">Camera configuration unavailable.</p><Button variant="outline" size="sm" onClick={() => config.refetch()} className="border-slate-700 bg-slate-800 text-slate-200"><RefreshCw className="mr-2 h-3 w-3" /> Reload configuration</Button></div> : !config.data?.scales.length ? <p className="text-xs text-amber-300">Configure a scale in Settings before assigning cameras.</p> : <>
      <div className="space-y-1.5"><Label htmlFor="evidence-scale" className="text-xs text-slate-300">Scale</Label>
        <Select value={scaleId} onValueChange={setScaleId} disabled={saving}><SelectTrigger id="evidence-scale" className="border-slate-700 bg-slate-800 text-slate-200"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-200">{config.data.scales.map(scale => <SelectItem key={scale.id} value={scale.id}>{scale.name}</SelectItem>)}</SelectContent></Select>
      </div>
      {SCALE_EVIDENCE_CATEGORIES.map(category => <div key={category} className="space-y-1.5"><Label htmlFor={`evidence-${category}`} className="text-xs text-slate-300">{SCALE_EVIDENCE_LABELS[category]}</Label>
        <Select value={mappings[category] ?? 'unconfigured'} disabled={!canManage || saving} onValueChange={id => setMappings(previous => { const next = {...previous};if (id === 'unconfigured') delete next[category];else next[category] = id;return next; })}>
          <SelectTrigger id={`evidence-${category}`} className="border-slate-700 bg-slate-800 text-slate-200"><SelectValue placeholder="Unconfigured" /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-900 text-slate-200"><SelectItem value="unconfigured">Unconfigured</SelectItem>{mappings[category] && !config.data.cameras.some(camera => camera.id === mappings[category]) && <SelectItem value={mappings[category]!}>Unavailable camera</SelectItem>}{config.data.cameras.map(camera => <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>)}
      {missing.length > 0 && <p className="text-xs text-amber-300">Unmapped: {missing.map(category => SCALE_EVIDENCE_LABELS[category]).join(', ')}. Weighing is not blocked.</p>}
      {distinct.map(id => {
        const categories = SCALE_EVIDENCE_CATEGORIES.filter(category => mappings[category] === id);
        const camera = config.data.cameras.find(row => row.id === id);
        return <div key={id} className="space-y-1"><p className="text-xs text-slate-400">{camera?.name ?? 'Unavailable camera'} · {categories.map(category => SCALE_EVIDENCE_LABELS[category]).join(' + ')}{categories.length > 1 ? ' (shared view)' : ''}</p><Button variant="outline" size="sm" disabled={!!testing || !camera} onClick={() => testCamera(id)} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"><Camera className="mr-2 h-3 w-3" />{testing === id ? 'Testing…' : `Test ${camera?.name ?? 'camera'}`}</Button></div>;
      })}
      {preview && <div className="space-y-1"><img src={preview.url} alt="Scale camera snapshot preview" className="max-h-48 w-full rounded-lg border border-slate-800 object-contain" /><p className="text-xs text-slate-400">{config.data.cameras.find(camera => camera.id === preview.cameraId)?.name} · {preview.capturedAt ? `Snapshot received ${new Date(preview.capturedAt).toLocaleTimeString()}` : 'Snapshot time not provided by server'}. Test only — not ticket evidence.</p></div>}
      {canManage ? <Button onClick={save} disabled={saving || !selected} className="bg-emerald-600 text-white font-bold hover:bg-emerald-500">{saving ? 'Saving…' : 'Save camera assignments'}</Button> : <p className="text-xs text-slate-400">A manager or administrator can change these assignments.</p>}
    </>}
    {error && <div className="space-y-2"><div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-700/50 bg-amber-950/20 p-3 text-xs text-amber-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div><Button variant="outline" size="sm" disabled={saving} onClick={() => config.refetch()} className="border-slate-700 bg-slate-800 text-slate-200">Reload configuration</Button></div>}
  </section>;
}
