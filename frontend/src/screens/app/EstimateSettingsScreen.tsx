import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EstimateSettings">;

export default function EstimateSettingsScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate("EditEstimateOptions")}
        activeOpacity={0.7}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>Edit Estimate Options</Text>
          <Text style={styles.rowSubtitle}>Configure which fields appear when editing estimates</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 16 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  rowSubtitle: { fontSize: 13, color: "#6b7280" },
  chevron: { fontSize: 22, color: "#d1d5db" },
});
