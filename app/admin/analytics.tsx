import { View, Text, ScrollView, ActivityIndicator, Platform, TouchableOpacity, useWindowDimensions } from "react-native";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const webCursor = Platform.OS === "web" ? { cursor: "pointer" as any } : {};

function MetricCard({ label, value, subValue, color }: { label: string; value: string | number; subValue?: string; color?: string }) {
  return (
    <View className="bg-surface rounded-xl p-4 border border-border flex-1 min-w-[140px]">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color: color || "#00E5FF" }}>{value}</Text>
      {subValue && <Text className="text-xs text-muted mt-1">{subValue}</Text>}
    </View>
  );
}

function AnalyticsContent() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const [selectedDays, setSelectedDays] = useState(30);

  // Fetch analytics data
  const { data: popularProducts, isLoading: loadingPopular } = trpc.analytics.getPopularProducts.useQuery({ limit: 10, days: selectedDays });
  const { data: salesTrends, isLoading: loadingTrends } = trpc.analytics.getSalesTrends.useQuery({ days: selectedDays });
  const { data: categoryRevenue, isLoading: loadingCategory } = trpc.analytics.getRevenueByCategory.useQuery({ days: selectedDays });
  const { data: salesSummary, isLoading: loadingSummary } = trpc.analytics.getSalesSummary.useQuery({ days: selectedDays });

  const isLoading = loadingPopular || loadingTrends || loadingCategory || loadingSummary;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading analytics...</Text>
      </View>
    );
  }

  if (isDesktopWeb) {
    return (
      <View style={{ gap: 24 }}>
        {/* Header with date range selector */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#0F172A" }}>Analytics</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[7, 30, 90].map(days => (
              <TouchableOpacity
                key={days}
                onPress={() => setSelectedDays(days)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: selectedDays === days ? "#00E5FF" : "#F8FAFC",
                  borderWidth: 1,
                  borderColor: selectedDays === days ? "#00E5FF" : "#E2E8F0",
                  ...webCursor,
                }}
              >
                <Text style={{ fontWeight: "600", color: selectedDays === days ? "#fff" : "#0F172A" }}>Last {days}d</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary Metrics */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Summary</Text>
          <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
            <MetricCard label="Total Revenue" value={`€${(salesSummary?.totalRevenue || 0).toFixed(2)}`} color="#22C55E" />
            <MetricCard label="Total Orders" value={salesSummary?.totalOrders || 0} color="#00E5FF" />
            <MetricCard label="Delivered" value={salesSummary?.deliveredOrders || 0} subValue={`${salesSummary?.conversionRate || 0}% conversion`} color="#16A34A" />
            <MetricCard label="Avg Order Value" value={`€${(salesSummary?.avgOrderValue || 0).toFixed(2)}`} color="#F59E0B" />
          </View>
        </View>

        {/* Two-column layout: Popular Products + Revenue by Category */}
        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          {/* Popular Products */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Top Selling Products</Text>
            <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
              {/* Table Header */}
              <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <Text style={{ flex: 1.5, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Product</Text>
                <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Qty</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Revenue</Text>
              </View>
              {/* Rows */}
              {popularProducts && popularProducts.length > 0 ? (
                popularProducts.slice(0, 10).map((product: any, idx: number) => (
                  <View key={product.productId} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                    <Text style={{ flex: 1.5, fontSize: 13, color: "#0F172A", fontWeight: "600" }} numberOfLines={1}>{product.productName}</Text>
                    <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{product.totalQuantity}</Text>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#22C55E", textAlign: "right" }}>€{product.totalRevenue.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>No sales data</Text>
                </View>
              )}
            </View>
          </View>

          {/* Revenue by Category */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Revenue by Category</Text>
            <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
              {/* Table Header */}
              <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <Text style={{ flex: 1.5, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Category</Text>
                <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Orders</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Revenue</Text>
              </View>
              {/* Rows */}
              {categoryRevenue && categoryRevenue.length > 0 ? (
                categoryRevenue.slice(0, 10).map((cat: any, idx: number) => (
                  <View key={cat.categoryId} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                    <Text style={{ flex: 1.5, fontSize: 13, color: "#0F172A", fontWeight: "600" }} numberOfLines={1}>{cat.categoryName}</Text>
                    <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{cat.orderCount}</Text>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#22C55E", textAlign: "right" }}>€{cat.totalRevenue.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>No category data</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Daily Sales Trends */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Daily Sales Trends</Text>
          <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
            {/* Table Header */}
            <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Date</Text>
              <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Orders</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Revenue</Text>
            </View>
            {/* Rows */}
            {salesTrends && salesTrends.length > 0 ? (
              salesTrends.slice(-14).map((trend: any, idx: number) => (
                <View key={trend.date} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < salesTrends.length - 1 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                  <Text style={{ flex: 1, fontSize: 13, color: "#0F172A", fontWeight: "600" }}>{trend.date}</Text>
                  <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{trend.orderCount}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#22C55E", textAlign: "right" }}>€{trend.revenue.toFixed(2)}</Text>
                </View>
              ))
            ) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>No trend data</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout
  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-bold text-foreground">Analytics</Text>
          <Text className="text-sm text-muted">Sales & Performance</Text>
        </View>

        {/* Date range selector */}
        <View className="px-4 pt-4 flex-row gap-2">
          {[7, 30, 90].map(days => (
            <TouchableOpacity
              key={days}
              onPress={() => setSelectedDays(days)}
              className={`flex-1 py-2 px-3 rounded-lg border ${selectedDays === days ? "bg-primary border-primary" : "bg-surface border-border"}`}
            >
              <Text className={`text-center text-sm font-semibold ${selectedDays === days ? "text-background" : "text-foreground"}`}>{days}d</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View className="px-4 pt-4">
          <Text className="text-lg font-bold text-foreground mb-3">Summary</Text>
          <View className="gap-3">
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Total Revenue</Text>
              <Text className="text-2xl font-bold text-success">€{(salesSummary?.totalRevenue || 0).toFixed(2)}</Text>
            </View>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Total Orders</Text>
              <Text className="text-2xl font-bold text-primary">{salesSummary?.totalOrders || 0}</Text>
              <Text className="text-xs text-muted mt-1">{salesSummary?.conversionRate || 0}% delivered</Text>
            </View>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-xs text-muted mb-1">Avg Order Value</Text>
              <Text className="text-2xl font-bold text-warning">€{(salesSummary?.avgOrderValue || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Popular Products */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Top Products</Text>
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            {popularProducts && popularProducts.length > 0 ? (
              popularProducts.slice(0, 5).map((product: any) => (
                <View key={product.productId} className="border-b border-border p-3 flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>{product.productName}</Text>
                    <Text className="text-xs text-muted mt-1">{product.totalQuantity} sold • {product.orderCount} orders</Text>
                  </View>
                  <Text className="font-bold text-success ml-2">€{product.totalRevenue.toFixed(2)}</Text>
                </View>
              ))
            ) : (
              <View className="p-4 items-center">
                <Text className="text-muted">No sales data</Text>
              </View>
            )}
          </View>
        </View>

        {/* Revenue by Category */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">By Category</Text>
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            {categoryRevenue && categoryRevenue.length > 0 ? (
              categoryRevenue.slice(0, 5).map((cat: any) => (
                <View key={cat.categoryId} className="border-b border-border p-3 flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>{cat.categoryName}</Text>
                    <Text className="text-xs text-muted mt-1">{cat.orderCount} orders</Text>
                  </View>
                  <Text className="font-bold text-success ml-2">€{cat.totalRevenue.toFixed(2)}</Text>
                </View>
              ))
            ) : (
              <View className="p-4 items-center">
                <Text className="text-muted">No category data</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function AnalyticsScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  if (isDesktopWeb) {
    return (
      <AdminDesktopLayout>
        <AnalyticsContent />
      </AdminDesktopLayout>
    );
  }

  return <AnalyticsContent />;
}
