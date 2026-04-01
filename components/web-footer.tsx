import { View, Text, TouchableOpacity, Platform, StyleSheet, Linking } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";

/**
 * Website footer for web platform only.
 * Shows branding, links, and contact info.
 */
export function WebFooter() {
  const router = useRouter();
  const pathname = usePathname();

  if (Platform.OS !== "web") return null;

  // Don't show on admin, store-dashboard, driver, or POS pages
  const hiddenPaths = ["/admin", "/store-dashboard", "/driver", "/pos-printer"];
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null;

  return (
    <View style={styles.footer}>
      <View style={styles.container}>
        {/* Top Section */}
        <View style={styles.topSection}>
          {/* Brand Column */}
          <View style={styles.column}>
            <View style={styles.logoRow}>
              <Image
                source={require("@/assets/images/Weshop4ulogo.jpg")}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.brandName}>WESHOP4U</Text>
            </View>
            <Text style={styles.description}>
              Your local store to your door. Fast express delivery from your favourite stores, 24/7.
            </Text>
          </View>

          {/* Quick Links */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Quick Links</Text>
            <TouchableOpacity onPress={() => router.push("/")}>
              <Text style={styles.link}>Browse Stores</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.link}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={styles.link}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/contact")}>
              <Text style={styles.link}>Contact Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/faq")}>
              <Text style={styles.link}>FAQ</Text>
            </TouchableOpacity>
          </View>

          {/* For Businesses */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>For Businesses</Text>
            <TouchableOpacity onPress={() => router.push("/auth/store-login")}>
              <Text style={styles.link}>Store Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/auth/register-driver")}>
              <Text style={styles.link}>Become a Driver</Text>
            </TouchableOpacity>
          </View>

          {/* Contact */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Contact Us</Text>
            <Text style={styles.contactText}>📞 089-4 626262</Text>
            <Text style={styles.contactText}>📧 weshop4u247@gmail.com</Text>
            <Text style={styles.contactText}>📍 Ireland</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} WeShop4U. All rights reserved.
          </Text>
          <Text style={styles.madeIn}>
            Made with ❤️ in Ireland
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#0A0E27",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  container: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  topSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 40,
    marginBottom: 32,
  },
  column: {
    flex: 1,
    minWidth: 200,
    gap: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#00E5FF",
    letterSpacing: 1,
  },
  description: {
    fontSize: 13,
    color: "#9BA1A6",
    lineHeight: 20,
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ECEDEE",
    marginBottom: 4,
  },
  link: {
    fontSize: 14,
    color: "#9BA1A6",
    paddingVertical: 3,
  },
  contactText: {
    fontSize: 14,
    color: "#9BA1A6",
    paddingVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginBottom: 20,
  },
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  copyright: {
    fontSize: 13,
    color: "#687076",
  },
  madeIn: {
    fontSize: 13,
    color: "#687076",
  },
});
