/**
 * UpdateBanner — prompts the user to reload when a newer build is deployed.
 *
 * Mounted once at the app root. Runs useVersionCheck (which flags the version
 * store on focus if the deployed /version.json differs from this bundle), and
 * shows a small non-blocking banner with a Reload action.
 *
 * Web-only surface: reloading fetches the fresh index.html (served no-cache)
 * and its new hashed bundles. On native there is no page to reload — app
 * updates ship through the store / OTA — so the banner renders nothing.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";

import { useVersionCheck } from "../hooks/useVersionCheck";
import { useVersionStore } from "../store/versionStore";
import { BRAND_COLORS } from "../config/app";

export default function UpdateBanner() {
  // Always run the check hook (it no-ops in dev / on native focus as needed).
  useVersionCheck();

  const updateAvailable = useVersionStore((s) => s.updateAvailable);

  if (Platform.OS !== "web") return null;
  if (!updateAvailable) return null;

  function reload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>A new version of {`\u2060`}the app is available.</Text>
        <TouchableOpacity style={styles.button} onPress={reload}>
          <Text style={styles.buttonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10000,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    width: "100%",
    maxWidth: 560,
    backgroundColor: BRAND_COLORS.dark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  button: {
    backgroundColor: BRAND_COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
