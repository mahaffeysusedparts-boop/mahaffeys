import { useEffect, useState } from 'react';
import { BellRing, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/services/apiClient';
import { NOTIFICATION_ACTIONS, type NotificationAction, type NotificationRule, type NotificationSettings } from '@/types/notifications';
import { PhonePushDevice } from './PhonePushDevice';
import { toast } from 'sonner';

export default function PhoneNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deviceVersion, setDeviceVersion] = useState(0);
  const load = async () => {
    try {
      setError('');
      const data = await apiRequest<NotificationSettings>('/api/notifications/settings');
      setSettings(data); setRules(data.rules);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load notification rules'); }
  };
  useEffect(() => { if (user?.role === 'admin') void load(); }, [user?.id, user?.role]);
  const update = (action: NotificationAction, field: 'recipientIds' | 'operatorIds', id: string, checked: boolean) => {
    setRules(previous => previous.map(rule => rule.action !== action ? rule : { ...rule, [field]: checked ? [...rule[field], id] : rule[field].filter(value => value !== id) }));
  };
  const save = async () => {
    if (rules.some(rule => !rule.recipientIds.length)) { toast.error('Choose at least one recipient for each enabled action'); return; }
    setBusy(true);
    try {
      await apiRequest('/api/notifications/settings', { method: 'PUT', body: JSON.stringify({ rules }) });
      setDeviceVersion(value => value + 1); toast.success('Phone notification rules saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save notification rules'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <Card className="rounded-3xl border-sky-500/25 bg-slate-900 text-slate-100 shadow-xl">
      <CardHeader className="border-b border-slate-700">
        <CardTitle className="flex items-center gap-3 text-xl"><BellRing className="h-6 w-6 text-sky-300"/>Phone notifications</CardTitle>
        <p className="text-sm text-slate-300">Choose which successful operator actions send a push alert and who receives each one. No SMS account or phone number is needed.</p>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <PhonePushDevice key={`${user?.id}-${deviceVersion}`}/>
        {user?.role !== 'admin' ? <p className="text-sm text-slate-200">Only administrators can change alert actions, monitored operators and recipients. You can manage your own phone above.</p> : <section aria-label="Operator alert rules" className="space-y-4">
          <h3 className="text-lg font-bold">Actions & recipients</h3>
          <p className="text-sm text-slate-300">Recipient accounts must be approved. Leaving the operator selection empty monitors all approved operators, including administrators. Notifications do not include customer ID, address, payment amount or other record details.</p>
          {error && <div role="alert" className="text-red-300">{error} <Button onClick={load} className="ml-2 rounded-xl bg-slate-700 text-white">Retry rules</Button></div>}
          {!settings && !error && <p role="status">Loading notification rules…</p>}
          {settings && Object.entries(NOTIFICATION_ACTIONS).map(([key, label]) => {
            const action = key as NotificationAction;
            const rule = rules.find(value => value.action === action);
            return <section key={action} aria-label={label} className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-semibold text-slate-100">{label}</h4>
                <Switch aria-label={`Notify when ${label.toLowerCase()}`} checked={!!rule} disabled={busy} onCheckedChange={checked => setRules(previous => checked ? [...previous, { action, recipientIds: [], operatorIds: [] }] : previous.filter(value => value.action !== action))}/>
              </div>
              {rule && <div className="grid gap-5 sm:grid-cols-2">
                <fieldset disabled={busy} className="min-w-0 space-y-3"><legend className="mb-2 text-sm font-bold text-sky-200">Who receives this alert?</legend>
                  {settings.users.map(account => <label key={account.id} className="flex min-h-10 items-center gap-3 text-sm"><Checkbox aria-label={`Send ${label.toLowerCase()} to ${account.fullName}`} checked={rule.recipientIds.includes(account.id)} onCheckedChange={checked => update(action, 'recipientIds', account.id, checked === true)} className="border-sky-400 data-[state=checked]:bg-sky-700"/><span className="break-words">{account.fullName} <span className="text-xs text-slate-300">({account.role.replace(/_/g, ' ')})</span></span></label>)}
                </fieldset>
                <fieldset disabled={busy} className="min-w-0 space-y-3"><legend className="mb-2 text-sm font-bold text-teal-200">Whose actions trigger it?</legend>
                  <p className="text-xs text-slate-300">{rule.operatorIds.length ? 'Only selected operators' : 'All approved operators (no selection)'}</p>
                  {settings.users.map(account => <label key={account.id} className="flex min-h-10 items-center gap-3 text-sm"><Checkbox aria-label={`Monitor ${account.fullName} for ${label.toLowerCase()}`} checked={rule.operatorIds.includes(account.id)} onCheckedChange={checked => update(action, 'operatorIds', account.id, checked === true)} className="border-teal-400 data-[state=checked]:bg-teal-700"/><span className="break-words">{account.fullName}</span></label>)}
                </fieldset>
              </div>}
            </section>;
          })}
          <Button disabled={!settings || busy} onClick={save} className="min-h-11 rounded-xl bg-sky-700 text-white hover:bg-sky-600"><Save className="mr-2 h-4 w-4"/>{busy ? 'Saving…' : 'Save notification rules'}</Button>
        </section>}
      </CardContent>
    </Card>
  </main>;
}
