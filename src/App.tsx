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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
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
              <Route
                path="/"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/intake"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <IntakePage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/pull-a-part"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <PullAPartPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/compliance"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <CompliancePage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/cameras"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <CamerasPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/tickets"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <TicketsPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/pricing"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <PricingPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/containers"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <ContainersPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/cash-drawer"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <CashDrawerPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/yard-map"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <YardMapPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/customers"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <CustomersPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/users"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute requireAdmin>
                      <UserManagementPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/system-status"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute>
                      <SystemHealthPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route
                path="/server-admin"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute requireAdmin>
                      <ServerAdminPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />
              <Route path="/reports" element={<AppErrorBoundary><ProtectedRoute><ReportsPage /></ProtectedRoute></AppErrorBoundary>} />
              <Route path="/scale-log" element={<AppErrorBoundary><ProtectedRoute><ScaleLogPage /></ProtectedRoute></AppErrorBoundary>} />
              <Route path="/operations" element={<AppErrorBoundary><ProtectedRoute><OperationsPage /></ProtectedRoute></AppErrorBoundary>} />
              <Route path="/shipments" element={<AppErrorBoundary><ProtectedRoute><ShipmentsPage /></ProtectedRoute></AppErrorBoundary>} />
              <Route path="/team" element={<AppErrorBoundary><ProtectedRoute><TeamOpsPage /></ProtectedRoute></AppErrorBoundary>} />
              <Route
                path="/settings"
                element={
                  <AppErrorBoundary>
                    <ProtectedRoute requireAdmin>
                      <SettingsPage />
                    </ProtectedRoute>
                  </AppErrorBoundary>
                }
              />

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