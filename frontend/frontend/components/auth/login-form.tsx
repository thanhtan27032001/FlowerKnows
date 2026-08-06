"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiError } from "@/src/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { defaultLandingPath } from "@/src/lib/auth/session";
import { PendingButton } from "@/components/feedback/pending-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const session = await login(username.trim(), password);
      const next = searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? defaultLandingPath(session.role));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("failed")
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-username">{t("username")}</Label>
        <Input
          id="login-username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t("password")}</Label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <PendingButton
        type="submit"
        className="w-full"
        pending={pending}
        pendingLabel={tCommon("pending.confirming")}
      >
        {t("submit")}
      </PendingButton>
    </form>
  );
}
