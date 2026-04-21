import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import Recharts components only on web
let LineChart: any, Line: any, BarChart: any, Bar: any, XAxis: any, YAxis: any, CartesianGrid: any, Tooltip: any, Legend: any, ResponsiveContainer: any;

if (typeof window !== "undefined") {
  try {
    const recharts = require("recharts");
    LineChart = recharts.LineChart;
    Line = recharts.Line;
    BarChart = recharts.BarChart;
    Bar = recharts.Bar;
    XAxis = recharts.XAxis;
    YAxis = recharts.YAxis;
    CartesianGrid = recharts.CartesianGrid;
    Tooltip = recharts.Tooltip;
    Legend = recharts.Legend;
    ResponsiveContainer = recharts.ResponsiveContainer;
  } catch (e) {
    // Recharts not available, will skip chart rendering
  }
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: "#f5f5f5",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: "#687076" }}>{label}</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#0F172A", marginTop: 2 }}>
          {value}
        </Text>
        {subValue && <Text style={{ fontSize: 11, color: "#687076", marginTop: 2 }}>{subValue}</Text>}
      </View>
    </View>
  );
}

export default function AdminAnalytics() {
  const [timePeriod, setTimePeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [productLimit, setProductLimit] = useState<number>(5);
  const [mostViewedTimePeriod, setMostViewedTimePeriod] = useState<"today" | "week" | "month" | "all">("week");
  const [mostViewedStoreId, setMostViewedStoreId] = useState<number | null>(null);
  const isDesktopWeb = Platform.OS === "web";

  // Convert "all" to null for backend, otherwise use number of days
  const daysParam = timePeriod === "all" ? null : parseInt(timePeriod);

  // Fetch stores for selector
  const { data: stores } = trpc.admin.getAllStoresAdmin.useQuery(undefined, { refetchInterval: 60000 });

  // Fetch analytics data for selected store or all stores
  const { data: topProducts, isLoading: topLoading } = trpc.admin.getTopProductsAnalytics.useQuery(
    { days: daysParam || 365, limit: productLimit, storeId: selectedStore },
    { refetchInterval: 60000 }
  );

  const { data: peakHours, isLoading: hoursLoading } = trpc.admin.getPeakHoursAnalytics.useQuery(
    { days: daysParam || 365, storeId: selectedStore },
    { refetchInterval: 60000 }
  );

  const { data: dailySales, isLoading: dailyLoading } = trpc.admin.getDailySalesAnalytics.useQuery(
    { days: daysParam || 365, storeId: selectedStore },
    { refetchInterval: 60000 }
  );

  // Fetch period-specific metrics
  const { data: metrics, isLoading: metricsLoading } = trpc.admin.getPeriodMetrics.useQuery(
    { days: daysParam, storeId: selectedStore },
    { refetchInterval: 60000 }
  );

  // Real-time Today's Metrics
  const { data: todayMetrics, isLoading: todayLoading } = trpc.admin.getTodayMetrics.useQuery(
    { storeId: selectedStore },
    { refetchInterval: 5 * 60 * 1000 } // Auto-refresh every 5 minutes
  );

  // Fetch most viewed products
  const { data: mostViewedProducts, isLoading: viewsLoading } = trpc.admin.getMostViewedProducts.useQuery(
    { timePeriod: mostViewedTimePeriod, limit: 10, storeId: mostViewedStoreId },
    { refetchInterval: 60000 }
  );

  // Use period-specific metrics
  const totalOrders = metrics?.totalOrders || 0;
  const totalRevenue = metrics?.totalRevenue || 0;
  const avgOrderValue = (metrics?.avgOrderValue || 0).toFixed(2);
  const peakHour = { hour: metrics?.peakHour || 0, count: metrics?.peakHourCount || 0 };

  const isLoading = topLoading || hoursLoading || dailyLoading || metricsLoading;

  // Format period label
  const getPeriodLabel = () => {
    if (timePeriod === "all") return "All Time";
    return `Last ${timePeriod} days`;
  };

  // Prepare chart data from daily sales
  const chartData = dailySales?.dailySales?.map((day) => ({
    date: new Date(day.date).toLocaleDateString("en-IE", { month: "short", day: "numeric" }),
    revenue: day.revenue,
    orders: day.count,
  })) || [];

  const content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Header */}
      <View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 16 }}>
          📊 Platform Analytics
        </Text>

        {/* Store Selector */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Store</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={() => setSelectedStore(null)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: selectedStore === null ? "#00E5FF" : "#f5f5f5",
                borderWidth: 1,
                borderColor: selectedStore === null ? "#00E5FF" : "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: selectedStore === null ? "#fff" : "#0F172A" }}>
                All Stores
              </Text>
            </Pressable>
            {stores?.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => setSelectedStore(store.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: selectedStore === store.id ? "#00E5FF" : "#f5f5f5",
                  borderWidth: 1,
                  borderColor: selectedStore === store.id ? "#00E5FF" : "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: selectedStore === store.id ? "#fff" : "#0F172A" }}>
                  {store.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Time Period Selector */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Last</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {["7", "30", "90", "all"].map((period) => (
              <Pressable
                key={period}
                onPress={() => setTimePeriod(period as "7" | "30" | "90" | "all")}
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
                  {period === "all" ? "All" : `${period}d`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Real-time Today's Metrics Widget */}
      {todayMetrics && !todayLoading && (
        <View style={{ backgroundColor: "#E8F4F8", borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: "#00E5FF" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>📱 Today's Metrics</Text>
            <Text style={{ fontSize: 10, color: "#00E5FF", fontWeight: "600" }}>Live</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ fontSize: 11, color: "#687076" }}>Orders</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#FF6B35", marginTop: 4 }}>{todayMetrics.totalOrders}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ fontSize: 11, color: "#687076" }}>Revenue</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#FF6B35", marginTop: 4 }}>€{todayMetrics.totalRevenue.toFixed(2)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ fontSize: 11, color: "#687076" }}>Delivered</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#FF6B35", marginTop: 4 }}>{todayMetrics.deliveredOrders}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: "#999", marginTop: 8 }}>Updates every 5 minutes</Text>
        </View>
      )}

      {isLoading ? (
        <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
      ) : (
        <>
          {/* Key Metrics */}
          <View style={{ gap: 12 }}>
            <MetricCard
              label="Total Orders"
              value={totalOrders}
              icon="📦"
              color="#00E5FF"
            />
            <MetricCard
              label="Total Revenue"
              value={`€${totalRevenue.toFixed(2)}`}
              icon="💰"
              color="#22C55E"
            />
            <MetricCard
              label="Avg Order Value"
              value={`€${avgOrderValue}`}
              icon="📈"
              color="#F59E0B"
            />
            <MetricCard
              label="Peak Hour"
              value={`${peakHour.hour}:00`}
              subValue={`${peakHour.count} orders`}
              icon="⏰"
              color="#8B5CF6"
            />
          </View>

          {/* Product Limit Selector - Moved here */}
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Top Products</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[5, 10, 20, 50].map((limit) => (
                <Pressable
                  key={limit}
                  onPress={() => setProductLimit(limit)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: productLimit === limit ? "#00E5FF" : "#f5f5f5",
                    borderWidth: 1,
                    borderColor: productLimit === limit ? "#00E5FF" : "#E5E7EB",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: productLimit === limit ? "#fff" : "#0F172A" }}>Top {limit}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Top Products */}
          {topProducts?.topProducts && topProducts.topProducts.length > 0 && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                🏆 Top Selling Products
              </Text>
              <View style={{ gap: 12 }}>
                {topProducts.topProducts.slice(0, productLimit).map((product, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderBottomWidth: idx < productLimit - 1 ? 1 : 0,
                      borderBottomColor: "#E5E7EB",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>
                        {idx + 1}. {product.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }}>
                        {product.quantity} sold • €{typeof product.revenue === 'number' ? product.revenue.toFixed(2) : parseFloat(product.revenue || '0').toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Hourly Breakdown */}
          {peakHours?.peakHours && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                ⏱️ Orders by Hour
              </Text>
              <View style={{ gap: 8 }}>
                {peakHours.peakHours
                  .filter((h) => (h.count || 0) > 0)
                  .slice(0, 12)
                  .map((hour) => (
                    <View key={hour.hour} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ width: 35, fontSize: 12, color: "#687076" }}>
                        {hour.hour}:00
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 24,
                          backgroundColor: "#00E5FF",
                          borderRadius: 4,
                          opacity: Math.min((hour.count || 0) / 10, 1),
                        }}
                      />
                      <Text style={{ width: 35, fontSize: 12, color: "#687076", textAlign: "right" }}>
                        {hour.count}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Revenue Trend Chart - Only render if Recharts is available */}
          {chartData && isDesktopWeb && chartData.length > 0 && ResponsiveContainer && LineChart && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                📈 Revenue Trend
              </Text>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#22C55E" name="Revenue (€)" />
                </LineChart>
              </ResponsiveContainer>
            </View>
          )}

          {/* Order Volume Chart - Only render if Recharts is available */}
          {chartData && isDesktopWeb && chartData.length > 0 && ResponsiveContainer && BarChart && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                📊 Order Volume
              </Text>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orders" fill="#00E5FF" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </View>
          )}

          {/* Daily Trend */}
          {dailySales?.dailySales && dailySales.dailySales.length > 0 && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                📅 Daily Sales Trend
              </Text>
              <View style={{ gap: 10 }}>
                {dailySales.dailySales.slice(-7).map((day) => (
                  <View key={day.date} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: "#687076" }}>
                      {new Date(day.date).toLocaleDateString("en-IE", { month: "short", day: "numeric" })}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#0F172A" }}>
                      {day.count} orders • €{day.revenue.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Most Viewed Products */}
          {mostViewedProducts?.mostViewedProducts && mostViewedProducts.mostViewedProducts.length > 0 && (
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>
                👁️ Most Viewed Products
              </Text>
              
              {/* Time Period Filter */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Time Period</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {["today", "week", "month", "all"].map((period) => (
                    <Pressable
                      key={period}
                      onPress={() => setMostViewedTimePeriod(period as "today" | "week" | "month" | "all")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        backgroundColor: mostViewedTimePeriod === period ? "#0a7ea4" : "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: mostViewedTimePeriod === period ? "#fff" : "#0F172A",
                        }}
                      >
                        {period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "All Time"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              {/* Store Filter */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>Store</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Pressable
                    onPress={() => setMostViewedStoreId(null)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 6,
                      backgroundColor: mostViewedStoreId === null ? "#0a7ea4" : "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: mostViewedStoreId === null ? "#fff" : "#0F172A",
                      }}
                    >
                      All Stores
                    </Text>
                  </Pressable>
                  {stores?.stores?.map((store) => (
                    <Pressable
                      key={store.id}
                      onPress={() => setMostViewedStoreId(store.id)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        backgroundColor: mostViewedStoreId === store.id ? "#0a7ea4" : "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: mostViewedStoreId === store.id ? "#fff" : "#0F172A",
                        }}
                      >
                        {store.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              <View style={{ gap: 12 }}>
                {mostViewedProducts.mostViewedProducts.slice(0, productLimit).map((product, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderBottomWidth: idx < productLimit - 1 ? 1 : 0,
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
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  if (isDesktopWeb) {
    return (
      <AdminDesktopLayout title="Analytics">
        {content}
      </AdminDesktopLayout>
    );
  }

  return (
    <ScreenContainer>
      {content}
    </ScreenContainer>
  );
}
