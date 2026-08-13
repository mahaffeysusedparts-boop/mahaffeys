import { AccountStatus, UserAccount, UserRole } from "@/types/scrap";
import { apiRequest } from "./apiClient";

let currentUser: UserAccount | null = null;
let usersCache: UserAccount[] = [];
let hasAdminCache = false;

interface StatusResponse {
  user: UserAccount | null;
  hasAdmin: boolean;
}

export const authService = {
  getUsers(): UserAccount[] {
    return usersCache;
  },

  hasAdmin(): boolean {
    return hasAdminCache;
  },

  getCurrentUser(): UserAccount | null {
    return currentUser;
  },

  async initialize(): Promise<StatusResponse> {
    const status = await apiRequest<StatusResponse>("/api/auth/status");
    currentUser = status.user;
    hasAdminCache = status.hasAdmin;
    if (currentUser?.role === "admin" && currentUser.status === "approved") {
      await this.refreshUsers();
    }
    return status;
  },

  async refreshUsers(): Promise<UserAccount[]> {
    if (currentUser?.role !== "admin" || currentUser.status !== "approved") {
      const status = await apiRequest<StatusResponse>("/api/auth/status");
      currentUser = status.user;
      hasAdminCache = status.hasAdmin;
      usersCache = currentUser ? [currentUser] : [];
      return usersCache;
    }
    const response = await apiRequest<{ users: UserAccount[] }>("/api/users");
    usersCache = response.users;
    currentUser = usersCache.find((user) => user.id === currentUser?.id) || currentUser;
    return usersCache;
  },

  async setupInitialAdmin(data: { fullName: string; username: string; password: string; email?: string }) {
    const response = await apiRequest<{ user: UserAccount }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    currentUser = response.user;
    hasAdminCache = true;
    usersCache = [response.user];
    return response.user;
  },

  async registerUser(data: { fullName: string; username: string; password: string; role: UserRole; email?: string }) {
    const response = await apiRequest<{ user: UserAccount }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    currentUser = response.user;
    usersCache = [response.user];
    return response.user;
  },

  async login(username: string, password: string) {
    const response = await apiRequest<{ user: UserAccount }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    currentUser = response.user;
    if (response.user.role === "admin") await this.refreshUsers();
    return response.user;
  },

  async logout() {
    await apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
    currentUser = null;
    usersCache = [];
  },

  async updateUser(userId: string, update: { role?: UserRole; status?: AccountStatus }) {
    const response = await apiRequest<{ user: UserAccount }>(`/api/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    await this.refreshUsers();
    return response.user;
  },

  approveUser(userId: string, assignedRole?: UserRole) {
    return this.updateUser(userId, { status: "approved", role: assignedRole });
  },

  rejectUser(userId: string) {
    return this.updateUser(userId, { status: "rejected" });
  },

  updateUserStatus(userId: string, status: AccountStatus) {
    return this.updateUser(userId, { status });
  },

  updateUserRole(userId: string, role: UserRole) {
    return this.updateUser(userId, { role });
  },

  async deleteUser(userId: string) {
    await apiRequest<{ ok: true }>(`/api/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    await this.refreshUsers();
  },

  getPendingUsers(): UserAccount[] {
    return usersCache.filter((user) => user.status === "pending");
  },
};
