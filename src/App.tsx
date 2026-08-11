import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TicketsPage from "./pages/TicketsPage";
import PricingPage from "./pages/PricingPage";
import CustomersPage from "./pages/CustomersPage";
import SettingsPage from "./pages/SettingsPage";
import { CompliancePage } from "./pages/CompliancePage";
import ContainersPage from "./pages/ContainersPage";
import CashDrawerPage from "./pages/CashDrawerPage";
import YardMapPage from "./pages/YardMapPage";
import PullAPartPage from "./pages/PullAPartPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/pull-a-part" element={<PullAPartPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/cash-drawer" element={<CashDrawerPage />} />
          <Route path="/yard-map" element={<YardMapPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
