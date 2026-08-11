import React, { createContext, useContext, useEffect, useState } from "react";
import { AccountStatus, UserAccount, UserRole } from "@/types/scrap";
import { authService } from "@/services/authService";
import { sharedStorage } from "@/services/sharedStorage";

interface AuthContextType {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  serverError: string | null;
  hasAdminInSystem: boolean;
  pendingUsersCount: number;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { fullName: string; username: string; password: string; role: UserRole; email?: string }) => Promise<void>;
  setupAdmin: (data: { fullName: string; username: string; password: string; email?: string }) => Promise<void>;
  approveUser: (userId: string, assignedRole?: UserRole) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  updateUserStatus: (userId: string, status: AccountStatus) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  allUsers: UserAccount[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [hasAdminInSystem, setHasAdminInSystem] = useState(false);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const syncState = () => {
    setUser(authService.getCurrentUser());
    setHasAdminInSystem(authService.hasAdmin());
    setAllUsers(authService.getUsers());
  };

  const refreshUsers = async () => {
    await authService.refreshUsers();
    if (authService.getCurrentUser()?.status === "approved" && sharedStorage.getStatus() !== "connected") {
      await sharedStorage.hydrate();
    }
    syncState();
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const status = await authService.initialize();
        if (status.user?.status === "approved") await sharedStorage.hydrate();
        syncState();
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "Unable to reach the ScrapFlow server");
      } finally {
        setIsLoading(false);
      }
    };
    void initialize();
  }, []);

  const login = async (username: string, password: string) => {
    const loggedInUser = await authService.login(username, password);
    if (loggedInUser.status === "approved") await sharedStorage.hydrate();
    syncState();
  };

  const logout = async () => {
    await authService.logout();
    sharedStorage.disconnect();
    syncState();
  };

  const register = async (data: { fullName: string; username: string; password: string; role: UserRole; email?: string }) => {
    await authService.registerUser(data);
    syncState();
  };

  const setupAdmin = async (data: { fullName: string; username: string; password: string; email?: string }) => {
    await authService.setupInitialAdmin(data);
    await sharedStorage.hydrate();
    syncState();
  };

  const approveUser = async (userId: string, assignedRole?: UserRole) => {
    await authService.approveUser(userId, assignedRole);
    syncState();
  };

  const rejectUser = async (userId: string) => {
    await authService.rejectUser(userId);
    syncState();
  };

  const updateUserStatus = async (userId: string, status: AccountStatus) => {
    await authService.updateUserStatus(userId, status);
    syncState();
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    await authService.updateUserRole(userId, role);
    syncState();
  };

  const deleteUser = async (userId: string) => {
    await authService.deleteUser(userId);
    syncState();
  };

  const isAuthenticated = !!user;
  const isApproved = user?.status === "approved";
  const isAdmin = user?.role === "admin" && isApproved;
  const pendingUsersCount = allUsers.filter((account) => account.status === "pending").length;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isApproved,
      isAdmin,
      isLoading,
      serverError,
      hasAdminInSystem,
      pendingUsersCount,
      login,
      logout,
      register,
      setupAdmin,
      approveUser,
      rejectUser,
      updateUserStatus,
      updateUserRole,
      deleteUser,
      refreshUsers,
      allUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
