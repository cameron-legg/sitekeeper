/**
 * ErrorToast — global error banner.
 *
 * Mounted once at the app root (in App.tsx). Renders whatever is in the
 * errorStore. Most users see a simple message ("Something went wrong. Our
 * team has been notified.") plus a request id. Tenants with debug_errors
 * enabled additionally get the exception type and an expandable stack trace.
 *
 * Simple (non-server) errors auto-dismiss after a few seconds; server errors
 * with debug detail stay until dismissed so the info can be read/copied.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useErrorStore } from "../store/errorStore";

const AUTO_DISMISS_MS = 6000;

export default function ErrorToast() {
  const current = useErrorStore((s) => s.current);
  const clearError = useErrorStore((s) => s.clearError);
  const [expanded, setExpanded] = useState(false);

  const hasDetail = Boolean(current?.detail || current?.stackTrace || current?.type);

  useEffect(() => {
    setExpanded(false);
    if (!current) return;
    // Only auto-dismiss when there's no detail to read.
    if (hasDetail) return;
    const t = setTimeout(() => clearError(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current, hasDetail, clearError]);

  if (!current) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.toast}>
        <View style={styles.row}>
          <View style={styles.messageCol}>
            <Text style={styles.message}>{current.message}</Text>
            {current.requestId ? (
              <Text style={styles.meta}>Reference: {current.requestId}</Text>
            ) : null}
            {current.type ? (
              <Text style={styles.metaStrong}>{current.type}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={clearError} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {hasDetail ? (
          <View style={styles.detailSection}>
            <TouchableOpacity onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.toggle}>
                {expanded ? "Hide details ▲" : "Show details ▼"}
              </Text>
            </TouchableOpacity>
            {expanded ? (
              <ScrollView style={styles.detailScroll} nestedScrollEnabled>
                {current.detail ? (
                  <Text style={styles.detailText}>{current.detail}</Text>
                ) : null}
                {current.stackTrace ? (
                  <Text style={styles.stackText}>{current.stackTrace}</Text>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "web" ? 24 : 40,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  toast: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#7f1d1d",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  messageCol: { flex: 1, paddingRight: 8 },
  message: { color: "#fff", fontSize: 14, fontWeight: "600" },
  meta: { color: "#fecaca", fontSize: 11, marginTop: 4 },
  metaStrong: { color: "#fca5a5", fontSize: 12, marginTop: 4, fontWeight: "700" },
  closeBtn: { padding: 4 },
  closeText: { color: "#fecaca", fontSize: 16, fontWeight: "700" },
  detailSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#991b1b", paddingTop: 8 },
  toggle: { color: "#fecaca", fontSize: 12, fontWeight: "600" },
  detailScroll: { maxHeight: 220, marginTop: 8 },
  detailText: { color: "#fee2e2", fontSize: 12, marginBottom: 8 },
  stackText: {
    color: "#fecaca",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
