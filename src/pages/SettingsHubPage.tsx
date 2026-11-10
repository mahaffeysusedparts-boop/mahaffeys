import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, Server } from 'lucide-react';

const YardSettings = lazy(() => import('./SettingsPage'));
const UserManagement = lazy(() => import('./UserManagementPage'));
const ServerAdmin = lazy(() => import('./ServerAdminPage'));

export default function SettingsHubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get('tab');
  const tab = location.pathname === '/users' ? 'users' : location.pathname === '/server-admin' ? 'server' : requested === 'users' || requested === 'server' ? requested : 'yard';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400"><Settings className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Settings</h1>
            <p className="text-sm text-slate-400">Yard, hardware, users and server controls in one place.</p>
          </div>
        </div>
        <Tabs value={tab} onValueChange={value => navigate(`/settings${value === 'yard' ? '' : `?tab=${value}`}`)}>
          <TabsList aria-label="Settings sections" className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1 sm:w-fit">
            <TabsTrigger value="yard" className="min-h-12 gap-2 rounded-xl px-3 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm"><Settings className="h-4 w-4 shrink-0" />Yard & hardware</TabsTrigger>
            <TabsTrigger value="users" className="min-h-12 gap-2 rounded-xl px-3 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm"><Shield className="h-4 w-4 shrink-0" />User access</TabsTrigger>
            <TabsTrigger value="server" className="min-h-12 gap-2 rounded-xl px-3 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm"><Server className="h-4 w-4 shrink-0" />Server</TabsTrigger>
          </TabsList>
          <Suspense fallback={<LoadingSpinner />}>
            <TabsContent value="yard" forceMount className="mt-4 data-[state=inactive]:hidden"><YardSettings embedded /></TabsContent>
            <TabsContent value="users" className="mt-4"><UserManagement embedded /></TabsContent>
            <TabsContent value="server" className="mt-4"><ServerAdmin embedded /></TabsContent>
          </Suspense>
        </Tabs>
      </main>
    </div>
  );
}
