"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi } from "@/src/lib/api/auth";
import {
  type AccountRole,
  type AuthSession,
  clearAuth,
  getStoredSession,
  getStoredToken,
  isTokenValid,
  saveAuth,
} from "@/src/lib/auth/session";

type AuthContextValue = {
  ready: boolean;
  session: AuthSession | null;
  role: AccountRole | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isStaff: boolean;
  login: (username: string, password: string) => Promise<AuthSession>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const stored = getStoredSession();
    if (isTokenValid(token) && stored) {
      setSession(stored);
    } else {
      clearAuth();
      setSession(null);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login({ username, password });
    const next: AuthSession = {
      username: result.username,
      role: result.role,
      fullName: result.fullName,
    };
    saveAuth(result.token, next);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      role: session?.role ?? null,
      isAuthenticated: !!session,
      isOwner: session?.role === "OWNER",
      isStaff: session?.role === "STAFF",
      login,
      logout,
    }),
    [ready, session, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
