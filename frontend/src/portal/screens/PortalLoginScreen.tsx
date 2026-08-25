/**
 * PortalLoginScreen — platform user login.
 */

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { BRAND_COLORS } from "../../core/config/app";
import { usePortalLogin } from "../api/hooks/usePortalAuth";

interface Props {
  onSwitchToSignup: () => void;
  onBack: () => void;
}

export default function PortalLoginScreen({ onSwitchToSignup, onBack }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const login = usePortalLogin();

  function handleSubmit() {
    setError(null);
    login.mutate(
      { email, password },
      {
        onError: (err: any) => {
          const msg = err?.response?.data?.error?.message;
          setError(msg || "Invalid credentials. Please try again.");
        },
      }
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your platform account</Text>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!login.isPending}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          ref={passwordRef}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          editable={!login.isPending}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity
          style={[styles.button, login.isPending && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={login.isPending}
        >
          {login.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitchToSignup} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Don't have an account? <Text style={styles.switchBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.backText}>Back to landing page</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0f172a" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 15, color: "#94a3b8", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 6 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: {
    backgroundColor: BRAND_COLORS.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorBanner: {
    backgroundColor: "#450a0a",
    color: "#fca5a5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  switchLink: { marginTop: 20, alignItems: "center" },
  switchText: { color: "#94a3b8", fontSize: 14 },
  switchBold: { color: BRAND_COLORS.accent, fontWeight: "600" },
  backLink: { marginTop: 12, alignItems: "center" },
  backText: { color: "#64748b", fontSize: 13 },
});
