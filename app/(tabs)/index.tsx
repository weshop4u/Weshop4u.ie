import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { isStoreOpen, getTodayHours, getNextOpenTime } from "@/lib/store-hours";
import { useLocation, calculateDistance } from "@/hooks/use-location";

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

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: stores, isLoading } = trpc.stores.list.useQuery();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { location, loading: locationLoading, permissionDenied } = useLocation();

  // Filter stores based on search query
  const filteredStores = useMemo(() => {
    if (!stores) return [];
    if (!searchQuery.trim()) return stores;

    const query = searchQuery.toLowerCase().trim();
    return stores.filter((store) => {
      const nameMatch = store.name.toLowerCase().includes(query);
      const categoryMatch = CATEGORY_LABELS[store.category as StoreCategory].toLowerCase().includes(query);
      const descriptionMatch = store.description?.toLowerCase().includes(query) || false;
      return nameMatch || categoryMatch || descriptionMatch;
    });
  }, [stores, searchQuery]);

  // Calculate distances and sort: open first, then by distance
  const sortedStores = useMemo(() => {
    const storesWithDistance = filteredStores.map((store) => {
      let distance: number | null = null;
      if (location && store.latitude && store.longitude) {
        distance = calculateDistance(
          location.latitude,
          location.longitude,
          parseFloat(store.latitude),
          parseFloat(store.longitude)
        );
      }
      return { ...store, distance };
    });

    return storesWithDistance.sort((a, b) => {
      // First: open stores before closed
      const aOpen = isStoreOpen(a) ? 0 : 1;
      const bOpen = isStoreOpen(b) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;

      // Second: sort by distance (nearest first), null distances go last
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });
  }, [filteredStores, location]);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading stores...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Hero Section */}
        <View className="items-center py-8 px-4">
          <Text className="text-4xl font-bold text-primary mb-2">WESHOP4U</Text>
          <Text className="text-base text-muted text-center mb-6">
            24/7 Delivery from Your Favorite Stores
          </Text>
          
          {/* Login Button - Centered below tagline */}
          {!user && (
            <TouchableOpacity
              onPress={() => router.push("/auth/login")}
              className="bg-primary px-8 py-3 rounded-full active:opacity-70"
              style={{ shadowColor: "#00E5FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Text className="text-background font-bold text-base">Log In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View className="px-4 mb-4">
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground"
            placeholder="Search stores by name or category..."
            placeholderTextColor="#9BA1A6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Stores Grid */}
        <View className="px-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-foreground">Browse Stores</Text>
            {location && !locationLoading && (
              <Text style={{ fontSize: 12, color: '#687076' }}>
                Sorted by distance
              </Text>
            )}
          </View>
          
          {sortedStores && sortedStores.length > 0 ? (
            <View className="gap-4">
              {sortedStores.map((store) => {
                const open = isStoreOpen(store);
                const todayHours = getTodayHours(store);
                const nextOpen = !open ? getNextOpenTime(store) : null;

                return (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => {
                      router.push(`/store/${store.id}`);
                    }}
                    className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                    style={[
                      { shadowColor: "#00E5FF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
                      !open && { opacity: 0.7 },
                    ]}
                  >
                    <View className="flex-row items-center gap-4">
                      {/* Store Logo */}
                      <View className="w-16 h-16 rounded-xl items-center justify-center overflow-hidden bg-primary/10">
                        {store.logo ? (
                          <Image
                            source={{ uri: store.logo }}
                            style={{ width: 64, height: 64, borderRadius: 12 }}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <Text className="text-3xl">🏪</Text>
                        )}
                      </View>

                      {/* Store Info */}
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-lg font-bold text-foreground" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {store.name}
                          </Text>
                          {/* Open/Closed Badge */}
                          <View
                            style={{
                              backgroundColor: open ? "#DCFCE7" : "#FEF2F2",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: open ? "#16A34A" : "#DC2626",
                              }}
                            >
                              {open ? "Open" : "Closed"}
                            </Text>
                          </View>
                        </View>
                        
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-sm text-muted">
                            {CATEGORY_LABELS[store.category as StoreCategory]}
                          </Text>
                          {/* Distance Badge */}
                          {store.distance !== null && (
                            <View style={{
                              backgroundColor: '#E0F7FA',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#0097A7' }}>
                                {formatDistance(store.distance)}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        {/* Today's hours or next opening time */}
                        {todayHours && (
                          <Text style={{ fontSize: 12, color: open ? "#687076" : "#DC2626" }}>
                            {open ? todayHours : (nextOpen || todayHours)}
                          </Text>
                        )}
                        
                        {store.description && !todayHours && (
                          <Text className="text-xs text-muted" numberOfLines={2}>
                            {store.description}
                          </Text>
                        )}
                      </View>

                      {/* Arrow */}
                      <Text className="text-primary text-2xl">›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted text-center">
                {searchQuery ? "No stores match your search" : "No stores available at the moment"}
              </Text>
              {searchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  className="mt-4 bg-primary px-6 py-2 rounded-lg active:opacity-70"
                >
                  <Text className="text-background font-semibold">Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
