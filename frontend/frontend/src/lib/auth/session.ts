export const AUTH_TOKEN_KEY = "fk-auth-token";
export const AUTH_SESSION_KEY = "fk-auth-session";

export type AccountRole = "OWNER" | "STAFF";

export type AuthSession = {
  username: string;
  role: AccountRole;
  fullName: string;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      parsed &&
      typeof parsed.username === "string" &&
      (parsed.role === "OWNER" || parsed.role === "STAFF") &&
      typeof parsed.fullName === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, session: AuthSession) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

/** Client-side expiry check only — signature is verified by the backend. */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number; role?: string };
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function decodeRoleFromToken(token: string): AccountRole | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { role?: string };
    if (payload.role === "OWNER" || payload.role === "STAFF") {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

export function defaultLandingPath(role: AccountRole): string {
  return role === "OWNER" ? "/" : "/customers";
}

const OWNER_ONLY_PREFIXES = [
  "/",
  "/orders",
  "/products",
  "/alerts",
  "/reports",
  "/accounts",
] as const;

export function isOwnerOnlyPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return OWNER_ONLY_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export function canAccessPath(role: AccountRole, pathname: string): boolean {
  if (pathname === "/login") return true;
  if (role === "OWNER") return true;
  if (isOwnerOnlyPath(pathname)) return false;
  return (
    pathname === "/campaigns" ||
    pathname.startsWith("/campaigns/") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/")
  );
}
