import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { UserAccount, UserRole, AccountStatus } from "@/types/scrap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Trash2,
  ShieldAlert,
  Search,
  UserPlus,
  Lock,
  KeyRound,
  Shield,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function UserManagementPage() {
  const { allUsers, approveUser, rejectUser, updateUserStatus, updateUserRole, deleteUser, user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleEdits, setRoleEdits] = useState<Record<string, UserRole>>({});

  const pendingUsers = allUsers.filter((u) => u.status === "pending");
  const activeUsers = allUsers.filter((u) => u.status !== "pending");

  const filteredActiveUsers = activeUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleApprove = async (userId: string, currentReqRole: UserRole) => {
    try {
      const assignedRole = roleEdits[userId] || currentReqRole;
      await approveUser(userId, assignedRole);
      toast.success("User account approved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve user");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await rejectUser(userId);
      toast.info("User access request rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reject user");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: AccountStatus) => {
    const newStatus = currentStatus === "approved" ? "disabled" : "approved";
    try {
      await updateUserStatus(userId, newStatus);
      toast.success(`User status updated to ${newStatus.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user status");
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success(`User role updated to ${newRole.replace("_", " ").toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user role");
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to permanently delete user account "${userName}"?`)) {
      try {
        await deleteUser(userId);
        toast.info(`User account "${userName}" deleted`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete user");
      }
    }
  };

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    yard_manager: "Yard Manager",
    scale_operator: "Scale Operator",
    yard_employee: "Yard Employee",
  };

  const adminCount = allUsers.filter((u) => u.role === "admin" && u.status === "approved").length;
  const managerCount = allUsers.filter((u) => u.role === "yard_manager" && u.status === "approved").length;
  const operatorCount = allUsers.filter((u) => u.role === "scale_operator" && u.status === "approved").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  User Management & Workstation Access Control
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  ADMIN SECURITY
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Approve new operator accounts, assign workstation roles, and manage system permissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300 text-xs px-3 py-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5 inline" /> Primary Admin Lock Active
            </Badge>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Accounts</p>
                <p className="text-3xl font-black text-white font-mono mt-1">{allUsers.length}</p>
                <p className="text-[11px] text-slate-500 mt-1">Registered in system</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800 text-slate-300 border border-slate-700">
                <Users className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-amber-500/30 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending Approvals</p>
                <p className="text-3xl font-black text-amber-400 font-mono mt-1">{pendingUsers.length}</p>
                <p className="text-[11px] text-amber-300/80 mt-1">
                  {pendingUsers.length > 0 ? "Requires Admin Action" : "Queue Empty"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scale Operators</p>
                <p className="text-3xl font-black text-emerald-400 font-mono mt-1">{operatorCount}</p>
                <p className="text-[11px] text-slate-500 mt-1">Active intake techs</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Administrators</p>
                <p className="text-3xl font-black text-purple-300 font-mono mt-1">{adminCount}</p>
                <p className="text-[11px] text-slate-500 mt-1">Full system privilege</p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Shield className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION 1: Pending Approval Queue */}
        <Card className="bg-slate-900 border-2 border-amber-500/40 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <CardTitle className="text-base font-bold text-white">
                  Pending Account Approval Requests ({pendingUsers.length})
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Operators requesting access to ScrapFlow workstations
                </CardDescription>
              </div>
            </div>

            {pendingUsers.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs animate-pulse">
                ACTION REQUIRED
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {pendingUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No pending access requests. All registered operators are reviewed.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow className="border-slate-800 text-xs">
                    <TableHead className="text-slate-400">Full Name</TableHead>
                    <TableHead className="text-slate-400">Username</TableHead>
                    <TableHead className="text-slate-400">Assigned Role</TableHead>
                    <TableHead className="text-slate-400">Request Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((p) => (
                    <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                      <TableCell className="font-sans font-bold text-white">{p.fullName}</TableCell>
                      <TableCell className="text-amber-300 font-bold">{p.username}</TableCell>
                      <TableCell className="font-sans">
                        <Select
                          value={roleEdits[p.id] || p.role}
                          onValueChange={(val) => setRoleEdits({ ...roleEdits, [p.id]: val as UserRole })}
                        >
                          <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                            <SelectItem value="yard_employee">Yard Employee</SelectItem>
                            <SelectItem value="scale_operator">Scale Operator</SelectItem>
                            <SelectItem value="yard_manager">Yard Manager</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(p.id, p.role)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(p.id)}
                          className="border-slate-700 bg-slate-800 text-red-400 hover:bg-red-950 text-xs gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* SECTION 2: Active User Accounts Directory */}
        <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
          <CardHeader className="py-4 px-6 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <div>
                <CardTitle className="text-base font-bold text-white">
                  Workstation User Directory ({activeUsers.length})
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Manage assigned roles, toggle status, or remove operator profiles
                </CardDescription>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input
                placeholder="Search user name or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs pl-8 w-60"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow className="border-slate-800 text-xs">
                  <TableHead className="text-slate-400">User Full Name</TableHead>
                  <TableHead className="text-slate-400">Username</TableHead>
                  <TableHead className="text-slate-400">Role Privilege</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Created Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActiveUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                      <TableCell className="font-sans font-bold text-white flex items-center gap-2">
                        {u.fullName} {isSelf && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">CURRENT USER</Badge>}
                      </TableCell>

                      <TableCell className="text-amber-300 font-bold">{u.username}</TableCell>

                      <TableCell className="font-sans">
                        <Select
                          value={u.role}
                          onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                            <SelectItem value="yard_employee">Yard Employee</SelectItem>
                            <SelectItem value="scale_operator">Scale Operator</SelectItem>
                            <SelectItem value="yard_manager">Yard Manager</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="font-sans">
                        {u.status === "approved" && (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                            ACTIVE
                          </Badge>
                        )}
                        {u.status === "disabled" && (
                          <Badge className="bg-rose-950 text-rose-300 border-rose-800 text-[10px]">
                            DISABLED
                          </Badge>
                        )}
                        {u.status === "rejected" && (
                          <Badge variant="outline" className="text-red-400 border-red-800 text-[10px]">
                            REJECTED
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</TableCell>

                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSelf}
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          className={`h-7 text-xs ${
                            u.status === "approved"
                              ? "text-rose-400 hover:text-rose-300"
                              : "text-emerald-400 hover:text-emerald-300"
                          }`}
                        >
                          {u.status === "approved" ? "Disable" : "Enable"}
                        </Button>

                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(u.id, u.fullName)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}