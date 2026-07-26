"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { PendingButton } from "@/components/feedback/pending-button";
import { ApiError } from "@/src/lib/api/client";
import {
  accountApi,
  accountKeys,
  type Account,
  type CreateAccountInput,
} from "@/src/lib/api/account";
import type { AccountRole } from "@/src/lib/auth/session";
import { formatDateTime } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("accounts.create");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AccountRole>("STAFF");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setFullName("");
    setRole("STAFF");
    setFormError(null);
    setFieldErrors({});
  };

  const mutation = useMutation({
    mutationFn: (input: CreateAccountInput) => accountApi.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const submit = () => {
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = t("usernameRequired");
    if (!fullName.trim()) errors.fullName = t("fullNameRequired");
    if (!password) errors.password = t("passwordRequired");
    else if (password.length < 8) errors.password = t("passwordMin");
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate({
      username: username.trim(),
      password,
      fullName: fullName.trim(),
      role,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-2">
            <Label htmlFor="account-username">{t("username")}</Label>
            <Input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={mutation.isPending}
              autoComplete="off"
            />
            {fieldErrors.username ? (
              <p className="text-xs text-destructive">{fieldErrors.username}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-password">{t("password")}</Label>
            <Input
              id="account-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutation.isPending}
              autoComplete="new-password"
            />
            {fieldErrors.password ? (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-full-name">{t("fullName")}</Label>
            <Input
              id="account-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={mutation.isPending}
            />
            {fieldErrors.fullName ? (
              <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>{t("role")}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as AccountRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">{tAuth("roles.OWNER")}</SelectItem>
                <SelectItem value="STAFF">{tAuth("roles.STAFF")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("actions.cancel")}
          </Button>
          <PendingButton
            type="button"
            pending={mutation.isPending}
            pendingLabel={tCommon("pending.creating")}
            onClick={submit}
          >
            {t("submit")}
          </PendingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountActiveToggle({ account }: { account: Account }) {
  const t = useTranslations("accounts");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (active: boolean) => accountApi.setActive(account.id, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!account.active)}
    >
      {account.active ? t("deactivate") : t("activate")}
    </Button>
  );
}

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tAuth = useTranslations("auth");
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: accountKeys.lists(),
    queryFn: accountApi.list,
  });

  const accounts = data ?? [];

  return (
    <AppShell title={t("title")}>
      <div className="relative space-y-4">
        <QueryProgressBar active={isFetching && !isLoading} />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateOpen(true)}>{t("createButton")}</Button>
        </div>

        {isLoading && <ListSkeleton columns={5} />}

        {isError && (
          <QueryErrorState
            message={
              error instanceof Error ? error.message : t("loadError")
            }
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && accounts.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && accounts.length > 0 && (
          <>
            <div className="grid gap-3 md:hidden">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {account.fullName}
                      </CardTitle>
                      <StatusBadge
                        variant={account.active ? "info" : "neutral"}
                      >
                        {account.active ? t("active") : t("inactive")}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      @{account.username} · {tAuth(`roles.${account.role}`)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(account.createdAt)}
                    </p>
                    <AccountActiveToggle account={account} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.username")}</TableHead>
                    <TableHead>{t("columns.fullName")}</TableHead>
                    <TableHead>{t("columns.role")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.createdAt")}</TableHead>
                    <TableHead className="text-right">
                      {t("columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.username}
                      </TableCell>
                      <TableCell>{account.fullName}</TableCell>
                      <TableCell>{tAuth(`roles.${account.role}`)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={account.active ? "info" : "neutral"}
                        >
                          {account.active ? t("active") : t("inactive")}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(account.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AccountActiveToggle account={account} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
