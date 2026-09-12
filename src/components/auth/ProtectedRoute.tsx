import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { storageService } from "@/services/storageService";
import { hasPageAccess, PAGE_LABELS, type PageKey } from "@/utils/pageAccess";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** Page key gate — denies with a friendly screen when the role lacks access. */
  page?: PageKey;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false, page }) => {
  const { isAuthenticated, isApproved, isAdmin, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-sm font-semibold shadow-xl">
          Connecting to the Mahaffeys database…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Role page permissions — friendly deny, never a redirect loop.
  if (page && user && !hasPageAccess(user.role, page, storageService.getSettings().rolePageAccess)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">No access to {PAGE_LABELS[page]}</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your role doesn't have permission to open this page. Ask an administrator to grant
              access in Settings → Role Page Access if you need it.
            </p>
          </div>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
