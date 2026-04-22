/**
 * Auth mutation hooks — register and login.
 *
 * After a successful auth call we only update the Zustand store.
 * RootNavigator watches the token and automatically switches from
 * AuthStack → AppStack, so no imperative navigation.reset() is needed
 * (and calling it would fail because "Home" doesn't exist in AuthStack).
 */

import { useMutation } from "@tanstack/react-query";
import apiClient from "../client";
import { useAuthStore } from "../../store/authStore";

interface AuthPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  user_id: string;
  token: string;
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: AuthPayload) =>
      apiClient
        .post<AuthResponse>("/api/v1/auth/register", payload)
        .then((r) => r.data),
    onSuccess: (data) => {
      // Setting the token causes RootNavigator to re-render and mount AppStack.
      setAuth(data.token, data.user_id);
    },
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: AuthPayload) =>
      apiClient
        .post<AuthResponse>("/api/v1/auth/login", payload)
        .then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.token, data.user_id);
    },
  });
}
