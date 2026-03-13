import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

interface AnalyticsProps {
  storeId: number;
}

export function AnalyticsDashboard({ storeId }: AnalyticsProps) {
  const colors = useColors();
  const [timePeriod, setTimePeriod] = useState<"7" | "30" | "90">("30");

  // Fetch analytics data
  const { data: topProducts, isLoading: topLoading } = trpc.store.getTopProducts.useQuery(
    { storeId, days: parseInt(timePeriod), limit: 10 },
    { enabled: !!storeId }
  );

  const { data: peakHours, isLoading: hoursLoading } = trpc.store.getPeakHours.useQuery(
    { storeId, days: parseInt(timePeriod) },
    { enabled: !!storeId }
  );

  const { data: dailySales, isLoading: dailyLoading } = trpc.store.getDailySales.useQuery(
    { storeId, days: parseInt(timePeriod) },
    { enabled: !!storeId }
  );

  const { data: stats } = trpc.store.getStats.useQuery(
    { storeId },
    { enabled: !!storeId }
  );

  // Calculate metrics
  const totalOrders = stats?.completedOrders || 0;
  const totalRevenue = stats?.totalRevenue || 0;
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00";

  // Find peak hour
  const peakHour = peakHours?.peakHours?.reduce((max, curr) =>
    curr.count > max.count ? curr : max
  ) || { hour: 0, count: 0 };

  const isLoading = topLoading || hoursLoading || dailyLoading;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* Header */}
        <View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 8 }}>
            📊 Analytics
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Last {timePeriod} days
          </Text>
        </View>

        {/* Time Period Selector */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["7", "30", "90"] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setTimePeriod(period)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: timePeriod === period ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: timePeriod === period ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: timePeriod === period ? "#fff" : colors.foreground,
                  textAlign: "center",
                }}
              >
                {period}d
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 20 }}>
            Loading analytics...
          </Text>
        ) : (
          <>
            {/* Key Metrics */}
            <View style={{ gap: 8 }}>
              <MetricCard
                label="Total Orders"
                value={totalOrders.toString()}
                icon="📦"
                color={colors.primary}
              />
              <MetricCard
                label="Total Revenue"
                value={`€${totalRevenue.toFixed(2)}`}
                icon="💰"
                color={colors.success}
              />
              <MetricCard
                label="Avg Order Value"
                value={`€${avgOrderValue}`}
                icon="📈"
                color={colors.warning}
              />
              <MetricCard
                label="Peak Hour"
                value={`${peakHour.hour}:00`}
                icon="⏰"
                color={colors.primary}
              />
            </View>

            {/* Top Products */}
            {topProducts?.topProducts && topProducts.topProducts.length > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
                  🏆 Top Selling Products
                </Text>
                <View style={{ gap: 8 }}>
                  {topProducts.topProducts.slice(0, 5).map((product, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: idx < 4 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>
                          {idx + 1}. {product.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                          {product.quantity} sold • €{product.revenue.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Hourly Breakdown */}
            {peakHours?.peakHours && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
                  ⏱️ Orders by Hour
                </Text>
                <View style={{ gap: 4 }}>
                  {peakHours.peakHours
                    .filter((h) => h.count > 0)
                    .slice(0, 12)
                    .map((hour) => (
                      <View key={hour.hour} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ width: 30, fontSize: 11, color: colors.muted }}>
                          {hour.hour}:00
                        </Text>
                        <View
                          style={{
                            flex: 1,
                            height: 20,
                            backgroundColor: colors.primary,
                            borderRadius: 4,
                            opacity: Math.min(hour.count / 10, 1),
                          }}
                        />
                        <Text style={{ width: 30, fontSize: 11, color: colors.muted, textAlign: "right" }}>
                          {hour.count}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Daily Trend */}
            {dailySales?.dailySales && dailySales.dailySales.length > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
                  📅 Daily Sales Trend
                </Text>
                <View style={{ gap: 6 }}>
                  {dailySales.dailySales.slice(-7).map((day) => (
                    <View key={day.date} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {new Date(day.date).toLocaleDateString("en-IE", { month: "short", day: "numeric" })}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}>
                        {day.count} orders • €{day.revenue.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginTop: 2 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
