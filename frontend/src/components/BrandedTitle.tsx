/**
 * BrandedTitle — renders "JobSyte" with two-tone styling matching the logo.
 *
 * "Job" is displayed in dark navy, "Syte" in the brand orange.
 * Accepts a `fontSize` prop to control size across different contexts
 * (header, hero, auth screens, etc.).
 */

import React from "react";
import { Text, type TextStyle } from "react-native";
import { BRAND_COLORS } from "../core/config/app";

interface BrandedTitleProps {
  /** Font size — defaults to 22 (header size) */
  fontSize?: number;
  /** Font weight — defaults to "800" */
  fontWeight?: TextStyle["fontWeight"];
  /** Optional style override for the outer Text wrapper */
  style?: TextStyle;
}

export default function BrandedTitle({
  fontSize = 22,
  fontWeight = "800",
  style,
}: BrandedTitleProps) {
  return (
    <Text style={[{ fontSize, fontWeight }, style]} accessibilityRole="header">
      <Text style={{ color: BRAND_COLORS.dark }}>Job</Text>
      <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
    </Text>
  );
}
