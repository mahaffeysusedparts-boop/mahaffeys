import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/services/apiClient';
import { sharedStorage } from '@/services/sharedStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function RestoreBackupButton({fileName}: {fileName:string}) {
  const [open,setOpen] = useState(false);
  const [confirmation,setConfirmation] = useState('');
  const queryClient = useQueryClient();
  const restore = useMutation({mutationFn:()=>apiRequest('/api/admin/backups/restore',{method:'POST',body:JSON.stringify({fileName,confirm:confirmation})}),onSuccess:()=>{
    toast.success('Server snapshot restore acknowledged. No new payments were created.');setOpen(false);
    void sharedStorage.hydrate().catch(()=>toast.warning('Restore was confirmed, but this workstation cache could not refresh. Refresh before further work.'));
    void queryClient.invalidateQueries();
  }});
  return <><Button variant="outline" size="sm" onClick={()=>{setOpen(true);setConfirmation('');restore.reset();}} className="rounded-xl border-amber-700 bg-amber-950 text-amber-100">Restore v2</Button><Dialog open={open} onOpenChange={(value)=>!restore.isPending&&setOpen(value)}><DialogContent className="rounded-2xl border-amber-700 bg-slate-950 text-white"><DialogHeader><DialogTitle>Verified server snapshot recovery</DialogTitle><DialogDescription className="text-slate-200">{fileName}</DialogDescription></DialogHeader><p className="text-sm text-amber-100">Stop active yard work before recovery. This restores database state, canonical buying, payments, customers and private price PDFs together. It refuses any snapshot that would lose immutable payment/audit history, reopen historical terminal tickets or remove cash evidence. Workstation JSON exports and old v1 server snapshots are not accepted.</p><Input aria-label="Type RESTORE to confirm" placeholder="Type RESTORE" value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} className="rounded-xl border-slate-600 bg-slate-900 text-white"/>{restore.isError&&<p role="alert" className="text-sm text-amber-200">{restore.error.message}</p>}<Button disabled={confirmation!=='RESTORE'||restore.isPending} onClick={()=>restore.mutate()} className="rounded-xl bg-amber-700 text-white hover:bg-amber-600">{restore.isPending?'Awaiting recovery acknowledgement…':'Restore verified snapshot'}</Button></DialogContent></Dialog></>;
}
