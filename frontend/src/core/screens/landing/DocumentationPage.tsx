/**
 * DocumentationPage — main documentation hub with app flow overview
 * and links to individual utility docs.
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

export type DocSubPage =
  | "overview"
  | "contacts"
  | "estimates"
  | "invoices"
  | "notes"
  | "time_tracking"
  | "photos"
  | "pdf"
  | "saved_items"
  | "ai_assistant";

interface Props {
  onBack: () => void;
  onNavigateToDoc: (page: DocSubPage) => void;
}

const UTILITY_DOCS: { id: DocSubPage; icon: string; title: string; description: string }[] = [
  { id: "contacts", icon: "👤", title: "Contacts", description: "Manage client contacts for job sites and jobs" },
  { id: "estimates", icon: "📝", title: "Estimates", description: "Create detailed, itemized project estimates" },
  { id: "invoices", icon: "💵", title: "Invoices", description: "Invoice management with status tracking" },
  { id: "notes", icon: "📓", title: "Notes", description: "Markdown notes attached to jobs" },
  { id: "time_tracking", icon: "⏱", title: "Time Tracking", description: "Clock in/out and manual hour logging" },
  { id: "photos", icon: "📷", title: "Photos", description: "Job photos and document attachments" },
  { id: "pdf", icon: "📄", title: "PDF Generation", description: "Professional PDF documents for clients" },
  { id: "saved_items", icon: "📚", title: "Item Library", description: "Reusable templates for line items and materials" },
  { id: "ai_assistant", icon: "🤖", title: "AI Assistant", description: "In-app AI that helps you manage your work" },
];

export default function DocumentationPage({ onBack, onNavigateToDoc }: Props) {
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
            Documentation
          </Text>
          <Text style={styles.heroSubtitle}>
            Learn how JobSyte works and how to get the most out of every
            feature.
          </Text>
        </View>

        {/* App Flow Overview */}
        <View style={[styles.section, isWide && styles.sectionWide]}>
          <Text style={styles.sectionTitle}>How JobSyte Works</Text>
          <Text style={styles.paragraph}>
            JobSyte is organized around a simple hierarchy that mirrors how
            contractors actually work:
          </Text>

          <View style={styles.flowContainer}>
            <FlowStep
              number="1"
              title="Create a Job Site"
              description="A job site represents a physical location — a client's home, a commercial property, or any address where work happens. This is the top-level container for all your projects."
            />
            <View style={styles.flowArrow}>
              <Text style={styles.flowArrowText}>↓</Text>
            </View>
            <FlowStep
              number="2"
              title="Add Jobs"
              description="Within a job site, create individual jobs for each project or scope of work. Jobs track status (Pending, In Progress, Completed) and contain all related data."
            />
            <View style={styles.flowArrow}>
              <Text style={styles.flowArrowText}>↓</Text>
            </View>
            <FlowStep
              number="3"
              title="Work the Job"
              description="For each job, you can create estimates, track time, take photos, write notes, manage contacts, and more. Everything lives under the job it belongs to."
            />
            <View style={styles.flowArrow}>
              <Text style={styles.flowArrowText}>↓</Text>
            </View>
            <FlowStep
              number="4"
              title="Estimate → Invoice → Get Paid"
              description="Create an estimate, present it to your client. Once approved, convert it to an invoice with one tap. Track the invoice through to payment."
            />
          </View>
        </View>

        {/* Key Concepts */}
        <View style={[styles.section, isWide && styles.sectionWide, styles.sectionAlt]}>
          <Text style={styles.sectionTitle}>Key Concepts</Text>

          <View style={styles.conceptList}>
            <ConceptItem
              title="Multi-Tenant"
              description="Each business gets their own isolated environment with a unique subdomain. Your data is completely separate from other businesses."
            />
            <ConceptItem
              title="Team Access"
              description="Invite team members to your organization. Once approved by an admin, all team members see the same job sites, estimates, and invoices — no data silos."
            />
            <ConceptItem
              title="Line Items & Entries"
              description="Estimates and invoices use a two-level structure: Line Items (named groups like 'Bathroom Renovation') contain Entries (individual materials, labor hours, or fees)."
            />
            <ConceptItem
              title="Modular Utilities"
              description="Each feature (contacts, estimates, invoices, etc.) is a toggleable utility. Tenants only see the features they need — no clutter."
            />
          </View>
        </View>

        {/* Utility Documentation Links */}
        <View style={[styles.section, isWide && styles.sectionWide]}>
          <Text style={styles.sectionTitle}>Feature Documentation</Text>
          <Text style={styles.paragraph}>
            Tap on any feature below to learn more about how it works and how to
            use it.
          </Text>

          <View style={[styles.docGrid, isWide && styles.docGridWide]}>
            {UTILITY_DOCS.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, !isWide && styles.docCardMobile]}
                onPress={() => onNavigateToDoc(doc.id)}
                activeOpacity={0.7}
              >
                <View style={styles.docCardIconWrap}>
                  <Text style={styles.docCardIcon}>{doc.icon}</Text>
                </View>
                <Text style={styles.docCardTitle}>{doc.title}</Text>
                <Text style={styles.docCardDescription}>{doc.description}</Text>
                <Text style={styles.docCardArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Need help? Reach out at cameron.legg@gmail.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.flowStep}>
      <View style={styles.flowStepNumber}>
        <Text style={styles.flowStepNumberText}>{number}</Text>
      </View>
      <View style={styles.flowStepContent}>
        <Text style={styles.flowStepTitle}>{title}</Text>
        <Text style={styles.flowStepDescription}>{description}</Text>
      </View>
    </View>
  );
}

function ConceptItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.conceptItem}>
      <Text style={styles.conceptTitle}>{title}</Text>
      <Text style={styles.conceptDescription}>{description}</Text>
    </View>
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
    maxWidth: 900,
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

  // Flow diagram
  flowContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  flowStep: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    width: "100%",
    maxWidth: 600,
  },
  flowStepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  flowStepNumberText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  flowStepContent: {
    flex: 1,
  },
  flowStepTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  flowStepDescription: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 21,
  },
  flowArrow: {
    paddingVertical: 8,
  },
  flowArrowText: {
    fontSize: 24,
    color: BRAND_COLORS.accent,
    fontWeight: "700",
  },

  // Concepts
  conceptList: {
    gap: 14,
  },
  conceptItem: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#334155",
  },
  conceptTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: BRAND_COLORS.accent,
    marginBottom: 4,
  },
  conceptDescription: {
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 23,
  },

  // Doc grid
  docGrid: {
    gap: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  docGridWide: {
    gap: 18,
  },
  docCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    minWidth: 260,
    flex: 1,
    position: "relative",
  },
  docCardMobile: {
    minWidth: "100%" as any,
    flex: 0,
    flexBasis: "100%",
  },
  docCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(252, 126, 31, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  docCardIcon: {
    fontSize: 20,
  },
  docCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  docCardDescription: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  docCardArrow: {
    position: "absolute",
    top: 20,
    right: 20,
    fontSize: 18,
    color: BRAND_COLORS.accent,
    fontWeight: "700",
  },

  // Footer
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
