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

function PaginationControls({ page, totalItems, itemsPerPage, onPageChange }: { page: number; totalItems: number; itemsPerPage: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12 }}>
      <TouchableOpacity
        onPress={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 6,
          backgroundColor: page === 0 ? "#E5E7EB" : "#00E5FF",
          ...webCursor,
        }}
      >
        <Text style={{ color: page === 0 ? "#9CA3AF" : "#fff", fontWeight: "600", fontSize: 12 }}>← Prev</Text>
      </TouchableOpacity>
      <Text style={{ paddingHorizontal: 12, paddingVertical: 6, color: "#0F172A", fontWeight: "600" }}>
        {page + 1} / {totalPages}
      </Text>
      <TouchableOpacity
        onPress={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 6,
          backgroundColor: page >= totalPages - 1 ? "#E5E7EB" : "#00E5FF",
          ...webCursor,
        }}
      >
        <Text style={{ color: page >= totalPages - 1 ? "#9CA3AF" : "#fff", fontWeight: "600", fontSize: 12 }}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

function AnalyticsContent() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const [selectedDays, setSelectedDays] = useState(30);
  const [popularPage, setPopularPage] = useState(0);
  const [trendingPage, setTrendingPage] = useState(0);
  const [categoryPage, setCategoryPage] = useState(0);
  const itemsPerPage = 10;

  // Fetch analytics data
  const { data: popularProducts, isLoading: loadingPopular } = trpc.analytics.getPopularProducts.useQuery({ limit: 100, days: selectedDays });
  const { data: trendingProducts, isLoading: loadingTrending } = trpc.analytics.getMostViewedProducts.useQuery({ limit: 100, days: selectedDays });
  const { data: salesTrends, isLoading: loadingTrends } = trpc.analytics.getSalesTrends.useQuery({ days: selectedDays });
  const { data: categoryRevenue, isLoading: loadingCategory } = trpc.analytics.getRevenueByCategory.useQuery({ days: selectedDays });
  const { data: salesSummary, isLoading: loadingSummary } = trpc.analytics.getSalesSummary.useQuery({ days: selectedDays });

  const isLoading = loadingPopular || loadingTrending || loadingTrends || loadingCategory || loadingSummary;

  // Paginate data
  const paginatedPopular = popularProducts?.slice(popularPage * itemsPerPage, (popularPage + 1) * itemsPerPage) || [];
  const paginatedTrending = trendingProducts?.slice(trendingPage * itemsPerPage, (trendingPage + 1) * itemsPerPage) || [];
  const paginatedCategory = categoryRevenue?.slice(categoryPage * itemsPerPage, (categoryPage + 1) * itemsPerPage) || [];

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
                onPress={() => {
                  setSelectedDays(days);
                  setPopularPage(0);
                  setTrendingPage(0);
                  setCategoryPage(0);
                }}
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

        {/* Three-column layout: Popular Products + Trending Products + Revenue by Category */}
        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          {/* Top Selling Products */}
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
              {paginatedPopular.length > 0 ? (
                paginatedPopular.map((product: any, idx: number) => (
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
              <PaginationControls page={popularPage} totalItems={popularProducts?.length || 0} itemsPerPage={itemsPerPage} onPageChange={setPopularPage} />
            </View>
          </View>

          {/* Most Viewed Products */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Trending Products</Text>
            <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
              {/* Table Header */}
              <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <Text style={{ flex: 1.5, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Product</Text>
                <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Views</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Revenue</Text>
              </View>
              {/* Rows */}
              {paginatedTrending.length > 0 ? (
                paginatedTrending.map((product: any, idx: number) => (
                  <View key={product.productId} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                    <Text style={{ flex: 1.5, fontSize: 13, color: "#0F172A", fontWeight: "600" }} numberOfLines={1}>{product.productName}</Text>
                    <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{product.views}</Text>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#22C55E", textAlign: "right" }}>€{product.totalRevenue.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>No trend data</Text>
                </View>
              )}
              <PaginationControls page={trendingPage} totalItems={trendingProducts?.length || 0} itemsPerPage={itemsPerPage} onPageChange={setTrendingPage} />
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
              {paginatedCategory.length > 0 ? (
                paginatedCategory.map((cat: any, idx: number) => (
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
              <PaginationControls page={categoryPage} totalItems={categoryRevenue?.length || 0} itemsPerPage={itemsPerPage} onPageChange={setCategoryPage} />
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
              onPress={() => {
                setSelectedDays(days);
                setPopularPage(0);
                setTrendingPage(0);
                setCategoryPage(0);
              }}
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
            {paginatedPopular.length > 0 ? (
              paginatedPopular.slice(0, 5).map((product: any) => (
                <View key={product.productId} className="border-b border-border p-3 flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>{product.productName}</Text>
                    <Text className="text-xs text-muted mt-1">{product.totalQuantity} sold</Text>
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

        {/* Trending Products */}
        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Trending</Text>
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            {paginatedTrending.length > 0 ? (
              paginatedTrending.slice(0, 5).map((product: any) => (
                <View key={product.productId} className="border-b border-border p-3 flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>{product.productName}</Text>
                    <Text className="text-xs text-muted mt-1">{product.views} orders</Text>
                  </View>
                  <Text className="font-bold text-success ml-2">€{product.totalRevenue.toFixed(2)}</Text>
                </View>
              ))
            ) : (
              <View className="p-4 items-center">
                <Text className="text-muted">No trend data</Text>
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
