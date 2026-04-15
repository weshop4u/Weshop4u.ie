import { View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

  // Fetch chart data
  const { data: chartData, isLoading: chartLoading } = trpc.admin.getDailySalesChartData.useQuery(
    { days: daysParam || 30, storeId: selectedStore },
    { refetchInterval: 60000 }
  );

  // Fetch today's metrics for real-time widget
  const { data: todayMetrics, isLoading: todayLoading } = trpc.admin.getTodayMetrics.useQuery(
    { storeId: selectedStore },
    { refetchInterval: 300000 }
  );

  // Use period-specific metrics
  const totalOrders = metrics?.totalOrders || 0;
  const totalRevenue = metrics?.totalRevenue || 0;
  const avgOrderValue = (metrics?.avgOrderValue || 0).toFixed(2);
  const peakHour = { hour: metrics?.peakHour || 0, count: metrics?.peakHourCount || 0 };

  const isLoading = topLoading || hoursLoading || dailyLoading || metricsLoading || chartLoading || todayLoading;

  // Format period label
  const getPeriodLabel = () => {
    if (timePeriod === "all") return "All Time";
    return `Last ${timePeriod} days`;
  };

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
              <Text style={{ fontSize: 12, fontWeight: "600", color: selectedStore === null ? "#fff" : "#0F172A" }}>General</Text>
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
                <Text style={{ fontSize: 12, fontWeight: "600", color: selectedStore === store.id ? "#fff" : "#0F172A" }}>{store.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={{ fontSize: 12, color: "#687076" }}>
          {getPeriodLabel()}
        </Text>
      </View>

      {/* Time Period Selector */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["7", "30", "90", "all"] as const).map((period) => (
          <Pressable
            key={period}
            onPress={() => setTimePeriod(period)}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: timePeriod === period ? "#00E5FF" : "#f5f5f5",
              borderWidth: 1,
              borderColor: timePeriod === period ? "#00E5FF" : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: timePeriod === period ? "#fff" : "#0F172A",
                textAlign: "center",
              }}
            >
              {period === "all" ? "All" : `${period}d`}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={{ color: "#687076", marginTop: 12 }}>Loading analytics...</Text>
        </View>
      ) : (
        <>
          {/* Real-time Today's Metrics Widget */}
          {todayMetrics && isDesktopWeb && (
            <View style={{ backgroundColor: "#FFF8F0", borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: "#FF6B35" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>🔴 Today's Metrics (Live)</Text>
              <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
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

          {/* Revenue Trend Chart */}
          {chartData && isDesktopWeb && chartData.length > 0 && (
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

          {/* Order Volume Chart */}
          {chartData && isDesktopWeb && chartData.length > 0 && (
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
