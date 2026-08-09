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

// Attach the JWT to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth — RootNavigator will switch to AuthStack automatically
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
