"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import {
  canAccessPath,
  defaultLandingPath,
  getStoredToken,
  isTokenValid,
} from "@/src/lib/auth/session";
import { Spinner } from "@/components/feedback/spinner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated, role, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!ready) return;

    const tokenOk = isTokenValid(getStoredToken());

    if (!isAuthenticated || !tokenOk || !role) {
      if (!isLogin) {
        if (!tokenOk) logout();
        const next = encodeURIComponent(pathname);
        router.replace(`/login?next=${next}`);
      }
      return;
    }

    if (isLogin) {
      router.replace(defaultLandingPath(role));
      return;
    }

    if (!canAccessPath(role, pathname)) {
      router.replace(defaultLandingPath(role));
    }
  }, [ready, isAuthenticated, role, isLogin, pathname, router, logout]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isLogin) {
    if (isAuthenticated && role) {
      return (
        <div className="flex min-h-svh items-center justify-center">
          <Spinner />
        </div>
      );
    }
    return <>{children}</>;
  }

  if (!isAuthenticated || !role || !canAccessPath(role, pathname)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
