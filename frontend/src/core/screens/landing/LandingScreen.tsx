/**
 * LandingScreen — professional public-facing page for JobSyte.
 *
 * Shown when the app is in landing mode (bare domain in production).
 * Features app screenshots, functionality overview, and tenant login directory.
 * Includes a hamburger menu with About Us, Documentation, and Pricing pages.
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
  Pressable,
} from "react-native";
import { BRAND_COLORS } from "../../config/app";
import AboutUsPage from "./AboutUsPage";
import PricingPage from "./PricingPage";
import DocumentationPage, { type DocSubPage } from "./DocumentationPage";
import {
  ContactsDoc,
  EstimatesDoc,
  InvoicesDoc,
  NotesDoc,
  TimeTrackingDoc,
  PhotosDoc,
  PdfDoc,
  SavedItemsDoc,
  AiAssistantDoc,
} from "./docs";

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

// Brand logo
const logoImage = require("../../../../assets/logo-source.png");

// Page state type
type LandingPage =
  | "home"
  | "about"
  | "pricing"
  | "docs"
  | "doc_contacts"
  | "doc_estimates"
  | "doc_invoices"
  | "doc_notes"
  | "doc_time_tracking"
  | "doc_photos"
  | "doc_pdf"
  | "doc_saved_items"
  | "doc_ai_assistant";

export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMedium = width >= 520 && width < 900;
  const [tenantInput, setTenantInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<LandingPage>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigation helpers
  const navigateTo = (page: LandingPage) => {
    setCurrentPage(page);
    setMenuOpen(false);
  };

  const goHome = () => setCurrentPage("home");

  // Render sub-pages
  if (currentPage === "about") {
    return <AboutUsPage onBack={goHome} />;
  }
  if (currentPage === "pricing") {
    return <PricingPage onBack={goHome} />;
  }
  if (currentPage === "docs") {
    return (
      <DocumentationPage
        onBack={goHome}
        onNavigateToDoc={(page: DocSubPage) =>
          setCurrentPage(`doc_${page}` as LandingPage)
        }
      />
    );
  }
  if (currentPage === "doc_contacts") {
    return <ContactsDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_estimates") {
    return <EstimatesDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_invoices") {
    return <InvoicesDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_notes") {
    return <NotesDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_time_tracking") {
    return <TimeTrackingDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_photos") {
    return <PhotosDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_pdf") {
    return <PdfDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_saved_items") {
    return <SavedItemsDoc onBack={() => setCurrentPage("docs")} />;
  }
  if (currentPage === "doc_ai_assistant") {
    return <AiAssistantDoc onBack={() => setCurrentPage("docs")} />;
  }

  // Responsive screenshot size
  const screenshotWidth = isWide ? 340 : isMedium ? 280 : 240;
  const screenshotHeight = screenshotWidth * 2;

  function handleGoToTenant() {
    const slug = tenantInput.trim().toLowerCase().replace(/\s+/g, "");
    if (!slug) {
      setInputError("Please enter your organization name.");
      return;
    }
    setInputError(null);

    let baseHost = "entouch.org";
    let protocol = "https:";
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      protocol = window.location.protocol;
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

  const openSignIn = () => {
    setTenantInput("");
    setInputError(null);
    setShowSignInModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: "#0f172a" }}
        bounces={false}
        overScrollMode="never"
      >
        {/* ─── Navigation Bar ───────────────────────────────────────── */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={goHome} activeOpacity={0.7}>
            <Text style={styles.navBrand}>
              <Text style={{ color: "#ffffff" }}>Job</Text>
              <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop nav links */}
          {isWide ? (
            <View style={styles.navLinks}>
              <TouchableOpacity onPress={() => navigateTo("about")}>
                <Text style={styles.navLinkText}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo("docs")}>
                <Text style={styles.navLinkText}>Documentation</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo("pricing")}>
                <Text style={styles.navLinkText}>Pricing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navSignInBtn}
                onPress={openSignIn}
              >
                <Text style={styles.navSignInText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Hamburger button for mobile/tablet */
            <TouchableOpacity
              style={styles.hamburgerBtn}
              onPress={() => setMenuOpen(true)}
              activeOpacity={0.7}
            >
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <View style={[styles.hero, !isWide && !isMedium && styles.heroMobile]}>
          <View style={styles.heroContent}>
            <View style={styles.logoContainer}>
              <Image
                source={logoImage}
                style={[styles.heroLogo, !isWide && !isMedium && styles.heroLogoMobile]}
                resizeMode="contain"
                accessibilityLabel="JobSyte logo"
              />
            </View>
            <Text style={[styles.heroTagline, !isWide && !isMedium && styles.heroTaglineMobile]}>
              The contractor management app that keeps your jobs, estimates, and
              invoices organized — so you can focus on the work.
            </Text>
            <Text style={[styles.heroDescription, !isWide && !isMedium && styles.heroDescriptionMobile]}>
              Built for plumbers, electricians, remodelers, and trades
              professionals who need a simple way to run their business from
              their phone.
            </Text>
            <TouchableOpacity
              style={styles.heroCta}
              onPress={openSignIn}
              activeOpacity={0.75}
            >
              <Text style={styles.heroCtaText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Feature Sections ─────────────────────────────────────── */}
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
          screenshotWidth={screenshotWidth}
          screenshotHeight={screenshotHeight}
          dark={false}
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
          screenshotWidth={screenshotWidth}
          screenshotHeight={screenshotHeight}
          dark={true}
        />

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
          screenshotWidth={screenshotWidth}
          screenshotHeight={screenshotHeight}
          dark={false}
        />

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
          screenshotWidth={screenshotWidth}
          screenshotHeight={screenshotHeight}
          dark={true}
        />

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
          screenshotWidth={screenshotWidth}
          screenshotHeight={screenshotHeight}
          dark={false}
        />

        {/* ─── Additional Features Grid ─────────────────────────────── */}
        <View style={[styles.gridSection, !isWide && !isMedium && styles.gridSectionMobile]}>
          <Text style={[styles.gridSectionTitle, !isWide && !isMedium && styles.gridSectionTitleMobile]}>
            Everything Else You Need
          </Text>
          <Text style={styles.gridSectionSubtitle}>
            Built by contractors, for contractors.
          </Text>
          <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
            <MiniFeatureCard
              icon="🤖"
              title="AI Assistant"
              description="An in-app AI that understands your current screen and can create estimates, notes, contacts, and more through natural conversation."
              isWide={isWide}
            />
            <MiniFeatureCard
              icon="📷"
              title="Job Photos"
              description="Upload photos directly to jobs for before/after documentation, progress tracking, and client communication."
              isWide={isWide}
            />
            <MiniFeatureCard
              icon="📚"
              title="Item Library"
              description="Save frequently used line items as templates. Reuse them across estimates and invoices to save time on repetitive work."
              isWide={isWide}
            />
            <MiniFeatureCard
              icon="⏱"
              title="Time Tracking"
              description="Clock in and out on jobs, add manual time entries, and track labor hours per job for accurate invoicing."
              isWide={isWide}
            />
            <MiniFeatureCard
              icon="👥"
              title="Team Access"
              description="Invite team members to your organization. Everyone sees the same job sites, estimates, and invoices — no data silos."
              isWide={isWide}
            />
            <MiniFeatureCard
              icon="📄"
              title="PDF Documents"
              description="Generate professional estimate and invoice PDFs with your company branding, customizable fields, and clean formatting."
              isWide={isWide}
            />
          </View>
        </View>

        {/* ─── CTA Banner ───────────────────────────────────────────── */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaBannerTitle}>Ready to simplify your business?</Text>
          <TouchableOpacity
            style={styles.ctaBannerBtn}
            onPress={openSignIn}
            activeOpacity={0.75}
          >
            <Text style={styles.ctaBannerBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <View style={[styles.footer, !isWide && !isMedium && styles.footerMobile]}>
          <Text style={styles.footerBrand}>
            <Text style={{ color: "#ffffff" }}>Job</Text>
            <Text style={{ color: BRAND_COLORS.accent }}>Syte</Text>
          </Text>
          <Text style={styles.footerText}>
            Contractor management made simple. Built with care for the trades.
          </Text>
          <Text style={styles.footerContact}>
            Interested in{" "}
            <Text style={{ color: BRAND_COLORS.accent, fontWeight: "600" }}>
              JobSyte
            </Text>{" "}
            for your business? Reach out at cameron.legg@gmail.com
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

      {/* ─── Mobile Menu Modal ──────────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuPanel}>
            <TouchableOpacity
              style={styles.menuCloseBtn}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.menuCloseText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigateTo("about")}
            >
              <Text style={styles.menuItemText}>About Us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigateTo("docs")}
            >
              <Text style={styles.menuItemText}>Documentation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigateTo("pricing")}
            >
              <Text style={styles.menuItemText}>Pricing</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuSignInBtn}
              onPress={() => {
                setMenuOpen(false);
                openSignIn();
              }}
            >
              <Text style={styles.menuSignInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
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
  screenshotWidth,
  screenshotHeight,
  dark,
}: {
  isWide: boolean;
  title: string;
  description: string;
  bullets: string[];
  image: any;
  imageAlt: string;
  reverse: boolean;
  screenshotWidth: number;
  screenshotHeight: number;
  dark: boolean;
}) {
  const bgColor = dark ? "#f8fafc" : "#ffffff";
  const titleColor = dark ? "#0f172a" : "#1a2530";
  const descColor = dark ? "#475569" : "#4b5563";
  const bulletTextColor = dark ? "#334155" : "#374151";

  const content = (
    <View style={[styles.featureText, isWide && styles.featureTextWide]}>
      <Text style={[styles.featureTitle, { color: titleColor }, !isWide && styles.featureTitleMobile]}>
        {title}
      </Text>
      <Text style={[styles.featureDescription, { color: descColor }]}>{description}</Text>
      <View style={styles.bulletList}>
        {bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletDotWrapper}>
              <View style={styles.bulletDotCircle} />
            </View>
            <Text style={[styles.bulletText, { color: bulletTextColor }]}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const imageEl = (
    <View
      style={[
        styles.featureImageContainer,
        isWide && styles.featureImageContainerWide,
      ]}
    >
      <View style={styles.screenshotShadow}>
        <Image
          source={image}
          style={{
            width: screenshotWidth,
            height: screenshotHeight,
            borderRadius: 20,
          }}
          resizeMode="contain"
          accessibilityLabel={imageAlt}
        />
      </View>
    </View>
  );

  if (!isWide) {
    return (
      <View style={[styles.featureRowMobile, { backgroundColor: bgColor }]}>
        {imageEl}
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.featureRowWide, { backgroundColor: bgColor }]}>
      {reverse ? (
        <>
          {imageEl}
          {content}
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
  isWide,
}: {
  icon: string;
  title: string;
  description: string;
  isWide: boolean;
}) {
  return (
    <View style={[styles.miniCard, !isWide && styles.miniCardMobile]}>
      <View style={styles.miniCardIconWrapper}>
        <Text style={styles.miniCardIcon}>{icon}</Text>
      </View>
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
  scrollContent: {
    paddingBottom: 0,
    backgroundColor: "#0f172a",
  },

  // ─── Navigation Bar ──────────────────────────────────────────────────────
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  navBrand: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  navLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  navLinkText: {
    fontSize: 15,
    color: "#e2e8f0",
    fontWeight: "500",
  },
  navSignInBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navSignInText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  hamburgerLine: {
    width: 22,
    height: 2.5,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
  },

  // ─── Mobile Menu ─────────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuPanel: {
    backgroundColor: "#1e293b",
    width: 260,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 16,
    marginTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  menuCloseBtn: {
    alignSelf: "flex-end",
    paddingBottom: 16,
  },
  menuCloseText: {
    fontSize: 22,
    color: "#94a3b8",
    fontWeight: "600",
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  menuItemText: {
    fontSize: 17,
    color: "#f1f5f9",
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 8,
  },
  menuSignInBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  menuSignInText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── Hero ────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 64,
    alignItems: "center",
  },
  heroMobile: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 44,
  },
  heroContent: {
    maxWidth: 640,
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 28,
  },
  heroLogo: {
    width: 160,
    height: 160,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },
  heroLogoMobile: {
    width: 130,
    height: 130,
    borderRadius: 26,
  },
  heroTagline: {
    fontSize: 22,
    fontWeight: "600",
    color: "#f1f5f9",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 14,
  },
  heroTaglineMobile: {
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 25,
    marginBottom: 32,
    maxWidth: 500,
  },
  heroDescriptionMobile: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
  },
  heroCta: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 10,
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroCtaText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ─── Feature Sections ────────────────────────────────────────────────────
  featureRowMobile: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: "center",
  },
  featureRowWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 56,
    paddingHorizontal: 56,
    paddingVertical: 64,
    maxWidth: 1140,
    alignSelf: "center",
    width: "100%",
  },
  featureText: {
    marginTop: 24,
  },
  featureTextWide: {
    flex: 1,
    marginTop: 0,
  },
  featureTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  featureTitleMobile: {
    fontSize: 22,
    marginBottom: 10,
    textAlign: "center",
  },
  featureDescription: {
    fontSize: 16,
    color: "#475569",
    lineHeight: 26,
    marginBottom: 18,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDotWrapper: {
    paddingTop: 6,
  },
  bulletDotCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.accent,
  },
  bulletText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 23,
    flex: 1,
  },
  featureImageContainer: {
    alignItems: "center",
  },
  featureImageContainerWide: {
    flex: 0.55,
  },
  screenshotShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderRadius: 20,
  },

  // ─── Grid Section ────────────────────────────────────────────────────────
  gridSection: {
    paddingHorizontal: 32,
    paddingVertical: 64,
    backgroundColor: "#0f172a",
    alignItems: "center",
  },
  gridSectionMobile: {
    paddingHorizontal: 16,
    paddingVertical: 44,
  },
  gridSectionTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  gridSectionTitleMobile: {
    fontSize: 24,
  },
  gridSectionSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 36,
    textAlign: "center",
  },
  featureGrid: {
    gap: 14,
    maxWidth: 1000,
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  featureGridWide: {
    gap: 20,
  },
  miniCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: "#334155",
    minWidth: 280,
    flex: 1,
  },
  miniCardMobile: {
    minWidth: "100%" as any,
    padding: 18,
    flex: 0,
    flexBasis: "100%",
  },
  miniCardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(252, 126, 31, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  miniCardIcon: {
    fontSize: 22,
  },
  miniCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 6,
  },
  miniCardDescription: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 21,
  },

  // ─── CTA Banner ──────────────────────────────────────────────────────────
  ctaBanner: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: "center",
  },
  ctaBannerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  ctaBannerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 24,
    textAlign: "center",
  },
  ctaBannerBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaBannerBtnText: {
    color: BRAND_COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── Footer ──────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  footerMobile: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  footerBrand: {
    fontSize: 24,
    fontFamily: "Montserrat_900Black",
    color: "#ffffff",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  footerText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
    maxWidth: 400,
  },
  footerContact: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },

  // ─── Sign-in Modal ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInput: {
    height: 50,
    borderWidth: 1.5,
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
    fontSize: 13,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  modalCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalCancelText: {
    fontSize: 15,
    color: "#475569",
    fontWeight: "500",
  },
  modalGoBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  modalGoText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
