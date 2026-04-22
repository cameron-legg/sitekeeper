/**
 * Axios API client with auth and 401 interceptors.
 *
 * - Attaches `Authorization: Bearer <token>` to every request.
 * - On a 401 response, clears the auth store. RootNavigator watches the
 *   token and automatically switches back to AuthStack — no imperative
 *   navigation call needed (which could fire before the navigator is ready).
 */

import axios from "axios";
import { useAuthStore } from "../store/authStore";

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000",
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
