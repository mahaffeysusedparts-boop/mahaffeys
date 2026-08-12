import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

import DashboardPage from "./pages/DashboardPage";
import IntakePage from "./pages/IntakePage";
import PublicInventoryPage from "./pages/PublicInventoryPage";
import PublicVehiclesPage from "./pages/PublicVehiclesPage";
import TicketsPage from "./pages/TicketsPage";
import PricingPage from "./pages/PricingPage";
import CustomersPage from "./pages/CustomersPage";
import SettingsPage from "./pages/SettingsPage";
import { CompliancePage } from "./pages/CompliancePage";
import ContainersPage from "./pages/ContainersPage";
import CashDrawerPage from "./pages/CashDrawerPage";
import YardMapPage from "./pages/YardMapPage";
import PullAPartPage from "./pages/PullAPartPage";
import MobileYardPage from "./pages/MobileYardPage";
import SystemHealthPage from "./pages/SystemHealthPage";
import ServerAdminPage from "./pages/ServerAdminPage";
import UserManagementPage from "./pages/UserManagementPage";
import LoginPage from "./pages/LoginPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import CamerasPage from "./pages/CamerasPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Routes>
            {/* PUBLIC AUTH ROUTES */}
            <Route path="/setup" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />

            {/* PUBLIC YARD PARTS & VEHICLES CATALOG EXCEPTIONS (Guest Accessible) */}
            <Route path="/inventory" element={<PublicInventoryPage />} />
            <Route path="/vehicles" element={<PublicVehiclesPage />} />

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
              path="/mobile-yard"
              element={
                <ProtectedRoute>
                  <MobileYardPage />
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;