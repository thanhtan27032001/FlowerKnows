import { apiClient } from "@/src/lib/api/client";
import type { AccountRole } from "@/src/lib/auth/session";

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  username: string;
  role: AccountRole;
  fullName: string;
};

export const authApi = {
  login: (input: LoginInput) =>
    apiClient.post<LoginResponse>("/api/auth/login", input),
};
