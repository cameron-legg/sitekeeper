/**
 * DocPageLayout — shared layout for individual utility documentation pages.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from "react-native";
import { BRAND_COLORS } from "../../../config/app";

interface DocSection {
  title: string;
  content?: string;
  bullets?: string[];
  screenshot?: any; // require() image source
}

interface Props {
  onBack: () => void;
  icon: string;
  title: string;
  subtitle: string;
  sections: DocSection[];
}

export default function DocPageLayout({
  onBack,
  icon,
  title,
  subtitle,
  sections,
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: "#0f172a" }}
        bounces={false}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back to Documentation</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={[styles.hero, !isWide && styles.heroMobile]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          <Text style={[styles.heroTitle, !isWide && styles.heroTitleMobile]}>
            {title}
          </Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>

        {/* Sections */}
        {sections.map((section, index) => (
          <View
            key={index}
            style={[
              styles.section,
              isWide && styles.sectionWide,
              index % 2 === 1 && styles.sectionAlt,
            ]}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content && (
              <Text style={styles.paragraph}>{section.content}</Text>
            )}
            {section.bullets && (
              <View style={styles.bulletList}>
                {section.bullets.map((bullet, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            )}
            {section.screenshot && (
              <View style={styles.screenshotContainer}>
                <Image
                  source={section.screenshot}
                  style={styles.screenshotImage}
                  resizeMode="contain"
                  accessibilityLabel={`${section.title} screenshot`}
                />
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.footerLink}>
              ← Back to Documentation Overview
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    paddingBottom: 0,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  backButtonText: {
    color: BRAND_COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  hero: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: "center",
  },
  heroMobile: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(252, 126, 31, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroTitleMobile: {
    fontSize: 26,
  },
  heroSubtitle: {
    fontSize: 17,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 600,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  sectionWide: {
    paddingHorizontal: 48,
    paddingVertical: 48,
  },
  sectionAlt: {
    backgroundColor: "#1e293b",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 16,
    color: "#cbd5e1",
    lineHeight: 27,
  },
  bulletList: {
    gap: 10,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.accent,
    marginTop: 8,
  },
  bulletText: {
    fontSize: 15,
    color: "#cbd5e1",
    lineHeight: 23,
    flex: 1,
  },
  footer: {
    paddingVertical: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  footerLink: {
    fontSize: 16,
    color: BRAND_COLORS.accent,
    fontWeight: "600",
  },

  // Screenshots
  screenshotContainer: {
    marginTop: 20,
    alignItems: "center",
    backgroundColor: "#0a0f1a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  screenshotImage: {
    width: 280,
    height: 500,
    borderRadius: 12,
  },
});
