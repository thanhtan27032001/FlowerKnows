import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthGuard } from "@/components/auth/auth-guard";
import { LoginForm } from "@/components/auth/login-form";
import { Spinner } from "@/components/feedback/spinner";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tCommon = await getTranslations("common");

  return (
    <AuthGuard>
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_55%)] bg-background"
        />
        <div className="relative w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground">
              {tCommon("brand")}
            </p>
            <h1 className="text-sm text-muted-foreground">{t("title")}</h1>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm backdrop-blur-sm">
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
