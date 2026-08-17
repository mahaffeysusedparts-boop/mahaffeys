import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoadingSpinner } from "./components/layout/LoadingSpinner";
import "./print.css";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const IntakePage = lazy(() => import("./pages/IntakePage"));
const PublicInventoryPage = lazy(() => import("./pages/PublicInventoryPage"));
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
            <Route path="/vehicles" element={<PublicVehicleInventoryPage />} />

            {/* PROTECTED WORKSTATION ROUTES */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/intake"
              element={
                <ProtectedRoute>
                  <IntakePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pull-a-part"
              element={
                <ProtectedRoute>
                  <PullAPartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <CompliancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cameras"
              element={
                <ProtectedRoute>
                  <CamerasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <TicketsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <PricingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/containers"
              element={
                <ProtectedRoute>
                  <ContainersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cash-drawer"
              element={
                <ProtectedRoute>
                  <CashDrawerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/yard-map"
              element={
                <ProtectedRoute>
                  <YardMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-status"
              element={
                <ProtectedRoute>
                  <SystemHealthPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/server-admin"
              element={
                <ProtectedRoute requireAdmin>
                  <ServerAdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />
            <Route path="/shipments" element={<ProtectedRoute><ShipmentsPage /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamOpsPage /></ProtectedRoute>} />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <SettingsPage />
                </ProtectedRoute>
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