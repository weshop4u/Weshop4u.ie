import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";

export default function DriverEarningsScreen() {
  const router = useRouter();

  // Mock earnings data - will be replaced with real data from backend
  const earnings = {
    today: { amount: 45.50, deliveries: 6 },
    thisWeek: { amount: 287.50, deliveries: 38 },
    thisMonth: { amount: 1142.00, deliveries: 152 },
    allTime: { amount: 5678.50, deliveries: 756 },
  };

  const recentDeliveries = [
    { id: 1, orderNumber: "WS4U-123456", store: "Spar Balbriggan", amount: 3.90, date: "2026-02-09 14:30" },
    { id: 2, orderNumber: "WS4U-123455", store: "Open All Ours", amount: 4.20, date: "2026-02-09 13:15" },
    { id: 3, orderNumber: "WS4U-123454", store: "Spar Balbriggan", amount: 3.50, date: "2026-02-09 12:00" },
    { id: 4, orderNumber: "WS4U-123453", store: "Open All Ours", amount: 5.70, date: "2026-02-09 11:30" },
    { id: 5, orderNumber: "WS4U-123452", store: "Spar Balbriggan", amount: 3.90, date: "2026-02-09 10:45" },
  ];

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-4 active:opacity-70"
          >
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">Earnings</Text>
          <Text className="text-muted">Track your delivery income</Text>
        </View>

        {/* Today's Earnings - Highlighted */}
        <View className="bg-primary/10 border-2 border-primary p-6 rounded-lg mb-6">
          <Text className="text-muted text-sm mb-2">Today's Earnings</Text>
          <Text className="text-primary font-bold text-4xl mb-2">
            €{earnings.today.amount.toFixed(2)}
          </Text>
          <Text className="text-muted">
            {earnings.today.deliveries} deliveries completed
          </Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface p-4 rounded-lg">
            <Text className="text-muted text-sm mb-1">This Week</Text>
            <Text className="text-foreground font-bold text-xl">
              €{earnings.thisWeek.amount.toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {earnings.thisWeek.deliveries} deliveries
            </Text>
          </View>

          <View className="flex-1 bg-surface p-4 rounded-lg">
            <Text className="text-muted text-sm mb-1">This Month</Text>
            <Text className="text-foreground font-bold text-xl">
              €{earnings.thisMonth.amount.toFixed(2)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {earnings.thisMonth.deliveries} deliveries
            </Text>
          </View>
        </View>

        {/* All-Time Stats */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">All-Time Stats</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Total Earnings</Text>
            <Text className="text-foreground font-bold text-lg">
              €{earnings.allTime.amount.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Total Deliveries</Text>
            <Text className="text-foreground font-semibold">
              {earnings.allTime.deliveries}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted">Average per Delivery</Text>
            <Text className="text-foreground font-semibold">
              €{(earnings.allTime.amount / earnings.allTime.deliveries).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Recent Deliveries */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Recent Deliveries</Text>
          
          {recentDeliveries.map((delivery) => (
            <View
              key={delivery.id}
              className="flex-row justify-between items-center py-3 border-b border-border last:border-b-0"
            >
              <View className="flex-1">
                <Text className="text-foreground font-semibold mb-1">
                  {delivery.orderNumber}
                </Text>
                <Text className="text-muted text-sm">{delivery.store}</Text>
                <Text className="text-muted text-xs">{delivery.date}</Text>
              </View>
              <Text className="text-primary font-bold text-lg">
                €{delivery.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Payment Info */}
        <View className="bg-warning/10 border border-warning p-4 rounded-lg mb-8">
          <Text className="text-warning font-bold mb-2">💰 Payment Schedule</Text>
          <Text className="text-foreground text-sm">
            Earnings are paid weekly every Monday via bank transfer. Next payment date: Feb 10, 2026
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
