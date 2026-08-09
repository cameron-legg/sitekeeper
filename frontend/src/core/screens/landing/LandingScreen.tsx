/**
 * LandingScreen — professional public-facing page for JobSyte.
 *
 * Shown when the app is in landing mode (bare domain in production).
 * Features app screenshots, functionality overview, and tenant login directory.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TextInput,
  Linking,
  Platform,
  Modal,
  useWindowDimensions,
} from "react-native";
import { BRAND_COLORS } from "../../config/app";

// Screenshot assets
const screenshots = {
  home: require("../../../../assets/landing/home-job-sites.png"),
  jobSite: require("../../../../assets/landing/job-site-detail.png"),
  jobDetail: require("../../../../assets/landing/job-detail-notes.png"),
  estimates: require("../../../../assets/landing/estimates-tab.png"),
  estimateEditor: require("../../../../assets/landing/estimate-editor.png"),
  invoices: require("../../../../assets/landing/invoices-tab.png"),
  invoiceManagement: require("../../../../assets/landing/invoice-management.png"),
  contacts: require("../../../../assets/landing/contacts-tab.png"),
};

export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [tenantInput, setTenantInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

  function handleGoToTenant() {
    const slug = tenantInput.trim().toLowerCase().replace(/\s+/g, "");
    if (!slug) {
      setInputError("Please enter your organization name.");
      return;
    }
    setInputError(null);

    // Build the tenant URL using the current domain's base
    let baseHost = "entouch.org";
    let protocol = "https:";
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      protocol = window.location.protocol;
      // Extract the base domain (e.g. "entouch.org" from "entouch.org" or "www.entouch.org")
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        baseHost = parts.slice(-2).join(".");
      } else {
        baseHost = hostname;
      }
    }

    const url = `${protocol}//${slug}.${baseHost}/login`;

    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              <Text style={{ color: "#ffffff" }}>Job</Text>
              <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
            </Text>
            <Text style={styles.heroTagline}>
              The contractor management app that keeps your jobs, estimates, and
              invoices organized — so you can focus on the work.
            </Text>
            <Text style={styles.heroDescription}>
              Built for plumbers, electricians, remodelers, and trades
              professionals who need a simple way to run their business from
              their phone.
            </Text>
            {/* Sign-in CTA opens modal */}
            <TouchableOpacity
              style={styles.heroCta}
              onPress={() => {
                setTenantInput("");
                setInputError(null);
                setShowSignInModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.heroCtaText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Feature: Job Management ──────────────────────────────── */}
        <FeatureSection
          isWide={isWide}
          title="Manage All Your Job Sites"
          description="See every active project at a glance. Track job status, view invoice summaries, and stay on top of what needs your attention today."
          bullets={[
            "Organize jobs by site with status tracking",
            "Filter to active jobs or view your full history",
            "See invoice status summaries per site",
          ]}
          image={screenshots.home}
          imageAlt="Home screen showing job sites"
          reverse={false}
        />

        <FeatureSection
          isWide={isWide}
          title="Detailed Job Tracking"
          description="Each job has everything you need in one place — notes, contacts, estimates, invoices, and photos. Switch between tabs to find what you need instantly."
          bullets={[
            "Status workflow: Pending, In Progress, Completed",
            "Time tracking with clock in/out and manual entry",
            "Markdown notes for detailed job documentation",
          ]}
          image={screenshots.jobDetail}
          imageAlt="Job detail screen with notes"
          reverse={true}
        />

        {/* ─── Feature: Estimates ───────────────────────────────────── */}
        <FeatureSection
          isWide={isWide}
          title="Professional Estimates in Minutes"
          description="Create detailed, itemized estimates with materials, labor hours, and fees. Calculate totals automatically including tax. Deliver to clients or convert directly to an invoice."
          bullets={[
            "Line items with materials, labor hours, and fees",
            "Automatic tax calculation on materials",
            "One-tap conversion from estimate to invoice",
            "Generate professional PDFs to send to clients",
          ]}
          image={screenshots.estimateEditor}
          imageAlt="Estimate editor with line items and totals"
          reverse={false}
        />

        {/* ─── Feature: Invoices ────────────────────────────────────── */}
        <FeatureSection
          isWide={isWide}
          title="Invoice Management & Tracking"
          description="Track every invoice from drafting through payment. See which invoices are waiting to be sent, which are outstanding, and which have been paid — all in one dashboard."
          bullets={[
            "Status workflow: Drafting, Waiting to Send, Sent, Paid",
            "Dashboard view across all jobs and sites",
            "Status history with timestamps",
            "PDF generation for professional delivery",
          ]}
          image={screenshots.invoiceManagement}
          imageAlt="Invoice management dashboard"
          reverse={true}
        />

        {/* ─── Feature: Contacts ────────────────────────────────────── */}
        <FeatureSection
          isWide={isWide}
          title="Client Contacts at Your Fingertips"
          description="Attach contacts to job sites or individual jobs. Set primary contacts so you always know who to call. Contact details are shared across your team."
          bullets={[
            "Contacts linked to sites and jobs",
            "Primary contact designation",
            "Phone, email, mailing address, and notes",
            "Inherited contacts from parent job site",
          ]}
          image={screenshots.contacts}
          imageAlt="Contacts tab on a job"
          reverse={false}
        />

        {/* ─── Additional Features Grid ─────────────────────────────── */}
        <View style={styles.gridSection}>
          <Text style={styles.gridSectionTitle}>Everything Else You Need</Text>
          <Text style={styles.gridSectionSubtitle}>
            Built by contractors, for contractors.
          </Text>
          <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
            <MiniFeatureCard
              icon="🤖"
              title="AI Assistant"
              description="An in-app AI that understands your current screen and can create estimates, notes, contacts, and more through natural conversation."
            />
            <MiniFeatureCard
              icon="📷"
              title="Job Photos"
              description="Upload photos directly to jobs for before/after documentation, progress tracking, and client communication."
            />
            <MiniFeatureCard
              icon="📚"
              title="Item Library"
              description="Save frequently used line items as templates. Reuse them across estimates and invoices to save time on repetitive work."
            />
            <MiniFeatureCard
              icon="⏱"
              title="Time Tracking"
              description="Clock in and out on jobs, add manual time entries, and track labor hours per job for accurate invoicing."
            />
            <MiniFeatureCard
              icon="👥"
              title="Team Access"
              description="Invite team members to your organization. Everyone sees the same job sites, estimates, and invoices — no data silos."
            />
            <MiniFeatureCard
              icon="📄"
              title="PDF Documents"
              description="Generate professional estimate and invoice PDFs with your company branding, customizable fields, and clean formatting."
            />
          </View>
        </View>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            <Text style={{ color: "#ffffff" }}>Job</Text>
            <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
          </Text>
          <Text style={styles.footerText}>
            Contractor management made simple. Built with care for the trades.
          </Text>
          <TouchableOpacity
            style={styles.footerSignInBtn}
            onPress={() => {
              setTenantInput("");
              setInputError(null);
              setShowSignInModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.footerSignInText}>Sign In</Text>
          </TouchableOpacity>
          <Text style={styles.footerContact}>
            Interested in <Text style={{ color: BRAND_COLORS.accent, fontWeight: "600" }}>JobSyte</Text> for your business? Reach out at cameron.legg@gmail.com
          </Text>
        </View>
      </ScrollView>

      {/* ─── Sign In Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showSignInModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign In</Text>
            <Text style={styles.modalSubtitle}>
              Enter your organization name to go to your login page:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. mycompany"
              placeholderTextColor="#94a3b8"
              value={tenantInput}
              onChangeText={(text) => {
                setTenantInput(text);
                setInputError(null);
              }}
              onSubmitEditing={handleGoToTenant}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
            />
            {inputError && (
              <Text style={styles.modalError}>{inputError}</Text>
            )}
            <Text style={styles.modalHint}>
              This will take you to your organization's sign-in page.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSignInModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalGoBtn}
                onPress={handleGoToTenant}
                activeOpacity={0.8}
              >
                <Text style={styles.modalGoText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function FeatureSection({
  isWide,
  title,
  description,
  bullets,
  image,
  imageAlt,
  reverse,
}: {
  isWide: boolean;
  title: string;
  description: string;
  bullets: string[];
  image: any;
  imageAlt: string;
  reverse: boolean;
}) {
  const content = (
    <View style={[styles.featureText, isWide && styles.featureTextWide]}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
      <View style={styles.bulletList}>
        {bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const imageEl = (
    <View style={[styles.featureImageContainer, isWide && styles.featureImageContainerWide]}>
      <Image
        source={image}
        style={styles.featureImage}
        resizeMode="contain"
        accessibilityLabel={imageAlt}
      />
    </View>
  );

  return (
    <View style={[styles.featureRow, isWide && styles.featureRowWide]}>
      {isWide && reverse ? (
        <>
          {imageEl}
          {content}
        </>
      ) : isWide ? (
        <>
          {content}
          {imageEl}
        </>
      ) : (
        <>
          {content}
          {imageEl}
        </>
      )}
    </View>
  );
}

function MiniFeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniCardIcon}>{icon}</Text>
      <Text style={styles.miniCardTitle}>{title}</Text>
      <Text style={styles.miniCardDescription}>{description}</Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {},

  // Hero
  hero: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 56,
    alignItems: "center",
  },
  heroContent: {
    maxWidth: 600,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 16,
    letterSpacing: -1,
  },
  heroTagline: {
    fontSize: 20,
    fontWeight: "500",
    color: "#e2e8f0",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 12,
  },
  heroDescription: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
  },
  heroCta: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  heroCtaText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Feature sections
  featureRow: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  featureRowWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 48,
    paddingHorizontal: 48,
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
  },
  featureText: {
    marginBottom: 24,
  },
  featureTextWide: {
    flex: 1,
    marginBottom: 0,
  },
  featureTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  featureDescription: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 25,
    marginBottom: 16,
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    color: BRAND_COLORS.accent,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  bulletText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
    flex: 1,
  },
  featureImageContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  featureImageContainerWide: {
    flex: 0.6,
    marginTop: 0,
  },
  featureImage: {
    width: 260,
    height: 520,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  // Additional features grid
  gridSection: {
    paddingHorizontal: 24,
    paddingVertical: 56,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  gridSectionTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  gridSectionSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 32,
    textAlign: "center",
  },
  featureGrid: {
    gap: 16,
    maxWidth: 1000,
    width: "100%",
  },
  featureGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  miniCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 280,
    flex: 1,
  },
  miniCardIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  miniCardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 6,
  },
  miniCardDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
  },

  // Footer
  footer: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  footerText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 16,
  },
  footerSignInBtn: {
    borderWidth: 1,
    borderColor: "#475569",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  footerSignInText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
  },
  footerContact: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },

  // Sign-in modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 28,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  modalError: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalCancelText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  modalGoBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalGoText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
