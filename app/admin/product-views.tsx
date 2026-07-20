import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function AdminProductViews() {
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month" | "all">("week");
  const [storeId, setStoreId] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(20);
  const isDesktopWeb = Platform.OS === "web";

  const { data: stores } = trpc.admin.getAllStoresAdmin.useQuery();

  const { data, isLoading } = trpc.admin.getMostViewedProducts.useQuery(
    { timePeriod, limit: 50, storeId },
    { refetchInterval: 60000 }
  );

  const products = data?.mostViewedProducts || [];

  const periodLabel = (p: string) =>
    p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "All Time";

  const content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#0F172A" }}>
        👁️ Product Views
      </Text>

      {/* Time Period Filter */}
      <View>
        <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Time Period</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["today", "week", "month", "all"] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setTimePeriod(period)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: timePeriod === period ? "#00E5FF" : "#f5f5f5",
                borderWidth: 1,
                borderColor: timePeriod === period ? "#00E5FF" : "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: timePeriod === period ? "#fff" : "#0F172A" }}>
                {periodLabel(period)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Store Filter */}
      <View>
        <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Store</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={() => setStoreId(null)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              backgroundColor: storeId === null ? "#00E5FF" : "#f5f5f5",
              borderWidth: 1,
              borderColor: storeId === null ? "#00E5FF" : "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: storeId === null ? "#fff" : "#0F172A" }}>
              All Stores
            </Text>
          </Pressable>
          {stores?.map((store) => (
            <Pressable
              key={store.id}
              onPress={() => setStoreId(store.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: storeId === store.id ? "#00E5FF" : "#f5f5f5",
                borderWidth: 1,
                borderColor: storeId === store.id ? "#00E5FF" : "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: storeId === store.id ? "#fff" : "#0F172A" }}>
                {store.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Show Top N */}
      <View>
        <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Show</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[10, 20, 50].map((n) => (
            <Pressable
              key={n}
              onPress={() => setLimit(n)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: limit === n ? "#00E5FF" : "#f5f5f5",
                borderWidth: 1,
                borderColor: limit === n ? "#00E5FF" : "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: limit === n ? "#fff" : "#0F172A" }}>
                Top {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
      ) : (
        <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
          {products.length > 0 ? (
            <View style={{ gap: 12 }}>
              {products.slice(0, limit).map((product, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: idx < Math.min(products.length, limit) - 1 ? 1 : 0,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>
                      {idx + 1}. {product.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#687076", marginTop: 2 }}>
                      {product.storeName || "All Stores"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#00E5FF" }}>
                      {product.viewCount}
                    </Text>
                    <Text style={{ fontSize: 10, color: "#687076" }}>views</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: "#687076", textAlign: "center", paddingVertical: 20 }}>
              No product views recorded for this period and store
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  if (isDesktopWeb) {
    return <AdminDesktopLayout title="Product Views">{content}</AdminDesktopLayout>;
  }

  return <ScreenContainer>{content}</ScreenContainer>;
}
