import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isApproved, isAdmin, user } = useAuth();
  const location = useLocation();

  // 1. Unauthenticated users -> Redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Unapproved users -> Redirect to pending approval
  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  // 3. Admin-restricted routes -> Redirect to home/dashboard if not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};