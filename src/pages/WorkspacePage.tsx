import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Settings } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { storageService } from '@/services/storageService';
import { canOpenSection, workspaceSections, type WorkspaceKind } from '@/utils/workspaceSections';

const SettingsPage = lazy(() => import('./SettingsPage'));
const PricingPage = lazy(() => import('./PricingPage'));
const UserManagementPage = lazy(() => import('./UserManagementPage'));
const ServerAdminPage = lazy(() => import('./ServerAdminPage'));
const ReportsPage = lazy(() => import('./ReportsPage'));
const OperationsReviewPage = lazy(() => import('./OperationsReviewPage'));
const ScaleLogPage = lazy(() => import('./ScaleLogPage'));
const SystemHealthPage = lazy(() => import('./SystemHealthPage'));
const BusinessIntelligence = lazy(() => import('@/components/admin/BusinessIntelligenceDashboard').then(module => ({ default: module.BusinessIntelligenceDashboard })));

export default function WorkspacePage({ kind }: { kind: WorkspaceKind }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [settings, setSettings] = useState(storageService.getSettings());
  useEffect(() => storageService.subscribe('mahaffeys_settings', () => setSettings(storageService.getSettings())), []);
  const sections = workspaceSections[kind];
  const available = sections.filter(section => user && canOpenSection(user.role, section, settings.rolePageAccess));
  const requested = params.get('section');
  // Explicit section URLs still pass through the original access gate; never silently grant access.
  const selected = sections.find(section => section.id === requested) ?? available[0];
  const title = kind === 'settings' ? 'Settings' : 'Analytics';
  const Icon = kind === 'settings' ? Settings : BarChart3;

  const content = kind === 'settings' ? {
    general: <SettingsPage embedded />, pricing: <PricingPage embedded />,
    users: <UserManagementPage embedded />, server: <ServerAdminPage embedded />,
  } : {
    reports: <ReportsPage embedded />, operations: <OperationsReviewPage embedded />,
    scales: <ScaleLogPage embedded />, health: <SystemHealthPage embedded />,
    business: <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6"><BusinessIntelligence /></main>,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <section aria-label={`${title} workspace`} className="mx-auto max-w-7xl px-3 pt-5 sm:px-6">
        <div className="rounded-2xl border border-emerald-500/25 bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600/20 p-3 text-emerald-300"><Icon className="h-6 w-6" /></div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-slate-300">{kind === 'settings' ? 'All configuration and administration in one place.' : 'All reports, activity, and performance in one place.'}</p>
            </div>
          </div>
          <nav aria-label={`${title} sections`} className="mt-4 flex flex-wrap gap-2">
            {available.map(section => (
              <Link key={section.id} to={`/${kind}?section=${section.id}`} aria-current={selected?.id === section.id ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${selected?.id === section.id ? 'border-emerald-500 bg-emerald-700 text-white' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-emerald-500 hover:text-white'}`}>
                {section.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      {selected ? (
        <ProtectedRoute page={selected.page} requireAdmin={selected.adminOnly}>
          <Suspense fallback={<LoadingSpinner />}>
            <div key={`${kind}-${selected.id}`}>{content[selected.id as keyof typeof content]}</div>
          </Suspense>
        </ProtectedRoute>
      ) : (
        <main className="mx-auto max-w-lg space-y-4 p-6 text-center">
          <p>Your role has no access to this workspace.</p>
          <Button asChild className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-600"><Link to="/">Back to Dashboard</Link></Button>
        </main>
      )}
    </div>
  );
}
