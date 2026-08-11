import React, { createContext, useContext, useState, useEffect } from "react";
import { UserAccount, UserRole, AccountStatus } from "@/types/scrap";
import { authService } from "@/services/authService";

interface AuthContextType {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  hasAdminInSystem: boolean;
  pendingUsersCount: number;
  login: (username: string, password: string) => void;
  logout: () => void;
  register: (data: { fullName: string; username: string; password: string; role: UserRole; email?: string }) => void;
  setupAdmin: (data: { fullName: string; username: string; password: string; email?: string }) => void;
  approveUser: (userId: string, assignedRole?: UserRole) => void;
  rejectUser: (userId: string) => void;
  updateUserStatus: (userId: string, status: AccountStatus) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  deleteUser: (userId: string) => void;
  refreshUsers: () => void;
  allUsers: UserAccount[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(() => authService.getCurrentUser());
  const [hasAdminInSystem, setHasAdminInSystem] = useState<boolean>(() => authService.hasAdmin());
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => authService.getUsers());

  const refreshUsers = () => {
    const users = authService.getUsers();
    setAllUsers(users);
    setHasAdminInSystem(authService.hasAdmin());
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const login = (username: string, password: string) => {
    const loggedInUser = authService.login(username, password);
    setUser(loggedInUser);
    refreshUsers();
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    refreshUsers();
  };

  const register = (data: { fullName: string; username: string; password: string; role: UserRole; email?: string }) => {
    const newUser = authService.registerUser(data);
    setUser(newUser);
    refreshUsers();
  };

  const setupAdmin = (data: { fullName: string; username: string; password: string; email?: string }) => {
    const adminUser = authService.setupInitialAdmin(data);
    setUser(adminUser);
    refreshUsers();
  };

  const approveUser = (userId: string, assignedRole?: UserRole) => {
    authService.approveUser(userId, assignedRole, user?.id);
    refreshUsers();
  };

  const rejectUser = (userId: string) => {
    authService.rejectUser(userId);
    refreshUsers();
  };

  const updateUserStatus = (userId: string, status: AccountStatus) => {
    authService.updateUserStatus(userId, status);
    refreshUsers();
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    authService.updateUserRole(userId, role);
    refreshUsers();
  };

  const deleteUser = (userId: string) => {
    authService.deleteUser(userId);
    refreshUsers();
  };

  const isAuthenticated = !!user;
  const isApproved = user?.status === "approved";
  const isAdmin = user?.role === "admin" && isApproved;
  const pendingUsersCount = allUsers.filter((u) => u.status === "pending").length;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isApproved,
        isAdmin,
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};