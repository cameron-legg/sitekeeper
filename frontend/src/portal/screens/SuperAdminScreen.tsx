/**
 * SuperAdminScreen — system-wide admin panel at /admin.
 *
 * Not linked from anywhere in the UI — accessed by navigating directly to /admin.
 * Shows a login form (username: "superadmin", password from env), then a table
 * with metrics for all tenants.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { BRAND_COLORS } from "../../core/config/app";

// API client for superadmin (uses its own token stored in state)
function getBaseURL(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (Platform.OS !== "web") return envUrl || "http://localhost:5000";
  if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
    return envUrl || "http://localhost:5000";
  }
  return "";
}

interface TenantMetrics {
  slug: string;
  name: string;
  admin_email: string | null;
  employees: number;
  invoices: number;
  estimates: number;
  job_sites: number;
  jobs: number;
  paid_invoice_total: number;
  logins: number;
  db_size_mb: number;
  bucket_size_mb: number;
}

export default function SuperAdminScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const client = axios.create({ baseURL: getBaseURL() });
      const { data } = await client.post<{ token: string }>(
        "/api/v1/superadmin/login",
        payload
      );
      return data.token;
    },
    onSuccess: (t) => {
      setToken(t);
      setLoginError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || "Login failed.";
      setLoginError(msg);
    },
  });

  const tenantsQuery = useQuery<TenantMetrics[]>({
    queryKey: ["superadmin-tenants"],
    queryFn: async () => {
      const client = axios.create({
        baseURL: getBaseURL(),
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await client.get<TenantMetrics[]>("/api/v1/superadmin/tenants");
      return data;
    },
    enabled: false, // Only fetch when user explicitly requests
  });

  const impersonateMutation = useMutation({
    mutationFn: async (slug: string) => {
      const client = axios.create({
        baseURL: getBaseURL(),
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await client.post<{
        token: string;
        user_id: string;
        email: string;
        domain: string;
      }>("/api/v1/superadmin/impersonate", { slug });
      return data;
    },
    onSuccess: (data) => {
      // Redirect to the tenant's domain with the token as a query param
      const protocol = Platform.OS === "web" ? window.location.protocol : "https:";
      const url = `${protocol}//${data.domain}?impersonate=${data.token}`;
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      }
    },
  });

  function handleLogin() {
    setLoginError(null);
    loginMutation.mutate({ username, password });
  }

  function handleFetchMetrics() {
    tenantsQuery.refetch();
  }

  // Login screen
  if (!token) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>System Admin</Text>
          {loginError && <Text style={styles.errorText}>{loginError}</Text>}
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            style={[styles.loginBtn, loginMutation.isPending && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Admin dashboard
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>System Admin Panel</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.fetchBtn, tenantsQuery.isFetching && styles.btnDisabled]}
            onPress={handleFetchMetrics}
            disabled={tenantsQuery.isFetching}
          >
            {tenantsQuery.isFetching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.fetchBtnText}>
                {tenantsQuery.data ? "Refresh" : "Fetch Metrics"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setToken(null)} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!tenantsQuery.data && !tenantsQuery.isFetching && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Click "Fetch Metrics" to load tenant data.
          </Text>
          <Text style={styles.emptySubtext}>
            This queries all tenant databases — may take a few seconds.
          </Text>
        </View>
      )}

      {tenantsQuery.data && (
        <ScrollView horizontal style={styles.tableScroll}>
          <View>
            {/* Table header */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.headerCell, styles.cellName]}>Tenant</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellEmail]}>Admin Email</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Users</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Invoices</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Estimates</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Sites</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Jobs</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellWide]}>Paid Total</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Logins</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>DB (MB)</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellNum]}>Files (MB)</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellAction]}>Action</Text>
            </View>

            {/* Table rows */}
            {tenantsQuery.data.map((t) => (
              <View key={t.slug} style={styles.tableRow}>
                <Text style={[styles.cell, styles.cellName]}>{t.name}</Text>
                <Text style={[styles.cell, styles.cellEmail]}>{t.admin_email || "—"}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.employees}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.invoices}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.estimates}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.job_sites}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.jobs}</Text>
                <Text style={[styles.cell, styles.cellWide]}>
                  ${t.paid_invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.logins}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.db_size_mb}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{t.bucket_size_mb}</Text>
                <View style={[styles.cellAction]}>
                  <TouchableOpacity
                    style={styles.impersonateBtn}
                    onPress={() => impersonateMutation.mutate(t.slug)}
                    disabled={impersonateMutation.isPending}
                  >
                    <Text style={styles.impersonateBtnText}>Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Login
  loginContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loginCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 360,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  loginBtn: {
    backgroundColor: BRAND_COLORS.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  errorText: {
    color: "#fca5a5",
    backgroundColor: "#450a0a",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
    textAlign: "center",
  },

  // Dashboard
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  fetchBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  fetchBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },

  // Empty state
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { color: "#e2e8f0", fontSize: 16, textAlign: "center" },
  emptySubtext: { color: "#64748b", fontSize: 13, marginTop: 8, textAlign: "center" },

  // Table
  tableScroll: { flex: 1, padding: 16 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingVertical: 10,
  },
  cell: { color: "#e2e8f0", fontSize: 13, paddingHorizontal: 8 },
  headerCell: { fontWeight: "700", color: "#94a3b8", fontSize: 11, textTransform: "uppercase" },
  cellName: { width: 140 },
  cellEmail: { width: 200 },
  cellNum: { width: 70, textAlign: "right" },
  cellWide: { width: 110, textAlign: "right" },
  cellAction: { width: 80, alignItems: "center", justifyContent: "center" },
  impersonateBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  impersonateBtnText: { color: "#e2e8f0", fontSize: 11, fontWeight: "600" },
});
