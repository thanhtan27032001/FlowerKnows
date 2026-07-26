import { apiClient } from "@/src/lib/api/client";
import type { AccountRole } from "@/src/lib/auth/session";

export type Account = {
  id: string;
  username: string;
  fullName: string;
  role: AccountRole;
  active: boolean;
  createdAt: string;
};

export type CreateAccountInput = {
  username: string;
  password: string;
  fullName: string;
  role: AccountRole;
};

export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
};

export const accountApi = {
  list: () => apiClient.get<Account[]>("/api/accounts"),

  create: (input: CreateAccountInput) =>
    apiClient.post<Account>("/api/accounts", input),

  setActive: (id: string, active: boolean) =>
    apiClient.patch<Account>(`/api/accounts/${id}/active`, { active }),
};
