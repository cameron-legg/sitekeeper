/**
 * Portal auth hooks — signup and login for platform users.
 */

import { useMutation } from "@tanstack/react-query";
import apiClient from "../../../core/api/client";
import { usePortalAuthStore } from "../../store/portalAuthStore";

interface PortalAuthPayload {
  email: string;
  password: string;
  name?: string;
}

interface PortalAuthResponse {
  user_id: string;
  token: string;
  name: string | null;
  email: string | null;
}

export function usePortalSignup() {
  const setAuth = usePortalAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: PortalAuthPayload) =>
      apiClient
        .post<PortalAuthResponse>("/api/v1/portal/auth/signup", payload)
        .then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.token, data.user_id, data.name, data.email);
    },
  });
}

export function usePortalLogin() {
  const setAuth = usePortalAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: Omit<PortalAuthPayload, "name">) =>
      apiClient
        .post<PortalAuthResponse>("/api/v1/portal/auth/login", payload)
        .then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.token, data.user_id, data.name, data.email);
    },
  });
}
