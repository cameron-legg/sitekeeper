/**
 * BrandedTitle — renders "JobSyte" with two-tone styling matching the logo.
 *
 * "Job" is displayed in dark navy, "Syte" in the brand orange.
 * Uses Montserrat Black (900) to match the logo's geometric, blocky,
 * heavy-weight sans-serif with wide proportions and open counters.
 *
 * Accepts a `fontSize` prop to control size across different contexts
 * (header, hero, auth screens, etc.).
 */

import React from "react";
import { Text, type TextStyle } from "react-native";
import { BRAND_COLORS } from "../core/config/app";

/** Font family matching the loaded Montserrat_900Black */
const BRAND_FONT = "Montserrat_900Black";
const BRAND_FONT_LIGHT = "Montserrat_800ExtraBold";

interface BrandedTitleProps {
  /** Font size — defaults to 22 (header size) */
  fontSize?: number;
  /** Optional style override for the outer Text wrapper */
  style?: TextStyle;
  /** Use lighter weight (ExtraBold instead of Black) for smaller contexts */
  light?: boolean;
}

export default function BrandedTitle({
  fontSize = 22,
  style,
  light = false,
}: BrandedTitleProps) {
  const fontFamily = light ? BRAND_FONT_LIGHT : BRAND_FONT;

  return (
    <Text
      style={[{ fontSize, fontFamily, letterSpacing: 0.3 }, style]}
      accessibilityRole="header"
    >
      <Text style={{ color: BRAND_COLORS.dark }}>Job</Text>
      <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
    </Text>
  );
}
