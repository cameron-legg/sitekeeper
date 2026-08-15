/**
 * AboutUsPage — the story behind JobSyte.
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

export default function AboutUsPage({ onBack }: Props) {
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
            About Us
          </Text>
          <Text style={styles.heroSubtitle}>
            Making professional software accessible to small contractors and
            businesses.
          </Text>
        </View>

        {/* Story */}
        <View style={[styles.section, isWide && styles.sectionWide]}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.paragraph}>
            At JobSyte, we believe that small contractors and local businesses
            deserve access to the same professional, reliable, modern software
            that large companies use — without the large company price tag or
            complexity.
          </Text>
          <Text style={styles.paragraph}>
            Too many hardworking trades professionals are still managing their
            businesses with spreadsheets, paper invoices, and sticky notes. They
            spend hours after a long day on the job just trying to figure out
            what they owe, what they're owed, and what's next. We built JobSyte
            to change that.
          </Text>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide, styles.sectionAlt]}>
          <Text style={styles.sectionTitle}>The Origin Story</Text>
          <Text style={styles.paragraph}>
            JobSyte was originally built by Cameron Legg for his dad, who runs a
            home improvement business. Like many small contractors, he was
            managing everything in spreadsheets — tracking job costs, creating
            invoices, logging hours, and keeping tabs on materials. It worked,
            but it was slow, error-prone, and frustrating.
          </Text>
          <Text style={styles.paragraph}>
            Cameron saw an opportunity to build something better. Something
            purpose-built for the way contractors actually work — on the go,
            from their phone, between job sites. Something that understood the
            flow of a project from estimate to invoice without forcing you
            through a dozen menus.
          </Text>
          <Text style={styles.paragraph}>
            What started as a personal project for one contractor quickly became
            something bigger. Cameron's dad fully transitioned off spreadsheets
            and onto JobSyte for all his estimates, invoices, billing, and cost
            tracking. The feedback was immediate: less time on paperwork, fewer
            mistakes, and a more professional image when dealing with clients.
          </Text>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide]}>
          <Text style={styles.sectionTitle}>What Drives Us</Text>
          <Text style={styles.paragraph}>
            We believe the trades are the backbone of every community. Plumbers,
            electricians, remodelers, landscapers, painters — these are the
            people who keep our homes and businesses running. They deserve
            software that respects their time and makes their work easier, not
            harder.
          </Text>
          <Text style={styles.paragraph}>
            JobSyte is built with care, by people who understand the daily
            realities of running a small contracting business. Every feature we
            add is informed by real feedback from real contractors. No bloat, no
            unnecessary complexity — just the tools you need to run your
            business professionally from your pocket.
          </Text>
        </View>

        <View style={[styles.section, isWide && styles.sectionWide, styles.sectionAlt]}>
          <Text style={styles.sectionTitle}>Our Values</Text>
          <View style={styles.valuesList}>
            <View style={styles.valueItem}>
              <Text style={styles.valueTitle}>Simplicity First</Text>
              <Text style={styles.valueDescription}>
                If a feature takes more than a few taps, we rethink it. Your
                time is valuable.
              </Text>
            </View>
            <View style={styles.valueItem}>
              <Text style={styles.valueTitle}>Built for Mobile</Text>
              <Text style={styles.valueDescription}>
                Designed for the phone in your pocket, not the desktop you never
                sit at.
              </Text>
            </View>
            <View style={styles.valueItem}>
              <Text style={styles.valueTitle}>Fair Pricing</Text>
              <Text style={styles.valueDescription}>
                Small businesses shouldn't need enterprise budgets for quality
                software.
              </Text>
            </View>
            <View style={styles.valueItem}>
              <Text style={styles.valueTitle}>Real Feedback</Text>
              <Text style={styles.valueDescription}>
                Every feature is informed by working contractors. We build what
                you actually need.
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Questions? Reach out at cameron.legg@gmail.com
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
  valuesList: {
    gap: 20,
    marginTop: 8,
  },
  valueItem: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  valueTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: BRAND_COLORS.accent,
    marginBottom: 6,
  },
  valueDescription: {
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 23,
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
