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
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  const { data: activeBanners } = trpc.banners.getActive.useQuery();
  const { user } = useAuth();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  // Product search query (only fires when debounced query has 2+ chars)
  const { data: productResults } = trpc.stores.searchProducts.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  // Filter stores by name
  const matchingStores = useMemo(() => {
    if (!stores || !debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 4);
  }, [stores, debouncedQuery]);

  // Group product results by store
  const groupedProducts = useMemo(() => {
    if (!productResults || productResults.length === 0) return [];
    const groups: Record<number, { storeName: string; storeLogo: string | null; storeId: number; products: typeof productResults }> = {};
    for (const p of productResults) {
      if (!groups[p.storeId]) {
        groups[p.storeId] = { storeName: p.storeName, storeLogo: p.storeLogo, storeId: p.storeId, products: [] };
      }
      groups[p.storeId].products.push(p);
    }
    return Object.values(groups);
  }, [productResults]);

  const hasSearchResults = matchingStores.length > 0 || groupedProducts.length > 0;

  // Show dropdown when typing
  useEffect(() => {
    setShowDropdown(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  // Filter stores for the grid (no search filter — grid always shows all stores)
  const filteredStores = useMemo(() => {
    if (!stores) return [];
    return stores;
  }, [stores]);

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

        {/* Smart Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search stores or products..."
              placeholderTextColor="#9BA1A6"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (!text.trim()) setShowDropdown(false);
              }}
              onFocus={() => { if (debouncedQuery.length >= 2) setShowDropdown(true); }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); setShowDropdown(false); }} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Dropdown */}
          {showDropdown && debouncedQuery.length >= 2 && (
            <View style={searchDropdownStyles.dropdown}>
              {/* Matching Stores */}
              {matchingStores.length > 0 && (
                <View style={searchDropdownStyles.section}>
                  <Text style={searchDropdownStyles.sectionLabel}>Stores</Text>
                  {matchingStores.map((store) => (
                    <TouchableOpacity
                      key={`store-${store.id}`}
                      style={searchDropdownStyles.storeRow}
                      onPress={() => {
                        setShowDropdown(false);
                        setSearchQuery("");
                        router.push(`/store/${store.id}`);
                      }}
                    >
                      {store.logo ? (
                        <Image source={{ uri: store.logo }} style={searchDropdownStyles.storeLogo} contentFit="cover" />
                      ) : (
                        <View style={searchDropdownStyles.storeLogoPlaceholder}>
                          <Text style={{ fontSize: 16 }}>{CATEGORY_ICONS[store.category as StoreCategory] || "🏪"}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={searchDropdownStyles.storeName}>{store.name}</Text>
                        <Text style={searchDropdownStyles.storeCategory}>{CATEGORY_LABELS[store.category as StoreCategory]}</Text>
                      </View>
                      <View style={[searchDropdownStyles.statusDot, { backgroundColor: isStoreOpen(store) ? "#16A34A" : "#DC2626" }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Matching Products grouped by store */}
              {groupedProducts.length > 0 && (
                <View style={searchDropdownStyles.section}>
                  <Text style={searchDropdownStyles.sectionLabel}>Products</Text>
                  {groupedProducts.map((group) => (
                    <View key={`group-${group.storeId}`}>
                      <Text style={searchDropdownStyles.groupStoreName}>{group.storeName}</Text>
                      {group.products.slice(0, 4).map((product) => (
                        <TouchableOpacity
                          key={`product-${product.id}`}
                          style={searchDropdownStyles.productRow}
                          onPress={() => {
                            const query = searchQuery.trim();
                            setShowDropdown(false);
                            setSearchQuery("");
                            const params = new URLSearchParams();
                            if (product.categoryId) params.set('categoryId', String(product.categoryId));
                            if (query) params.set('productSearch', query);
                            const qs = params.toString();
                            router.push(`/store/${group.storeId}${qs ? `?${qs}` : ''}`);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={searchDropdownStyles.productName} numberOfLines={1}>{product.name}</Text>
                            {product.categoryName && (
                              <Text style={searchDropdownStyles.productCategory}>{product.categoryName}</Text>
                            )}
                          </View>
                          <Text style={searchDropdownStyles.productPrice}>
                            {product.salePrice ? `€${product.salePrice}` : `€${product.price}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* No results */}
              {!hasSearchResults && debouncedQuery.length >= 2 && (
                <View style={searchDropdownStyles.noResults}>
                  <Text style={searchDropdownStyles.noResultsText}>No stores or products found for "{debouncedQuery}"</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Promotional Banners from Database */}
      {!searchQuery && activeBanners && activeBanners.length > 0 && (
        <View style={{ maxWidth: 900, width: "100%", alignSelf: "center", paddingHorizontal: 24, marginBottom: 8, gap: 12 }}>
          {activeBanners.map((banner: any) => {
            const bg = banner.backgroundColor || "#0F172A";
            const accent = banner.accentColor || "#00E5FF";
            return (
              <View key={banner.id} style={{
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: bg,
                padding: 24,
                position: "relative",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}>
                <View style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  backgroundColor: accent,
                }} />
                <View style={{ flex: 1, minWidth: 250 }}>
                  <Text style={{ fontSize: 19, fontWeight: "800", color: accent, marginBottom: 6, letterSpacing: 0.3 }}>
                    {banner.title}
                  </Text>
                  {banner.subtitle && (
                    <Text style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 20 }}>
                      {banner.subtitle}
                    </Text>
                  )}
                </View>
                {banner.discountCode && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{
                      backgroundColor: `${accent}20`,
                      borderWidth: 1.5,
                      borderColor: accent,
                      borderStyle: "dashed",
                      borderRadius: 10,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                    }}>
                      <Text style={{ fontSize: 20, fontWeight: "900", color: accent, letterSpacing: 2 }}>
                        {banner.discountCode}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

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
          <Text style={styles.sectionTitle}>Browse Stores</Text>
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
              No stores available at the moment
            </Text>
          </View>
        )}
      </View>

      {/* Download App Section */}
      <View style={styles.downloadSection}>
        <View style={styles.downloadContent}>
          <View style={styles.downloadTextArea}>
            <Text style={styles.downloadTitle}>Get WESHOP4U on Your Phone</Text>
            <Text style={styles.downloadDesc}>
              Add WESHOP4U to your home screen for instant access. No app store needed — just tap the button below and enjoy faster ordering, real-time tracking, and a native app experience.
            </Text>
            <View style={styles.downloadBadges}>
              <TouchableOpacity
                style={[styles.storeBadge, { backgroundColor: "#00E5FF" }]}
                onPress={() => {
                  // Try to trigger PWA install prompt
                  if (typeof window !== "undefined" && (window as any).__pwaInstallPrompt) {
                    (window as any).__pwaInstallPrompt.prompt();
                  } else {
                    // Fallback: show instructions
                    alert("To install WESHOP4U:\n\niPhone: Tap the Share button (box with arrow) then 'Add to Home Screen'\n\nAndroid: Tap the menu (three dots) then 'Add to Home Screen' or 'Install App'");
                  }
                }}
              >
                <Text style={[styles.storeBadgeSmall, { color: "#ffffff" }]}>Tap to</Text>
                <Text style={[styles.storeBadgeLarge, { color: "#ffffff" }]}>Install App</Text>
              </TouchableOpacity>
              <View style={[styles.storeBadge, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#334155" }]}>
                <Text style={[styles.storeBadgeSmall, { color: "#9BA1A6" }]}>Works on</Text>
                <Text style={[styles.storeBadgeLarge, { color: "#ffffff" }]}>iPhone & Android</Text>
              </View>
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
    paddingBottom: 80,
    backgroundColor: "rgba(0, 229, 255, 0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    overflow: "visible" as any,
    zIndex: 50,
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
  searchWrapper: {
    width: "100%",
    maxWidth: 500,
    position: "relative" as const,
    zIndex: 50,
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

const searchDropdownStyles = StyleSheet.create({
  dropdown: {
    position: "absolute" as const,
    top: "100%" as any,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: 400,
    overflow: "hidden" as const,
    zIndex: 1000,
  },
  section: {
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#9BA1A6",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  storeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  storeLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  storeLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#11181C",
  },
  storeCategory: {
    fontSize: 12,
    color: "#687076",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupStoreName: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#00E5FF",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  productRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  productName: {
    fontSize: 14,
    color: "#11181C",
  },
  productCategory: {
    fontSize: 11,
    color: "#9BA1A6",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#11181C",
  },
  noResults: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    alignItems: "center" as const,
  },
  noResultsText: {
    fontSize: 14,
    color: "#687076",
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
