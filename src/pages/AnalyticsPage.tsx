import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { storageService } from '@/services/storageService';
import { hasPageAccess, type PageKey } from '@/utils/pageAccess';
import { Navbar } from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';

const Reports = lazy(() => import('./ReportsPage'));
const BusinessIntelligence = lazy(() => import('@/components/admin/BusinessIntelligenceDashboard').then(module => ({ default: module.BusinessIntelligenceDashboard })));
const ScaleLog = lazy(() => import('./ScaleLogPage'));
const OperationsReview = lazy(() => import('./OperationsReviewPage'));
const SystemHealth = lazy(() => import('./SystemHealthPage'));

const sections: { value: string; label: string; page: PageKey; path: string; admin?: boolean }[] = [
  { value: 'reports', label: 'Reports', page: 'reports', path: '/reports' },
  { value: 'business', label: 'Business intelligence', page: 'server-admin', path: '/reports', admin: true },
  { value: 'scale', label: 'Weight journal', page: 'scale-log', path: '/scale-log' },
  { value: 'review', label: 'Operations review', page: 'operations-review', path: '/operations-review' },
  { value: 'health', label: 'System health', page: 'system-status', path: '/system-status' },
];

export default function AnalyticsPage() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => storageService.getSettings());
  useEffect(() => storageService.subscribe('mahaffeys_settings', () => setSettings(storageService.getSettings())), []);
  const available = sections.filter(section => user && (!section.admin || isAdmin) && hasPageAccess(user.role, section.page, settings.rolePageAccess));
  const requested = new URLSearchParams(location.search).get('tab') || sections.find(section => section.path === location.pathname)?.value;
  const tab = available.find(section => section.value === requested)?.value || available[0]?.value;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400"><BarChart3 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Analytics</h1>
            <p className="text-sm text-slate-400">Reports, business insights and activity monitoring in one place.</p>
          </div>
        </div>
        <Tabs value={tab} onValueChange={value => {
          const section = available.find(item => item.value === value)!;
          navigate(`${section.path}?tab=${value}`);
        }}>
          <div className="max-w-full overflow-x-auto pb-1">
            <TabsList aria-label="Analytics sections" className="h-auto min-w-max gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
              {available.map(section => <TabsTrigger key={section.value} value={section.value} className="min-h-12 rounded-xl px-4 text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{section.label}</TabsTrigger>)}
            </TabsList>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            {available.some(section => section.value === 'reports') && <TabsContent value="reports" className="mt-4"><Reports embedded /></TabsContent>}
            {available.some(section => section.value === 'business') && <TabsContent value="business" className="mt-4"><BusinessIntelligence /></TabsContent>}
            {available.some(section => section.value === 'scale') && <TabsContent value="scale" className="mt-4"><ScaleLog embedded /></TabsContent>}
            {available.some(section => section.value === 'review') && <TabsContent value="review" className="mt-4"><OperationsReview embedded /></TabsContent>}
            {available.some(section => section.value === 'health') && <TabsContent value="health" className="mt-4"><SystemHealth embedded /></TabsContent>}
          </Suspense>
        </Tabs>
      </main>
    </div>
  );
}
