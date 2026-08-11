import { UserAccount, UserRole, AccountStatus } from "@/types/scrap";

const STORAGE_KEYS = {
  USERS: "scrapflow_users",
  CURRENT_USER: "scrapflow_session_user",
};

// Simple hashing function for local offline environment
function hashPassword(password: string): string {
  let hash = 0;
  const salted = `scrapflow_salt_2025_${password}`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

export const authService = {
  getUsers(): UserAccount[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) return [];
    return JSON.parse(data);
  },

  saveUsers(users: UserAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  hasAdmin(): boolean {
    const users = this.getUsers();
    return users.some((u) => u.role === "admin" && u.status === "approved");
  },

  getCurrentUser(): UserAccount | null {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      // Re-fetch latest from storage to ensure status and role updates are reflected
      const users = this.getUsers();
      const latest = users.find((u) => u.id === parsed.id);
      return latest || parsed;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserAccount | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
  },

  setupInitialAdmin(data: {
    fullName: string;
    username: string;
    password: string;
    email?: string;
  }): UserAccount {
    const users = this.getUsers();
    const adminUser: UserAccount = {
      id: `usr-admin-${Date.now()}`,
      fullName: data.fullName,
      username: data.username.toLowerCase().trim(),
      email: data.email?.toLowerCase().trim(),
      passwordHash: hashPassword(data.password),
      role: "admin",
      status: "approved",
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };

    users.push(adminUser);
    this.saveUsers(users);
    this.setCurrentUser(adminUser);
    return adminUser;
  },

  registerUser(data: {
    fullName: string;
    username: string;
    password: string;
    role: UserRole;
    email?: string;
  }): UserAccount {
    const users = this.getUsers();
    const usernameClean = data.username.toLowerCase().trim();

    if (users.some((u) => u.username === usernameClean)) {
      throw new Error("Username already taken. Please choose another.");
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      fullName: data.fullName,
      username: usernameClean,
      email: data.email?.toLowerCase().trim(),
      passwordHash: hashPassword(data.password),
      role: data.role,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);
    return newUser;
  },

  login(username: string, password: string): UserAccount {
    const users = this.getUsers();
    const cleanUsername = username.toLowerCase().trim();
    const inputHash = hashPassword(password);

    const user = users.find(
      (u) =>
        (u.username === cleanUsername || (u.email && u.email.toLowerCase() === cleanUsername)) &&
        u.passwordHash === inputHash
    );

    if (!user) {
      throw new Error("Invalid username or password.");
    }

    if (user.status === "disabled" || user.status === "rejected") {
      throw new Error("Account access disabled or rejected by Administrator.");
    }

    this.setCurrentUser(user);
    return user;
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  approveUser(userId: string, assignedRole?: UserRole, adminId?: string): UserAccount {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User not found.");
    }

    users[index].status = "approved";
    if (assignedRole) {
      users[index].role = assignedRole;
    }
    users[index].approvedBy = adminId;
    users[index].approvedAt = new Date().toISOString();
    users[index].updatedAt = new Date().toISOString();

    this.saveUsers(users);

    // If current logged in user was approved, update session
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(users[index]);
    }

    return users[index];
  },

  rejectUser(userId: string): UserAccount {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User not found.");
    }

    users[index].status = "rejected";
    users[index].updatedAt = new Date().toISOString();

    this.saveUsers(users);
    return users[index];
  },

  updateUserStatus(userId: string, status: AccountStatus): UserAccount {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User not found.");
    }

    users[index].status = status;
    users[index].updatedAt = new Date().toISOString();

    this.saveUsers(users);
    return users[index];
  },

  updateUserRole(userId: string, role: UserRole): UserAccount {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User not found.");
    }

    users[index].role = role;
    users[index].updatedAt = new Date().toISOString();

    this.saveUsers(users);
    return users[index];
  },

  deleteUser(userId: string): void {
    let users = this.getUsers();
    users = users.filter((u) => u.id !== userId);
    this.saveUsers(users);
  },

  getPendingUsers(): UserAccount[] {
    return this.getUsers().filter((u) => u.status === "pending");
  },
};