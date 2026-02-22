/**
 * Web-optimised home page.
 * This component is used when Platform.OS === "web" to provide a proper website experience
 * with hero section, store cards in a grid layout, and responsive design.
 */
import { Text, View, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { isStoreOpen, getTodayHours, getNextOpenTime } from "@/lib/store-hours";
import { useColors } from "@/hooks/use-colors";

type StoreCategory = "convenience" | "restaurant" | "hardware" | "electrical" | "clothing" | "grocery" | "pharmacy" | "other";

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  convenience: "Convenience",
  restaurant: "Restaurant",
  hardware: "Hardware",
  electrical: "Electrical",
  clothing: "Clothing",
  grocery: "Grocery",
  pharmacy: "Pharmacy",
  other: "Other",
};

const CATEGORY_ICONS: Record<StoreCategory, string> = {
  convenience: "🏪",
  restaurant: "🍽️",
  hardware: "🔧",
  electrical: "⚡",
  clothing: "👕",
  grocery: "🛒",
  pharmacy: "💊",
  other: "📦",
};

export default function WebHome() {
  const router = useRouter();
  const { data: stores, isLoading } = trpc.stores.list.useQuery();
  const { data: featuredStores } = trpc.stores.getFeatured.useQuery();
  const { user } = useAuth();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const screenWidth = Dimensions.get("window").width;

  // Filter stores
  const filteredStores = useMemo(() => {
    if (!stores) return [];
    if (!searchQuery.trim()) return stores;
    const query = searchQuery.toLowerCase().trim();
    return stores.filter((store) => {
      const nameMatch = store.name.toLowerCase().includes(query);
      const categoryMatch = CATEGORY_LABELS[store.category as StoreCategory]?.toLowerCase().includes(query);
      return nameMatch || categoryMatch;
    });
  }, [stores, searchQuery]);

  // Sort: open first, then by position
  const sortedStores = useMemo(() => {
    return [...filteredStores].sort((a, b) => {
      const aPos = (a as any).sortPosition ?? 999;
      const bPos = (b as any).sortPosition ?? 999;
      if (aPos !== bPos) return aPos - bPos;
      const aOpen = isStoreOpen(a) ? 0 : 1;
      const bOpen = isStoreOpen(b) ? 0 : 1;
      return aOpen - bOpen;
    });
  }, [filteredStores]);

  // Responsive columns
  const numColumns = screenWidth > 900 ? 3 : screenWidth > 600 ? 2 : 1;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={{ color: colors.muted, marginTop: 16, fontSize: 16 }}>Loading stores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/Weshop4ulogo.jpg")}
          style={styles.heroLogo}
          contentFit="contain"
        />
        <Text style={styles.heroTitle}>WESHOP4U</Text>
        <Text style={styles.heroSubtitle}>
          Your Local Store to Your Door
        </Text>
        <Text style={styles.heroDescription}>
          Order groceries, food, and essentials from local stores in your area and get them delivered straight to your door, office or wherever you are within minutes!
        </Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stores by name or category..."
            placeholderTextColor="#9BA1A6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Popular Stores Section */}
      {featuredStores && featuredStores.length > 0 && !searchQuery && (
        <View style={popularStyles.section}>
          <Text style={popularStyles.sectionTitle}>Popular Stores</Text>
          <Text style={popularStyles.sectionSubtitle}>Our most loved stores — order now for express delivery</Text>
          <View style={popularStyles.cardsRow}>
            {featuredStores.slice(0, 2).map((store) => {
              const open = isStoreOpen(store);
              const todayHours = getTodayHours(store);
              return (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => router.push(`/store/${store.id}`)}
                  style={popularStyles.card}
                  activeOpacity={0.85}
                >
                  {/* Store Logo */}
                  <View style={popularStyles.cardLogoContainer}>
                    {store.logo ? (
                      <Image
                        source={{ uri: store.logo }}
                        style={popularStyles.cardLogo}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={popularStyles.cardLogoPlaceholder}>
                        <Text style={{ fontSize: 40 }}>
                          {CATEGORY_ICONS[store.category as StoreCategory] || "🏪"}
                        </Text>
                      </View>
                    )}
                    {/* Open/Closed overlay badge */}
                    <View style={[popularStyles.statusOverlay, { backgroundColor: open ? "#16A34A" : "#DC2626" }]}>
                      <Text style={popularStyles.statusOverlayText}>{open ? "Open" : "Closed"}</Text>
                    </View>
                  </View>
                  {/* Store Info */}
                  <View style={popularStyles.cardInfo}>
                    <Text style={popularStyles.cardName} numberOfLines={1}>{store.name}</Text>
                    <Text style={popularStyles.cardCategory}>
                      {CATEGORY_LABELS[store.category as StoreCategory]}
                    </Text>
                    {todayHours && (
                      <Text style={[popularStyles.cardHours, { color: open ? "#687076" : "#DC2626" }]}>
                        🕐 {todayHours}
                      </Text>
                    )}
                    <View style={[popularStyles.cardButton, !open && popularStyles.cardButtonClosed]}>
                      <Text style={[popularStyles.cardButtonText, !open && popularStyles.cardButtonTextClosed]}>
                        {open ? "Order Now →" : "View Menu"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* How It Works Section */}
      <View style={styles.howItWorks}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.stepsRow}>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>🏪</Text>
            </View>
            <Text style={styles.stepTitle}>Choose a Store</Text>
            <Text style={styles.stepDesc}>Browse local stores and pick your favourite</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>🛒</Text>
            </View>
            <Text style={styles.stepTitle}>Add to Cart</Text>
            <Text style={styles.stepDesc}>Select products and add them to your cart</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>🚗</Text>
            </View>
            <Text style={styles.stepTitle}>Express Delivery</Text>
            <Text style={styles.stepDesc}>Fast delivery to your door — track in real-time</Text>
          </View>
        </View>
      </View>

      {/* Stores Section */}
      <View style={styles.storesSection}>
        <View style={styles.storesSectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : "Browse Stores"}
          </Text>
          <Text style={styles.storeCount}>
            {sortedStores.length} store{sortedStores.length !== 1 ? "s" : ""} available
          </Text>
        </View>

        {sortedStores.length > 0 ? (
          <View style={[styles.storesGrid, { gap: 20 }]}>
            {sortedStores.map((store) => {
              const open = isStoreOpen(store);
              const todayHours = getTodayHours(store);
              const nextOpen = !open ? getNextOpenTime(store) : null;

              return (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => router.push(`/store/${store.id}`)}
                  style={[
                    styles.storeCard,
                    { width: numColumns === 1 ? "100%" : `${Math.floor(100 / numColumns) - 2}%` as any },
                    !open && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.8}
                >
                  {/* Store Logo */}
                  <View style={styles.storeCardLogo}>
                    {store.logo ? (
                      <Image
                        source={{ uri: store.logo }}
                        style={styles.storeLogoImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Text style={styles.storeLogoPlaceholder}>
                        {CATEGORY_ICONS[store.category as StoreCategory] || "🏪"}
                      </Text>
                    )}
                  </View>

                  {/* Store Info */}
                  <View style={styles.storeCardInfo}>
                    <View style={styles.storeNameRow}>
                      <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: open ? "#DCFCE7" : "#FEF2F2" }]}>
                        <Text style={[styles.statusText, { color: open ? "#16A34A" : "#DC2626" }]}>
                          {open ? "Open" : "Closed"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.storeCategory}>
                      {CATEGORY_LABELS[store.category as StoreCategory]}
                    </Text>
                    {todayHours && (
                      <Text style={[styles.storeHours, { color: open ? "#687076" : "#DC2626" }]}>
                        🕐 {open ? todayHours : (nextOpen || todayHours)}
                      </Text>
                    )}
                    {store.description && (
                      <Text style={styles.storeDescription} numberOfLines={2}>
                        {store.description}
                      </Text>
                    )}
                  </View>

                  {/* Order Button */}
                  <View style={styles.orderButtonContainer}>
                    <View style={[styles.orderButton, !open && styles.orderButtonClosed]}>
                      <Text style={[styles.orderButtonText, !open && styles.orderButtonTextClosed]}>
                        {open ? "Order Now →" : "View Menu"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptyDesc}>
              {searchQuery ? `No stores match "${searchQuery}"` : "No stores available at the moment"}
            </Text>
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Download App Section */}
      <View style={styles.downloadSection}>
        <View style={styles.downloadContent}>
          <View style={styles.downloadTextArea}>
            <Text style={styles.downloadTitle}>Download Our App</Text>
            <Text style={styles.downloadDesc}>
              Get the full WeShop4U experience on your phone. Faster ordering, real-time tracking, and exclusive app-only features.
            </Text>
            <View style={styles.downloadBadges}>
              <TouchableOpacity style={styles.storeBadge}>
                <Text style={styles.storeBadgeSmall}>Download on the</Text>
                <Text style={styles.storeBadgeLarge}>App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.storeBadge}>
                <Text style={styles.storeBadgeSmall}>Get it on</Text>
                <Text style={styles.storeBadgeLarge}>Google Play</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.downloadImageArea}>
            <View style={styles.phoneMockup}>
              <Image
                source={require("@/assets/images/Weshop4ulogo.jpg")}
                style={styles.phoneMockupImage}
                contentFit="contain"
              />
            </View>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      {!user && (
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Order?</Text>
          <Text style={styles.ctaDesc}>
            Create a free account to track orders, save addresses, and enjoy faster checkout.
          </Text>
          <View style={styles.ctaButtons}>
            <TouchableOpacity
              onPress={() => router.push("/auth/register")}
              style={styles.ctaPrimary}
            >
              <Text style={styles.ctaPrimaryText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/auth/login")}
              style={styles.ctaSecondary}
            >
              <Text style={styles.ctaSecondaryText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  // Hero
  hero: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 229, 255, 0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  heroLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "900",
    color: "#00E5FF",
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#11181C",
    marginBottom: 8,
    textAlign: "center",
  },
  heroDescription: {
    fontSize: 16,
    color: "#687076",
    textAlign: "center",
    maxWidth: 500,
    lineHeight: 24,
    marginBottom: 28,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#11181C",
    outlineStyle: "none" as any,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: "#687076",
  },
  // How It Works
  howItWorks: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  stepsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 32,
    marginTop: 24,
  },
  step: {
    alignItems: "center",
    width: 220,
  },
  stepIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepEmoji: {
    fontSize: 32,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#11181C",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    color: "#687076",
    textAlign: "center",
    lineHeight: 20,
  },
  // Stores
  storesSection: {
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  storesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11181C",
  },
  storeCount: {
    fontSize: 14,
    color: "#687076",
  },
  storesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  storeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  storeCardLogo: {
    height: 120,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  storeLogoImage: {
    width: "100%",
    height: 120,
  },
  storeLogoPlaceholder: {
    fontSize: 48,
  },
  storeCardInfo: {
    padding: 16,
    gap: 4,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#11181C",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  storeCategory: {
    fontSize: 14,
    color: "#687076",
  },
  storeHours: {
    fontSize: 13,
  },
  storeDescription: {
    fontSize: 13,
    color: "#9BA1A6",
    lineHeight: 18,
    marginTop: 4,
  },
  orderButtonContainer: {
    padding: 16,
    paddingTop: 8,
  },
  orderButton: {
    backgroundColor: "#00E5FF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  orderButtonClosed: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  orderButtonTextClosed: {
    color: "#687076",
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#11181C",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: "#687076",
    textAlign: "center",
  },
  clearSearchButton: {
    marginTop: 16,
    backgroundColor: "#00E5FF",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearSearchText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  // CTA
  ctaSection: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 229, 255, 0.05)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  ctaTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#11181C",
    marginBottom: 8,
  },
  ctaDesc: {
    fontSize: 16,
    color: "#687076",
    textAlign: "center",
    maxWidth: 450,
    lineHeight: 24,
    marginBottom: 24,
  },
  ctaButtons: {
    flexDirection: "row",
    gap: 12,
  },
  ctaPrimary: {
    backgroundColor: "#00E5FF",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaPrimaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  ctaSecondary: {
    borderWidth: 2,
    borderColor: "#00E5FF",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaSecondaryText: {
    color: "#00E5FF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Download App
  downloadSection: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: "#0A0E27",
  },
  downloadContent: {
    maxWidth: 1000,
    alignSelf: "center" as const,
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 40,
  },
  downloadTextArea: {
    flex: 1,
    minWidth: 280,
    gap: 12,
  },
  downloadTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#ffffff",
  },
  downloadDesc: {
    fontSize: 16,
    color: "#9BA1A6",
    lineHeight: 24,
  },
  downloadBadges: {
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap" as const,
  },
  storeBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center" as const,
    minWidth: 140,
  },
  storeBadgeSmall: {
    fontSize: 10,
    color: "#687076",
    fontWeight: "500" as const,
  },
  storeBadgeLarge: {
    fontSize: 16,
    color: "#11181C",
    fontWeight: "800" as const,
  },
  downloadImageArea: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  phoneMockup: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2,
    borderColor: "#00E5FF",
  },
  phoneMockupImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
});

const popularStyles = StyleSheet.create({
  section: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11181C",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: "#687076",
    textAlign: "center",
    marginBottom: 24,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    maxWidth: 700,
    justifyContent: "center",
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    maxWidth: 340,
  },
  cardLogoContainer: {
    height: 140,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardLogo: {
    width: "100%",
    height: 140,
  },
  cardLogoPlaceholder: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F7FA",
  },
  statusOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOverlayText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardInfo: {
    padding: 14,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#11181C",
  },
  cardCategory: {
    fontSize: 13,
    color: "#687076",
  },
  cardHours: {
    fontSize: 12,
  },
  cardButton: {
    backgroundColor: "#00E5FF",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  cardButtonClosed: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cardButtonTextClosed: {
    color: "#687076",
  },
});
