/**
 * PortalSignupScreen — platform user registration.
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
import { usePortalSignup } from "../api/hooks/usePortalAuth";

interface Props {
  onSwitchToLogin: () => void;
  onBack: () => void;
}

export default function PortalSignupScreen({ onSwitchToLogin, onBack }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const signup = usePortalSignup();

  function handleSubmit() {
    setError(null);
    signup.mutate(
      { email, password, name: name || undefined },
      {
        onError: (err: any) => {
          const msg = err?.response?.data?.error?.message;
          setError(msg || "Signup failed. Please try again.");
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
        <Text style={styles.title}>Get Started</Text>
        <Text style={styles.subtitle}>Create your platform account</Text>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          editable={!signup.isPending}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          ref={emailRef}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!signup.isPending}
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
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="password"
          editable={!signup.isPending}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity
          style={[styles.button, signup.isPending && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={signup.isPending}
        >
          {signup.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitchToLogin} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchBold}>Sign in</Text>
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
