/**
 * PricingPage — pricing information for JobSyte.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { BRAND_COLORS } from "../../config/app";

interface Props {
  onBack: () => void;
}

export default function PricingPage({ onBack }: Props) {
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={[styles.hero, !isWide && styles.heroMobile]}>
          <Text style={[styles.heroTitle, !isWide && styles.heroTitleMobile]}>
            Pricing
          </Text>
          <Text style={styles.heroSubtitle}>
            We're working on a pricing model that's fair for small businesses.
          </Text>
        </View>

        {/* Content */}
        <View style={[styles.section, isWide && styles.sectionWide]}>
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>🚧</Text>
            <Text style={styles.cardTitle}>Coming Soon</Text>
            <Text style={styles.cardBody}>
              We haven't finalized our pricing model yet — and that's
              intentional. We're taking the time to find a pricing structure
              that's fair and accessible for small businesses and independent
              contractors.
            </Text>
            <Text style={styles.cardBody}>
              Our goal isn't to squeeze every dollar out of our users. We want
              to find a price point that allows small businesses to continue to
              prosper while using professional tools that make their work easier
              and more efficient.
            </Text>
          </View>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <Text style={styles.sectionTitle}>What We're Considering</Text>

          <View style={styles.principleList}>
            <View style={styles.principleItem}>
              <View style={styles.principleIconWrap}>
                <Text style={styles.principleIcon}>💰</Text>
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleTitle}>
                  Affordable for Solo Operators
                </Text>
                <Text style={styles.principleDescription}>
                  A one-person operation shouldn't pay the same as a 50-person
                  company. We're exploring pricing that scales with your
                  business.
                </Text>
              </View>
            </View>

            <View style={styles.principleItem}>
              <View style={styles.principleIconWrap}>
                <Text style={styles.principleIcon}>🎯</Text>
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleTitle}>No Hidden Fees</Text>
                <Text style={styles.principleDescription}>
                  No per-invoice charges, no per-PDF fees, no surprise costs.
                  You should know exactly what you're paying for.
                </Text>
              </View>
            </View>

            <View style={styles.principleItem}>
              <View style={styles.principleIconWrap}>
                <Text style={styles.principleIcon}>🤝</Text>
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleTitle}>Value-Driven</Text>
                <Text style={styles.principleDescription}>
                  If JobSyte saves you time, reduces mistakes, and helps you
                  look more professional to clients — that's the value we want
                  to deliver at a fair price.
                </Text>
              </View>
            </View>

            <View style={styles.principleItem}>
              <View style={styles.principleIconWrap}>
                <Text style={styles.principleIcon}>🆓</Text>
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleTitle}>Free Tier Possible</Text>
                <Text style={styles.principleDescription}>
                  We're exploring whether a free tier makes sense — something
                  that lets you try the full experience before committing.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide, styles.sectionAlt]}>
          <Text style={styles.sectionTitle}>Interested?</Text>
          <Text style={styles.paragraph}>
            If you're a contractor or small business owner and you'd like to be
            notified when we launch pricing (or if you'd like early access),
            reach out to us directly. We'd love to hear what pricing would work
            for your business.
          </Text>
          <Text style={styles.contactText}>
            cameron.legg@gmail.com
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            We'll get this right. Your trust matters to us.
          </Text>
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
    paddingTop: 40,
    paddingBottom: 48,
    alignItems: "center",
  },
  heroMobile: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroTitleMobile: {
    fontSize: 28,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 28,
    maxWidth: 600,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  sectionWide: {
    paddingHorizontal: 48,
    paddingVertical: 56,
  },
  sectionAlt: {
    backgroundColor: "#1e293b",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 18,
  },
  paragraph: {
    fontSize: 16,
    color: "#cbd5e1",
    lineHeight: 27,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  cardEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 16,
    textAlign: "center",
  },
  cardBody: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 12,
    maxWidth: 520,
  },
  principleList: {
    gap: 16,
  },
  principleItem: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  principleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(252, 126, 31, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  principleIcon: {
    fontSize: 22,
  },
  principleContent: {
    flex: 1,
  },
  principleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  principleDescription: {
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 23,
  },
  contactText: {
    fontSize: 18,
    color: BRAND_COLORS.accent,
    fontWeight: "700",
    marginTop: 8,
  },
  footer: {
    paddingVertical: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  footerText: {
    fontSize: 14,
    color: "#64748b",
  },
});
