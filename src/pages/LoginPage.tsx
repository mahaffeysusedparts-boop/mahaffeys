import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types/scrap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Scale, ShieldCheck, UserPlus, LogIn, Lock, Sparkles, AlertCircle, Wrench, ShieldAlert, Database } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { hasAdminInSystem, login, register, setupAdmin, isAuthenticated, isApproved, isLoading, serverError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";

  React.useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && isApproved) {
      navigate(from, { replace: true });
    } else if (isAuthenticated && !isApproved) {
      navigate("/pending-approval", { replace: true });
    }
  }, [isAuthenticated, isApproved, isLoading, navigate, from]);

  // First-Time Setup State
  const [setupFullName, setSetupFullName] = useState("");
  const [setupUsername, setSetupUsername] = useState("admin");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupEmail, setSetupEmail] = useState("");

  // Login State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register State
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState<UserRole>("scale_operator");

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupFullName.trim() || !setupUsername.trim() || !setupPassword) {
      toast.error("All required fields must be filled");
      return;
    }
    if (setupPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      await setupAdmin({
        fullName: setupFullName,
        username: setupUsername,
        password: setupPassword,
        email: setupEmail,
      });
      toast.success("Primary Administrator account created!", {
        description: "The shared database is initialized and ready.",
      });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to create Admin account");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      toast.error("Username and password are required");
      return;
    }

    try {
      await login(loginUsername, loginPassword);
      toast.success("Sign in successful!");
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regUsername.trim() || !regPassword) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (regPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      await register({
        fullName: regFullName,
        username: regUsername,
        password: regPassword,
        role: regRole,
        email: regEmail,
      });
      toast.success("Account request submitted!", {
        description: "Your account is awaiting approval by an Administrator.",
      });
      navigate("/pending-approval", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    }
  };

  if (isLoading || serverError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-4">
        <Card className="w-full max-w-md rounded-3xl border-slate-800 bg-slate-900 text-white shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${serverError ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {serverError ? <ShieldAlert className="h-7 w-7" /> : <Database className="h-7 w-7 animate-pulse" />}
            </div>
            <div>
              <h1 className="text-xl font-extrabold">{serverError ? "Database server unavailable" : "Connecting to your database"}</h1>
              <p className="mt-2 text-sm text-slate-400">{serverError || "Checking the secure session on this workstation…"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative font-sans overflow-hidden">
      
      {/* Subtle Background Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-950/80">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-mono">
            ScrapFlow Local
          </h1>
          <p className="text-xs text-slate-400">
            Industrial Scrap Yard Scale, Auto Salvage & Compliance Suite
          </p>
        </div>

        {/* View Case 1: First Time Admin Initialization Wizard */}
        {!hasAdminInSystem ? (
          <Card className="bg-slate-900 border-2 border-emerald-500/50 text-white shadow-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 bg-slate-950/80 border-b border-slate-800 text-center">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-[10px] mx-auto mb-2">
                FIRST-TIME SYSTEM INITIALIZATION
              </Badge>
              <CardTitle className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Create Administrator Account
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                No administrator exists in the shared PC database. Create the primary account once, then use it from every authorized device.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSetupAdmin} className="space-y-4 text-xs">
                <div>
                  <Label className="text-slate-300">Administrator Full Name *</Label>
                  <Input
                    value={setupFullName}
                    onChange={(e) => setSetupFullName(e.target.value)}
                    placeholder="e.g. Marcus Vance (Owner)"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-slate-300">Username *</Label>
                    <Input
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      placeholder="admin"
                      className="bg-slate-950 border-slate-800 text-emerald-400 font-mono font-bold text-xs mt-1 h-10"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Password *</Label>
                    <Input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Email Address (Optional)</Label>
                  <Input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="admin@scrapflow.local"
                    className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-2 shadow-lg shadow-emerald-950"
                >
                  <ShieldCheck className="w-4 h-4" /> Initialize System & Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* View Case 2: Standard Login / Registration Tabs */
          <Card className="bg-slate-900 border-slate-800 text-white shadow-2xl overflow-hidden">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid grid-cols-2 bg-slate-950 border-b border-slate-800 p-1">
                <TabsTrigger value="login" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-bold gap-1.5 h-9">
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-bold gap-1.5 h-9">
                  <UserPlus className="w-3.5 h-3.5" /> Request Access
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: LOGIN */}
              <TabsContent value="login" className="p-6 space-y-4">
                <form onSubmit={handleLogin} className="space-y-4 text-xs">
                  <div>
                    <Label className="text-slate-300">Username or Email *</Label>
                    <Input
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g. admin or scale_tech1"
                      className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Password *</Label>
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-2 shadow-lg shadow-emerald-950"
                  >
                    <LogIn className="w-4 h-4" /> Sign In to Workstation
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 2: REQUEST ACCESS REGISTRATION */}
              <TabsContent value="register" className="p-6 space-y-4">
                <form onSubmit={handleRegister} className="space-y-3 text-xs">
                  <div>
                    <Label className="text-slate-300">Full Name *</Label>
                    <Input
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Sam Taylor"
                      className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-slate-300">Username *</Label>
                      <Input
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="e.g. scale_sam"
                        className="bg-slate-950 border-slate-800 text-white font-mono text-xs mt-1 h-10"
                      />
                    </div>

                    <div>
                      <Label className="text-slate-300">Password *</Label>
                      <Input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Requested Role *</Label>
                    <Select value={regRole} onValueChange={(val) => setRegRole(val as UserRole)}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                        <SelectItem value="scale_operator">Scale Operator (Intake, Scale & Tickets)</SelectItem>
                        <SelectItem value="yard_manager">Yard Manager (Full Operations & Pricing)</SelectItem>
                        <SelectItem value="admin">Administrator (System & User Management)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-slate-300">Email Address (Optional)</Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="sam@scrapflow.local"
                      className="bg-slate-950 border-slate-800 text-white text-xs mt-1 h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs gap-2 shadow-lg shadow-amber-950"
                  >
                    <UserPlus className="w-4 h-4" /> Submit Access Request
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {/* Public Inventory Bypass Link */}
        <div className="text-center pt-2">
          <Button
            variant="link"
            onClick={() => navigate("/inventory")}
            className="text-xs text-slate-400 hover:text-amber-400 gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            Public Yard Parts & Inventory Catalog (Guest Access)
          </Button>
        </div>

      </div>
    </div>
  );
}