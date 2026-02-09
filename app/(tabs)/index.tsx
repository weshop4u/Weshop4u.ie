import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

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

export default function HomeScreen() {
  const router = useRouter();
  const { data: stores, isLoading } = trpc.stores.list.useQuery();
  const { user } = useAuth();

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
          <View className="flex-row items-center justify-between w-full mb-4">
            <View className="flex-1" />
            <Text className="text-4xl font-bold text-primary">WESHOP4U</Text>
            <View className="flex-1 items-end">
              {!user && (
                <TouchableOpacity
                  onPress={() => router.push("/auth/login")}
                  className="bg-primary px-4 py-2 rounded-full active:opacity-70"
                >
                  <Text className="text-background font-semibold text-sm">Log In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text className="text-base text-muted text-center">
            24/7 Delivery from Your Favorite Stores
          </Text>
        </View>

        {/* Stores Grid */}
        <View className="px-4">
          <Text className="text-2xl font-bold text-foreground mb-4">Browse Stores</Text>
          
          {stores && stores.length > 0 ? (
            <View className="gap-4">
              {stores.map((store) => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => router.push(`/store/${store.id}`)}
                  className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                  style={{ shadowColor: "#00E5FF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
                >
                  <View className="flex-row items-center gap-4">
                    {/* Store Icon Placeholder */}
                    <View className="w-16 h-16 bg-primary/20 rounded-xl items-center justify-center">
                      <Text className="text-3xl">🏪</Text>
                    </View>

                    {/* Store Info */}
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-lg font-bold text-foreground">{store.name}</Text>
                      </View>
                      
                      <Text className="text-sm text-muted mb-1">
                        {CATEGORY_LABELS[store.category as StoreCategory]}
                      </Text>
                      
                      {store.description && (
                        <Text className="text-xs text-muted" numberOfLines={2}>
                          {store.description}
                        </Text>
                      )}
                    </View>

                    {/* Arrow */}
                    <Text className="text-primary text-2xl">›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted text-center">No stores available at the moment</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
