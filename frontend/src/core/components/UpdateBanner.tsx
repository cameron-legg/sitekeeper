/**
 * UpdateBanner — prompts the user to reload when a newer build is deployed.
 *
 * Mounted once at the app root. Runs useVersionCheck (which flags the version
 * store on focus if the deployed /version.json differs from this bundle), then
 * shows a prominent, centered modal over a dimmed backdrop to strongly steer
 * users onto the latest build (we want to minimize people on stale versions).
 *
 * A low-key "Not now" lets someone mid-task defer, but the prompt re-appears on
 * the next focus/visibility check, so it stays hard to ignore without trapping
 * anyone. The primary action is a large Reload button.
 *
 * Web-only surface: reloading fetches the fresh index.html (served no-cache)
 * and its new hashed bundles. On native there is no page to reload — app
 * updates ship through the store / OTA — so this renders nothing.
 */

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";

import { useVersionCheck } from "../hooks/useVersionCheck";
import { useVersionStore } from "../store/versionStore";
import { BRAND_COLORS } from "../config/app";

export default function UpdateBanner() {
  // Always run the check hook (it no-ops in dev / on native focus as needed).
  useVersionCheck();

  const updateAvailable = useVersionStore((s) => s.updateAvailable);
  const latestVersion = useVersionStore((s) => s.latestVersion);
  // Local per-session dismiss. Cleared whenever a new version is detected
  // again on focus (the store re-sets updateAvailable), so deferring only
  // hides it until the next focus check.
  const [dismissed, setDismissed] = useState(false);

  // Re-show whenever a newer version id comes in.
  React.useEffect(() => {
    setDismissed(false);
  }, [latestVersion]);

  if (Platform.OS !== "web") return null;
  if (!updateAvailable || dismissed) return null;

  function reload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.emoji}>{"\u2728"}</Text>
        <Text style={styles.title}>Update available</Text>
        <Text style={styles.body}>
          A new version of the app is ready. Reload now to get the latest
          features and fixes — it only takes a second.
        </Text>

        <TouchableOpacity style={styles.reloadBtn} onPress={reload} activeOpacity={0.85}>
          <Text style={styles.reloadText}>Reload now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.laterBtn} onPress={() => setDismissed(true)}>
          <Text style={styles.laterText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 10000,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  emoji: { fontSize: 34, marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: BRAND_COLORS.dark,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
    marginBottom: 24,
  },
  reloadBtn: {
    backgroundColor: BRAND_COLORS.accent,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  reloadText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  laterBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
});
