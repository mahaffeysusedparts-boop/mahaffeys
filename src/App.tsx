import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoadingSpinner } from "./components/layout/LoadingSpinner";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import { OfflineBanner } from "./components/layout/OfflineBanner";
import "./print.css";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const IntakePage = lazy(() => import("./pages/IntakePage"));
const PublicInventoryPage = lazy(() => import("./pages/PublicInventoryPage"));
const PublicVehicleDetailPage = lazy(() => import("./pages/PublicVehicleDetailPage"));
const PublicVehicleInventoryPage = lazy(() => import("./pages/PublicVehicleInventoryPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CompliancePage = lazy(() =>
  import("./pages/CompliancePage").then((module) => ({ default: module.CompliancePage })),
);
const ContainersPage = lazy(() => import("./pages/ContainersPage"));
const CashDrawerPage = lazy(() => import("./pages/CashDrawerPage"));
const YardMapPage = lazy(() => import("./pages/YardMapPage"));
const PullAPartPage = lazy(() => import("./pages/PullAPartPage"));
const CamerasPage = lazy(() => import("./pages/CamerasPage"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));
const ServerAdminPage = lazy(() => import("./pages/ServerAdminPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ScaleLogPage = lazy(() => import("./pages/ScaleLogPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const TeamOpsPage = lazy(() => import("./pages/TeamOpsPage"));
const OperationsPage = lazy(() => import("./pages/OperationsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/** Wraps a page in the error boundary + role-aware protected route. */
function guarded(page: React.ReactNode, pageKey: Parameters<typeof ProtectedRoute>[0]["page"], requireAdmin = false) {
  return (
    <AppErrorBoundary>
      <ProtectedRoute page={pageKey} requireAdmin={requireAdmin}>
        {page}
      </ProtectedRoute>
    </AppErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <OfflineBanner />
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* PUBLIC AUTH ROUTES */}
              <Route path="/setup" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/pending-approval" element={<PendingApprovalPage />} />

              {/* PUBLIC YARD PARTS CATALOG EXCEPTION (Guest Accessible) */}
              <Route path="/inventory" element={<PublicInventoryPage />} />
              <Route path="/inventory/vehicle/:vin" element={<PublicVehicleDetailPage />} />
              <Route path="/vehicles" element={<PublicVehicleInventoryPage />} />

              {/* PROTECTED WORKSTATION ROUTES - Wrapped with Error Boundary */}
              <Route path="/" element={guarded(<DashboardPage />, "dashboard")} />
              <Route path="/dashboard" element={guarded(<DashboardPage />, "dashboard")} />
              <Route path="/intake" element={guarded(<IntakePage />, "intake")} />
              <Route path="/pull-a-part" element={guarded(<PullAPartPage />, "pull-a-part")} />
              <Route path="/compliance" element={guarded(<CompliancePage />, "compliance")} />
              <Route path="/cameras" element={guarded(<CamerasPage />, "cameras")} />
              <Route path="/tickets" element={guarded(<TicketsPage />, "tickets")} />
              <Route path="/pricing" element={guarded(<PricingPage />, "pricing")} />
              <Route path="/containers" element={guarded(<ContainersPage />, "containers")} />
              <Route path="/cash-drawer" element={guarded(<CashDrawerPage />, "cash-drawer")} />
              <Route path="/yard-map" element={guarded(<YardMapPage />, "yard-map")} />
              <Route path="/customers" element={guarded(<CustomersPage />, "customers")} />
              <Route path="/users" element={guarded(<UserManagementPage />, "users", true)} />
              <Route path="/system-status" element={guarded(<SystemHealthPage />, "system-status")} />
              <Route path="/server-admin" element={guarded(<ServerAdminPage />, "server-admin", true)} />
              <Route path="/reports" element={guarded(<ReportsPage />, "reports")} />
              <Route path="/scale-log" element={guarded(<ScaleLogPage />, "scale-log")} />
              <Route path="/operations" element={guarded(<OperationsPage />, "operations")} />
              <Route path="/shipments" element={guarded(<ShipmentsPage />, "shipments")} />
              <Route path="/team" element={guarded(<TeamOpsPage />, "team")} />
              <Route path="/settings" element={guarded(<SettingsPage />, "settings", true)} />

              {/* CATCH-ALL 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
