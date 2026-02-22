import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart-provider";
import { useColors } from "@/hooks/use-colors";

/**
 * Website header for web platform only.
 * Clean, professional layout with logo, navigation, cart, and auth.
 */
export function WebHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { cart, getItemCount } = useCart();
  const colors = useColors();
  const cartCount = getItemCount();

  if (Platform.OS !== "web") return null;

  // Don't show on admin, store-dashboard, driver, or POS pages
  const hiddenPaths = ["/admin", "/store-dashboard", "/driver", "/pos-printer"];
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        {/* Left: Logo + Brand */}
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={styles.logoArea}
        >
          <Image
            source={require("@/assets/images/Weshop4ulogo.jpg")}
            style={styles.logo}
            contentFit="contain"
          />
          <View>
            <Text style={styles.brandName}>WESHOP4U</Text>
            <Text style={styles.tagline}>Your Local Store to Your Door</Text>
          </View>
        </TouchableOpacity>

        {/* Right: Nav + Cart + Auth */}
        <View style={styles.rightSection}>
          {/* Navigation */}
          <TouchableOpacity
            onPress={() => router.push("/")}
            style={[styles.navLink, isActive("/") && !isActive("/orders") && !isActive("/profile") && styles.navLinkActive]}
          >
            <Text style={[styles.navText, isActive("/") && !isActive("/orders") && !isActive("/profile") && { color: "#00E5FF" }]}>
              Home
            </Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              onPress={() => router.push("/orders")}
              style={[styles.navLink, isActive("/orders") && styles.navLinkActive]}
            >
              <Text style={[styles.navText, isActive("/orders") && { color: "#00E5FF" }]}>
                My Orders
              </Text>
            </TouchableOpacity>
          )}

          {/* Cart */}
          {cartCount > 0 && cart.storeId && (
            <TouchableOpacity
              onPress={() => router.push(`/cart/${cart.storeId}` as any)}
              style={styles.cartButton}
            >
              <Text style={styles.cartIcon}>🛒</Text>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Auth */}
          {user ? (
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              style={styles.profileButton}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {user.name?.split(" ")[0] || "Account"}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => router.push("/auth/login")}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/auth/register")}
                style={styles.signupButton}
              >
                <Text style={styles.signupButtonText}>Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 24,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    zIndex: 100,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  logoArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#00E5FF",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 10,
    color: "#687076",
    marginTop: -1,
    fontWeight: "500",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navLinkActive: {
    backgroundColor: "rgba(0, 229, 255, 0.1)",
  },
  navText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#687076",
  },
  cartButton: {
    position: "relative",
    padding: 6,
    marginLeft: 4,
  },
  cartIcon: {
    fontSize: 22,
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#00E5FF",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(0, 229, 255, 0.08)",
    marginLeft: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 80,
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#00E5FF",
    marginLeft: 4,
  },
  loginButtonText: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "700",
  },
  signupButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#00E5FF",
  },
  signupButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
