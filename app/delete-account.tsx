import { Text, View, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { WebHeader } from "@/components/web-header";
import { WebFooter } from "@/components/web-footer";

export default function DeleteAccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const content = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Account Deletion</Text>
      
      <Text style={[styles.cardText, { color: colors.muted }]}>
        To request deletion of your WeShop4U account and associated data, please email{" "}
        <Text style={{ color: colors.primary, fontWeight: "600" }}>info@weshop4u.ie</Text> with the subject line{" "}
        <Text style={{ fontWeight: "600", color: colors.foreground }}>Account Deletion Request</Text>. We will process your request within 30 days.
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What happens next?</Text>
        <Text style={[styles.sectionText, { color: colors.muted }]}>
          Once we receive your request, we will verify your identity and begin the account deletion process. Your personal data will be securely deleted from our systems within 30 days.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What data will be deleted?</Text>
        <Text style={[styles.sectionText, { color: colors.muted }]}>
          We will delete your account information, profile data, addresses, and payment methods. Order history may be retained for legal and accounting purposes as required by law.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Questions?</Text>
        <Text style={[styles.sectionText, { color: colors.muted }]}>
          If you have any questions about the account deletion process, please contact us at{" "}
          <Text style={{ color: colors.primary, fontWeight: "600" }}>info@weshop4u.ie</Text> or call{" "}
          <Text style={{ color: colors.primary, fontWeight: "600" }}>0894 626262</Text>.
        </Text>
      </View>
    </View>
  );

  if (isWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <WebHeader />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.webContainer}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Delete Account</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              We're sorry to see you go. Here's how to request account deletion.
            </Text>
            {content}
          </View>
          <WebFooter />
        </ScrollView>
      </View>
    );
  }

  // Mobile layout
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.foreground, fontSize: 24 }]}>Delete Account</Text>
        {content}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
