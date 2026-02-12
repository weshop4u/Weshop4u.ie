import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: earnings, isLoading } = trpc.drivers.getEarnings.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id }
  );

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

        {/* Today's Earnings - Highlighted */}
        <View style={{ backgroundColor: '#E0F7FA', borderWidth: 2, borderColor: '#0a7ea4', padding: 24, borderRadius: 12, marginBottom: 20 }}>
          <Text className="text-muted text-sm mb-2">Today's Earnings</Text>
          <Text style={{ color: '#0a7ea4', fontWeight: 'bold', fontSize: 36, marginBottom: 4 }}>
            €{earnings.todayEarnings.toFixed(2)}
          </Text>
          <Text className="text-muted">
            {earnings.todayDeliveries} deliver{earnings.todayDeliveries !== 1 ? 'ies' : 'y'} completed
          </Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface p-4 rounded-lg">
            <Text className="text-muted text-sm mb-1">This Week</Text>
            <Text className="text-foreground font-bold text-xl">
              €{earnings.weekEarnings.toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {earnings.weekDeliveries} deliver{earnings.weekDeliveries !== 1 ? 'ies' : 'y'}
            </Text>
          </View>

          <View className="flex-1 bg-surface p-4 rounded-lg">
            <Text className="text-muted text-sm mb-1">All Time</Text>
            <Text className="text-foreground font-bold text-xl">
              €{earnings.totalEarnings.toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {earnings.totalDeliveries} deliver{earnings.totalDeliveries !== 1 ? 'ies' : 'y'}
            </Text>
          </View>
        </View>

        {/* 7-Day Bar Chart */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Last 7 Days</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, paddingHorizontal: 4 }}>
            {earnings.dailyBreakdown.map((day, idx) => {
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

        {/* Recent Deliveries */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Recent Deliveries</Text>
          
          {earnings.recentDeliveries.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-muted text-center">No completed deliveries yet.</Text>
              <Text className="text-muted text-center text-sm mt-1">Your delivery history will appear here.</Text>
            </View>
          ) : (
            earnings.recentDeliveries.map((delivery, idx) => (
              <View
                key={delivery.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: idx < earnings.recentDeliveries.length - 1 ? 1 : 0,
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
                <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 18 }}>
                  €{delivery.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Payment Info */}
        <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', padding: 16, borderRadius: 12, marginBottom: 32 }}>
          <Text style={{ color: '#92400E', fontWeight: 'bold', marginBottom: 8 }}>💰 Payment Schedule</Text>
          <Text style={{ color: '#11181C', fontSize: 14 }}>
            Earnings are paid weekly every Monday via bank transfer.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
