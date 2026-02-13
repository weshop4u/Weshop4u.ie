import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

type TabType = "today" | "week" | "all";

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const { data: earnings, isLoading } = trpc.drivers.getEarnings.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id }
  );

  // Filter deliveries based on active tab
  const filteredDeliveries = useMemo(() => {
    if (!earnings?.recentDeliveries) return [];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (activeTab === "today") {
      return earnings.recentDeliveries.filter((d) => {
        const dDate = d.completedAt ? new Date(d.completedAt).toISOString().split("T")[0] : null;
        return dDate === todayStr;
      });
    }
    if (activeTab === "week") {
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return earnings.recentDeliveries.filter((d) => {
        const dDate = d.completedAt ? new Date(d.completedAt) : null;
        return dDate && dDate >= weekStart;
      });
    }
    return earnings.recentDeliveries;
  }, [earnings, activeTab]);

  const tabSummary = useMemo(() => {
    if (!earnings) return { earnings: 0, tips: 0, deliveries: 0 };
    if (activeTab === "today") return { earnings: earnings.todayEarnings, tips: earnings.todayTips, deliveries: earnings.todayDeliveries };
    if (activeTab === "week") return { earnings: earnings.weekEarnings, tips: earnings.weekTips, deliveries: earnings.weekDeliveries };
    return { earnings: earnings.totalEarnings, tips: earnings.totalTips, deliveries: earnings.totalDeliveries };
  }, [earnings, activeTab]);

  if (isLoading || !earnings) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-muted mt-4">Loading earnings...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Find the max daily earnings for the bar chart scaling
  const maxDailyEarnings = Math.max(...earnings.dailyBreakdown.map(d => d.earnings), 1);

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 16 }}
          >
            <Text style={{ color: '#0a7ea4', fontSize: 18 }}>← Back to Dashboard</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">Earnings</Text>
          <Text className="text-muted">Track your delivery income</Text>
        </View>

        {/* Earnings Hero Card */}
        <View style={{ backgroundColor: '#0a7ea4', borderRadius: 16, padding: 24, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
            {activeTab === 'today' ? "TODAY'S EARNINGS" : activeTab === 'week' ? 'THIS WEEK' : 'ALL TIME'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 42, fontWeight: '800', marginTop: 4 }}>
            €{tabSummary.earnings.toFixed(2)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Deliveries</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{tabSummary.deliveries}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Tips</Text>
              <Text style={{ color: '#00E5FF', fontSize: 18, fontWeight: '700' }}>€{tabSummary.tips.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Avg/Delivery</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                €{tabSummary.deliveries > 0 ? (tabSummary.earnings / tabSummary.deliveries).toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </View>

        {/* Period Tabs */}
        <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 3 }}>
          {(['today', 'week', 'all'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: activeTab === tab ? '#fff' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: activeTab === tab ? '700' : '500',
                color: activeTab === tab ? '#11181C' : '#687076',
              }}>
                {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 7-Day Bar Chart */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Last 7 Days</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, paddingHorizontal: 4 }}>
            {earnings.dailyBreakdown.map((day) => {
              const barHeight = day.earnings > 0 ? Math.max((day.earnings / maxDailyEarnings) * 90, 8) : 4;
              const isToday = day.dayLabel === "Today";
              return (
                <View key={day.date} style={{ alignItems: 'center', flex: 1 }}>
                  {day.earnings > 0 && (
                    <Text style={{ fontSize: 9, color: '#687076', marginBottom: 2, fontWeight: '600' }}>
                      €{day.earnings.toFixed(0)}
                    </Text>
                  )}
                  <View
                    style={{
                      width: 28,
                      height: barHeight,
                      backgroundColor: isToday ? '#0a7ea4' : day.earnings > 0 ? '#B2EBF2' : '#E5E7EB',
                      borderRadius: 4,
                    }}
                  />
                  <Text style={{ fontSize: 10, color: isToday ? '#0a7ea4' : '#687076', marginTop: 4, fontWeight: isToday ? '700' : '500' }}>
                    {day.dayLabel}
                  </Text>
                  {day.deliveries > 0 && (
                    <Text style={{ fontSize: 9, color: '#9BA1A6' }}>
                      {day.deliveries}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* All-Time Stats */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Stats Overview</Text>
          
          <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
            <Text className="text-muted">Total Earnings</Text>
            <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 18 }}>
              €{earnings.totalEarnings.toFixed(2)}
            </Text>
          </View>

          {(earnings.totalTips || 0) > 0 && (
            <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
              <Text className="text-muted">Total Tips Received</Text>
              <Text style={{ color: '#0a7ea4', fontWeight: 'bold', fontSize: 16 }}>
                €{(earnings.totalTips || 0).toFixed(2)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
            <Text className="text-muted">Total Deliveries</Text>
            <Text className="text-foreground font-semibold">
              {earnings.totalDeliveries}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted">Average per Delivery</Text>
            <Text className="text-foreground font-semibold">
              €{earnings.averagePerDelivery.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Delivery History */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Delivery History ({filteredDeliveries.length})</Text>
          
          {filteredDeliveries.length === 0 ? (
            <View className="py-8 items-center">
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🚗</Text>
              <Text className="text-muted text-center">
                {activeTab === 'today' ? 'No deliveries today yet' : activeTab === 'week' ? 'No deliveries this week' : 'No deliveries yet'}
              </Text>
            </View>
          ) : (
            filteredDeliveries.map((delivery, idx) => (
              <View
                key={delivery.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: idx < filteredDeliveries.length - 1 ? 1 : 0,
                  borderBottomColor: '#E5E7EB',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text className="text-foreground font-semibold mb-1">
                    {delivery.storeName}
                  </Text>
                  <Text className="text-muted text-xs">
                    {delivery.orderNumber}
                  </Text>
                  {delivery.completedAt && (
                    <Text className="text-muted text-xs">
                      {new Date(delivery.completedAt).toLocaleDateString('en-IE', { 
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 18 }}>
                    €{delivery.amount.toFixed(2)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    <Text style={{ fontSize: 11, color: '#687076' }}>Fee: €{delivery.baseFee.toFixed(2)}</Text>
                    {(delivery.tip || 0) > 0 && (
                      <Text style={{ color: '#0a7ea4', fontSize: 11, fontWeight: '600' }}>Tip: €{delivery.tip.toFixed(2)}</Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Payment Info */}
        <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', padding: 16, borderRadius: 12, marginBottom: 32 }}>
          <Text style={{ color: '#92400E', fontWeight: 'bold', marginBottom: 8 }}>💰 Payment Schedule</Text>
          <Text style={{ color: '#11181C', fontSize: 14 }}>
            Earnings are paid weekly every Monday via bank transfer. Tips are included in your weekly payout.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
