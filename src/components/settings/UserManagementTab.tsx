import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { UserAccount, UserRole, AccountStatus } from "@/types/scrap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const UserManagementTab: React.FC = () => {
  const { allUsers, approveUser, rejectUser, updateUserStatus, updateUserRole, deleteUser, user: currentUser } = useAuth();

  const pendingUsers = allUsers.filter((u) => u.status === "pending");
  const activeUsers = allUsers.filter((u) => u.status !== "pending");

  const [roleEdits, setRoleEdits] = useState<Record<string, UserRole>>({});

  const handleApprove = (userId: string, currentReqRole: UserRole) => {
    const assignedRole = roleEdits[userId] || currentReqRole;
    approveUser(userId, assignedRole);
    toast.success("User access approved successfully!");
  };

  const handleReject = (userId: string) => {
    rejectUser(userId);
    toast.info("User access request rejected");
  };

  const handleStatusToggle = (userId: string, currentStatus: AccountStatus) => {
    const newStatus = currentStatus === "approved" ? "disabled" : "approved";
    updateUserStatus(userId, newStatus);
    toast.success(`User status updated to ${newStatus.toUpperCase()}`);
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRole(userId, newRole);
    toast.success(`User role updated to ${newRole.replace("_", " ").toUpperCase()}`);
  };

  const handleDelete = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to remove user ${userName}?`)) {
      deleteUser(userId);
      toast.info(`User ${userName} removed`);
    }
  };

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    yard_manager: "Yard Manager",
    scale_operator: "Scale Operator",
  };

  return (
    <div className="space-y-6">
      
      {/* Pending Account Approvals Section */}
      <Card className="bg-slate-900 border-amber-500/40 text-white shadow-xl overflow-hidden">
        <CardHeader className="py-4 px-6 bg-slate-950/80 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <CardTitle className="text-base font-bold text-white">
                Pending Access Approval Requests ({pendingUsers.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                New operators requesting workstation access to ScrapFlow
              </CardDescription>
            </div>
          </div>

          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
            {pendingUsers.length} PENDING
          </Badge>
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
                  <TableHead className="text-slate-400">Requested Role</TableHead>
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
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
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

      {/* Active System Users Table */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl overflow-hidden">
        <CardHeader className="py-4 px-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <CardTitle className="text-base font-bold text-white">
                Registered Workstation Accounts ({activeUsers.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Manage assigned permissions, status, and role privileges
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950">
              <TableRow className="border-slate-800 text-xs">
                <TableHead className="text-slate-400">User Name</TableHead>
                <TableHead className="text-slate-400">Username</TableHead>
                <TableHead className="text-slate-400">Role Privilege</TableHead>
                <TableHead className="text-slate-400">Account Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map((u) => {
                const isSelf = currentUser?.id === u.id;

                return (
                  <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/40 text-xs font-mono">
                    <TableCell className="font-sans font-bold text-white flex items-center gap-2">
                      {u.fullName} {isSelf && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">YOU</Badge>}
                    </TableCell>

                    <TableCell className="text-slate-300">{u.username}</TableCell>

                    <TableCell className="font-sans">
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                          <SelectItem value="scale_operator">Scale Operator</SelectItem>
                          <SelectItem value="yard_manager">Yard Manager</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="font-sans">
                      {u.status === "approved" && (
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                          ACTIVE APPROVED
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
                        {u.status === "approved" ? "Disable Access" : "Enable Access"}
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

    </div>
  );
};