/**
 * LandingScreen — public-facing page shown when the app is in landing mode.
 *
 * Displays app information and a directory of tenants with login links.
 * Each tenant link navigates the user to their subdomain's login page.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Linking,
  Platform,
} from "react-native";
import type { TenantInfo } from "../../api/types";

interface Props {
  tenants: TenantInfo[];
}

export default function LandingScreen({ tenants }: Props) {
  function handleTenantPress(tenant: TenantInfo) {
    const protocol = Platform.OS === "web" ? window.location.protocol : "https:";
    const url = `${protocol}//${tenant.domain}/login`;

    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>JobSyte</Text>
          <Text style={styles.heroSubtitle}>
            Contractor management made simple. Manage job sites, create
            estimates, track invoices, and keep your team organized — all in
            one place.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You Can Do</Text>
          <View style={styles.featureGrid}>
            <FeatureCard
              title="Job Sites & Jobs"
              description="Organize work by site and track job status from pending to completed."
            />
            <FeatureCard
              title="Estimates & Invoices"
              description="Create detailed estimates with line items, convert to invoices with one tap."
            />
            <FeatureCard
              title="Contacts & Notes"
              description="Keep client contacts and job notes together where your team can find them."
            />
            <FeatureCard
              title="AI Assistant"
              description="Let AI help you create estimates, notes, and manage your workflow."
            />
          </View>
        </View>

        {/* Tenant Directory */}
        {tenants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Log In to Your Account</Text>
            <Text style={styles.sectionDescription}>
              Select your organization to sign in:
            </Text>
            <View style={styles.tenantList}>
              {tenants.map((tenant) => (
                <TouchableOpacity
                  key={tenant.slug}
                  style={styles.tenantCard}
                  onPress={() => handleTenantPress(tenant)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.tenantDomain}>{tenant.domain}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Interested in using JobSyte for your business? Get in touch.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: "#1e40af",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#dbeafe",
    textAlign: "center",
    maxWidth: 500,
    lineHeight: 24,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 16,
  },
  featureGrid: {
    marginTop: 12,
    gap: 12,
  },
  featureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  tenantList: {
    gap: 10,
  },
  tenantCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tenantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  tenantDomain: {
    fontSize: 13,
    color: "#64748b",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
});
