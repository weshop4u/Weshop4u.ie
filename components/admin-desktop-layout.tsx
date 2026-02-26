import { View, Text, TouchableOpacity, Platform, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface AdminDesktopLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const NAV_ITEMS = [
  { path: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { path: "/admin/orders", label: "All Orders", icon: "📋", exact: false },
  { path: "/admin/phone-order", label: "Phone Order", icon: "📞", exact: false },
  { path: "/admin/manage-stores", label: "Manage Stores", icon: "🏪", exact: false },
  { path: "/admin/products", label: "Products", icon: "📦", exact: false },
  { path: "/admin/product-prices", label: "Product Prices", icon: "💰", exact: false },
  { path: "/admin/modifier-templates", label: "Modifier Templates", icon: "🔧", exact: false },
  { path: "/admin/import-products", label: "Import CSV", icon: "📥", exact: false },
  { path: "/admin/categories", label: "Category Images", icon: "🖼️", exact: false },
  { path: "/admin/store-logos", label: "Store Logos", icon: "🎨", exact: false },
  { path: "/admin/batch-category-images", label: "Batch Images", icon: "🗂️", exact: false },
  { path: "/admin/driver-management", label: "Drivers", icon: "🚗", exact: false },
  { path: "/admin/create-driver", label: "New Driver", icon: "➕", exact: false },
  { path: "/admin/messages", label: "Messages", icon: "💬", exact: false, hasBadge: true },
];

/**
 * Desktop admin layout with sidebar navigation.
 * On web (>900px): shows sidebar + content area
 * On mobile or narrow web: just renders children (uses the native Stack header)
 */
export function AdminDesktopLayout({ children, title }: AdminDesktopLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();

  // Fetch unread message count for badge (only for admin users)
  const { data: unreadData } = trpc.messages.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user && user.role === "admin",
  });
  const unreadCount = unreadData?.count ?? 0;

  // Only show desktop layout on web with sufficient width
  if (Platform.OS !== "web" || width < 900) {
    return <>{children}</>;
  }

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return pathname === item.path || pathname === "/admin/";
    return pathname.startsWith(item.path);
  };

  return (
    <View style={styles.root}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        {/* Brand */}
        <TouchableOpacity onPress={() => router.push("/" as any)} style={styles.brand} activeOpacity={0.8}>
          <Image
            source={require("@/assets/images/Weshop4ulogo.jpg")}
            style={styles.brandLogo}
            contentFit="contain"
          />
          <View>
            <Text style={styles.brandName}>WESHOP4U</Text>
            <Text style={styles.brandSub}>Admin Panel</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Nav Items */}
        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <TouchableOpacity
                key={item.path}
                onPress={() => router.push(item.path as any)}
                style={[styles.navItem, active && styles.navItemActive]}
                activeOpacity={0.7}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                {item.hasBadge && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Divider */}
        <View style={styles.divider} />

        {/* User info + actions */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity onPress={() => router.push("/" as any)} style={styles.footerLink} activeOpacity={0.7}>
            <Text style={styles.footerIcon}>🌐</Text>
            <Text style={styles.footerText}>View Website</Text>
          </TouchableOpacity>

          {user && (
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{user.name?.charAt(0).toUpperCase() || "A"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.name || "Admin"}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              logout();
              router.push("/" as any);
            }}
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>{title || "Admin"}</Text>
          <View style={styles.topBarRight}>
            <Text style={styles.topBarUser}>{user?.name || "Admin"}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 260;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
  },
  // Sidebar
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: "#0F172A",
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#00E5FF",
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginVertical: 12,
    marginHorizontal: 4,
  },
  navScroll: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: "rgba(0, 229, 255, 0.12)",
  },
  navIcon: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    flex: 1,
  },
  navLabelActive: {
    color: "#00E5FF",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  // Sidebar footer
  sidebarFooter: {
    gap: 8,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  footerIcon: {
    fontSize: 14,
    width: 24,
    textAlign: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1E293B",
    borderRadius: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  userEmail: {
    fontSize: 11,
    color: "#64748B",
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },
  // Main content
  main: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBarUser: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  // Content area
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 32,
    paddingBottom: 64,
  },
});
