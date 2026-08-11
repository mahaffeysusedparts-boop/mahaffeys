import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldAlert, RotateCcw, LogOut, Wrench, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function PendingApprovalPage() {
  const { user, logout, refreshUsers } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.status === "approved") {
      toast.success("Account approved!", { description: "Welcome to ScrapFlow." });
      navigate("/");
    }
  }, [navigate, user?.status]);

  const handleCheckStatus = async () => {
    try {
      await refreshUsers();
      toast.info("Account status refreshed from the shared database.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to check account status");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    yard_manager: "Yard Manager",
    scale_operator: "Scale Operator",
    yard_employee: "Yard Employee",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative font-sans">
      
      <div className="w-full max-w-md space-y-6">
        
        <Card className="bg-slate-900 border-2 border-amber-500/40 text-white shadow-2xl text-center overflow-hidden">
          <CardHeader className="py-6 px-6 bg-slate-950/80 border-b border-slate-800 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-xl">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-xs mb-2">
                AWAITING ADMIN APPROVAL
              </Badge>
              <CardTitle className="text-xl font-extrabold text-white">
                Account Review Pending
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Your registration request has been received. A yard Administrator must approve your account before you can access workstations.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4 text-xs font-mono">
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">User Name:</span>
                <span className="font-bold text-white">{user?.fullName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Username:</span>
                <span className="font-bold text-amber-300">{user?.username}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Requested Role:</span>
                <span className="font-bold text-sky-400">{user?.role ? roleLabels[user.role] : "Operator"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Request Date:</span>
                <span className="text-slate-300">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={handleCheckStatus}
                className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-2 shadow-lg shadow-amber-950"
              >
                <RotateCcw className="w-4 h-4" /> Check Approval Status / Refresh
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/inventory")}
                className="w-full h-10 border-slate-700 bg-slate-800 text-slate-200 text-xs font-bold gap-1.5"
              >
                <Wrench className="w-4 h-4 text-amber-400" /> View Public Yard Parts Catalog
              </Button>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full h-10 text-slate-400 hover:text-white gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}