import { useState } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart-provider";
import { useColors } from "@/hooks/use-colors";

/**
 * Website header for web platform only.
 * Responsive: full nav on desktop (>640px), hamburger menu on mobile.
 */
export function WebHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { cart, getItemCount } = useCart();
  const colors = useColors();
  const cartCount = getItemCount();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);

  if (Platform.OS !== "web") return null;

  // Don't show on admin, store-dashboard, driver, or POS pages
  const hiddenPaths = ["/admin", "/store-dashboard", "/driver", "/pos-printer"];
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null;

  const isMobile = width < 640;

  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path as any);
  };

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        {/* Left: Empty spacer for balance (logo removed to avoid duplication with hero) */}
        <View style={styles.logoArea} />

        {/* Right side */}
        {isMobile ? (
          /* Mobile: Cart + Hamburger */
          <View style={styles.mobileRight}>
            {/* Cart icon */}
            {cartCount > 0 && cart.storeId && (
              <TouchableOpacity
                onPress={() => navigateTo(`/cart/${cart.storeId}`)}
                style={styles.cartButton}
              >
                <Text style={styles.cartIcon}>🛒</Text>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              </TouchableOpacity>
            )}
            {/* Hamburger */}
            <TouchableOpacity
              onPress={() => setMenuOpen(!menuOpen)}
              style={styles.hamburger}
            >
              <Text style={styles.hamburgerIcon}>{menuOpen ? "✕" : "☰"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Desktop: Full nav */
          <View style={styles.desktopRight}>
            <TouchableOpacity onPress={() => navigateTo("/")} style={styles.navLink}>
              <Text style={styles.navText}>Home</Text>
            </TouchableOpacity>

            {user && (
              <TouchableOpacity onPress={() => navigateTo("/orders")} style={styles.navLink}>
                <Text style={styles.navText}>My Orders</Text>
              </TouchableOpacity>
            )}

            {cartCount > 0 && cart.storeId && (
              <TouchableOpacity
                onPress={() => navigateTo(`/cart/${cart.storeId}`)}
                style={styles.cartButton}
              >
                <Text style={styles.cartIcon}>🛒</Text>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              </TouchableOpacity>
            )}

            {user ? (
              <TouchableOpacity onPress={() => navigateTo("/profile")} style={styles.profileButton}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user.name?.split(" ")[0] || "Account"}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => navigateTo("/auth/login")} style={styles.loginButton}>
                  <Text style={styles.loginButtonText}>Log In</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigateTo("/auth/register")} style={styles.signupButton}>
                  <Text style={styles.signupButtonText}>Sign Up</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <View style={styles.mobileMenu}>
          <TouchableOpacity onPress={() => navigateTo("/")} style={styles.menuItem}>
            <Text style={styles.menuItemText}>🏠  Home</Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity onPress={() => navigateTo("/orders")} style={styles.menuItem}>
              <Text style={styles.menuItemText}>📋  My Orders</Text>
            </TouchableOpacity>
          )}

          {user ? (
            <TouchableOpacity onPress={() => navigateTo("/profile")} style={styles.menuItem}>
              <Text style={styles.menuItemText}>👤  My Account</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigateTo("/auth/login")} style={styles.menuItem}>
                <Text style={[styles.menuItemText, { color: "#00E5FF" }]}>🔑  Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo("/auth/register")} style={styles.menuItem}>
                <Text style={[styles.menuItemText, { color: "#00E5FF" }]}>✨  Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#00E5FF",
    letterSpacing: 1,
  },
  // Mobile right side
  mobileRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hamburger: {
    padding: 8,
  },
  hamburgerIcon: {
    fontSize: 24,
    color: "#11181C",
    fontWeight: "700",
  },
  // Mobile dropdown
  mobileMenu: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#11181C",
  },
  // Desktop right side
  desktopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#687076",
  },
  cartButton: {
    position: "relative",
    padding: 6,
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
  profileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#11181C",
    maxWidth: 80,
  },
  loginButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#00E5FF",
  },
  loginButtonText: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "700",
  },
  signupButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#00E5FF",
  },
  signupButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
