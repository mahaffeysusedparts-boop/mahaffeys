import { useEffect, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/services/apiClient';
import type { PushStatus } from '@/types/notifications';
import { toast } from 'sonner';

export function PhonePushDevice() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const refresh = async () => {
    try {
      setError('');
      setStatus(await apiRequest<PushStatus>('/api/notifications/status'));
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        setSubscribed(!!await registration?.pushManager.getSubscription());
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load phone settings'); }
  };
  useEffect(() => { void refresh(); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings and try again.');
      const registration = await navigator.serviceWorker.register(import.meta.env.DEV ? '/push-sw.js' : '/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const publicKey = status!.publicKey;
      const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await apiRequest('/api/notifications/devices', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      await refresh();
      toast.success('This phone is registered for notifications');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not enable notifications'); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiRequest('/api/notifications/devices', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      await refresh(); toast.success('Notifications disabled on this device');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not disable notifications'); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try {
      const result = await apiRequest<{ accepted: number; failed: number; localPreview: boolean }>('/api/notifications/test', { method: 'POST' });
      if (result.localPreview) toast.info('Local preview never sends real phone alerts. Test from your deployed HTTPS app.');
      else if (result.accepted) toast.success(`Push service accepted the test for ${result.accepted} device(s). Check your phone.`);
      else toast.error('No push service accepted the test. Re-enable notifications on your phone and try again.');
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Test failed'); }
    finally { setBusy(false); }
  };
  return <section aria-label="This phone" className="rounded-2xl border border-sky-500/30 bg-slate-950 p-5 space-y-4">
    <h3 className="flex items-center gap-2 text-lg font-bold text-sky-100"><Smartphone className="h-5 w-5 text-sky-300"/>This phone</h3>
    <p className="text-sm text-slate-200">Open this page on each recipient’s phone and sign in with their own account. Enable notifications only on a trusted personal device; alerts may appear on its lock screen.</p>
    <p className="text-sm text-slate-300">Use the deployed HTTPS address. On iPhone/iPad (iOS 16.4+), add the app to your Home Screen, open it there, then enable notifications. Android supports compatible browsers such as Chrome.</p>
    {!supported && <p role="status" className="rounded-xl bg-amber-950 p-3 text-sm text-amber-100">Phone push is unavailable in this browser or connection. Open the HTTPS app directly on your phone, not inside the preview.</p>}
    {status && <div className="space-y-2 text-sm text-slate-200">
      <p role="status">{subscribed ? 'Browser push subscription enabled' : 'Not enabled on this device'} · {status.deviceCount} device(s) registered to your account</p>
      <p>{status.receiving ? 'Your account is selected to receive operator alerts.' : 'Your account is not selected for any operator alerts yet. An administrator can select recipients below.'}</p>
      {status.localPreview && <p className="text-amber-200">Local preview: real phone delivery is disabled to protect live yard operations.</p>}
    </div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <Button disabled={!supported || !status || busy} onClick={enable} className="min-h-11 rounded-xl bg-sky-700 text-white hover:bg-sky-600"><BellRing className="mr-2 h-4 w-4"/>{subscribed ? 'Register / refresh this phone' : 'Enable on this phone'}</Button>
      <Button disabled={!subscribed || busy} onClick={disable} className="min-h-11 rounded-xl border border-slate-600 bg-slate-800 text-white hover:bg-slate-700">Disable on this phone</Button>
      <Button disabled={!status?.deviceCount || busy} onClick={test} className="min-h-11 rounded-xl bg-teal-700 text-white hover:bg-teal-600">Send test notification</Button>
      {error && <Button onClick={refresh} className="rounded-xl bg-slate-700 text-white">Retry</Button>}
    </div>
    <p className="text-xs text-slate-300">Push is best-effort, not a safety alarm. Delivery depends on internet access, phone permissions and operating-system settings.</p>
  </section>;
}
