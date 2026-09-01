/**
 * Axios API client with auth and 401 interceptors.
 *
 * - Attaches `Authorization: Bearer <token>` to every request.
 * - On a 401 response, clears the auth store. RootNavigator watches the
 *   token and automatically switches back to AuthStack — no imperative
 *   navigation call needed (which could fire before the navigator is ready).
 */

import axios from "axios";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";
import { showError } from "../store/errorStore";
import { APP_VERSION } from "../config/app";

// Allow callers to opt out of the global error toast for a specific request
// (e.g. when a screen renders the error inline instead).
declare module "axios" {
  export interface AxiosRequestConfig {
    suppressGlobalError?: boolean;
  }
}

// On web in production, use relative URLs so API calls go to the same origin
// (important for multi-tenant subdomains like nocoresources.entouch.org).
// In local development (localhost), use the explicit API URL from the environment.
// On native, always use the explicit API URL.
function getBaseURL(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

  if (Platform.OS !== "web") {
    // Native: always use the env var
    return envUrl || "http://localhost:5000";
  }

  // Web: use relative URLs in production (non-localhost), explicit URL in local dev
  if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
    return envUrl || "http://localhost:5000";
  }

  // Production web: relative URLs so requests go to the same origin
  return "";
}

const apiClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the JWT (and the running build version) to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Tag requests with the running frontend build so backend error logs can
  // record which version produced an error (helps spot stale-tab issues).
  if (APP_VERSION) {
    config.headers["X-App-Version"] = APP_VERSION;
  }
  return config;
});

// Response interceptor:
// - On 401, clear auth — RootNavigator switches to AuthStack automatically.
// - On any other error, surface a global toast via the error store. The
//   backend envelope is {"error": {code, message, request_id?, type?, detail?,
//   stack_trace?}}. Detailed fields are only present for tenants whose
//   debug_errors flag is enabled.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error.response?.status;

    if (status === 401) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    // Requests can opt out of the global toast (e.g. to render an inline
    // form error instead) by setting `suppressGlobalError: true` on the config.
    if (!error.config?.suppressGlobalError) {
      const envelope = error.response?.data?.error;
      if (envelope) {
        showError({
          message: envelope.message || "Something went wrong.",
          code: envelope.code,
          requestId: envelope.request_id,
          type: envelope.type,
          detail: envelope.detail,
          stackTrace: envelope.stack_trace,
          status,
        });
      } else if (error.request && !error.response) {
        // Network error — no response received.
        showError({
          message: "Network error. Please check your connection and try again.",
          code: "NETWORK_ERROR",
        });
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
