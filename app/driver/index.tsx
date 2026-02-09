import { View, Text, TouchableOpacity, Switch, ScrollView, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function DriverHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);

  // Mock data - will be replaced with real data from backend
  const todayEarnings = 45.50;
  const todayDeliveries = 6;

  const handleToggleOnline = () => {
    setIsOnline(!isOnline);
    // TODO: Update driver status in backend
  };

  const handleSwitchToCustomerMode = async () => {
    Alert.alert(
      "Switch to Customer Mode",
      "You'll be able to browse stores and place orders. Switch now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            try {
              await AsyncStorage.setItem("appMode", "customer");
              router.replace("/" as any);
            } catch (error) {
              Alert.alert("Error", "Failed to switch mode");
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Driver Dashboard</Text>
          <Text className="text-muted">Welcome back!</Text>
        </View>

        {/* Online/Offline Toggle */}
        <View className="bg-surface p-6 rounded-lg mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-foreground font-bold text-xl mb-1">
                {isOnline ? "You're Online" : "You're Offline"}
              </Text>
              <Text className="text-muted text-sm">
                {isOnline 
                  ? "Ready to receive delivery requests" 
                  : "Toggle on to start receiving jobs"}
              </Text>
            </View>
            <View className={`w-20 h-10 rounded-full justify-center px-1 ${
              isOnline ? "bg-success" : "bg-border"
            }`}>
              <TouchableOpacity
                onPress={handleToggleOnline}
                className={`w-8 h-8 rounded-full bg-background shadow-lg ${
                  isOnline ? "self-end" : "self-start"
                }`}
              />
            </View>
          </View>

          {isOnline && (
            <View className="bg-success/10 p-3 rounded-lg border border-success">
              <Text className="text-success text-center font-semibold">
                🟢 Waiting for delivery requests...
              </Text>
            </View>
          )}
        </View>

        {/* Active Delivery Card */}
        {hasActiveDelivery && (
          <View className="bg-primary/10 border-2 border-primary p-4 rounded-lg mb-6">
            <Text className="text-primary font-bold text-lg mb-2">Active Delivery</Text>
            <Text className="text-foreground mb-3">
              Order #WS4U-123456 • Spar Balbriggan
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/driver/active-delivery")}
              className="bg-primary p-3 rounded-lg items-center active:opacity-70"
            >
              <Text className="text-background font-bold">View Delivery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's Stats */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Today's Summary</Text>
          
          <View className="flex-row justify-between mb-4">
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">Earnings</Text>
              <Text className="text-primary font-bold text-2xl">€{todayEarnings.toFixed(2)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">Deliveries</Text>
              <Text className="text-foreground font-bold text-2xl">{todayDeliveries}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/driver/earnings")}
            className="bg-primary/10 p-3 rounded-lg items-center active:opacity-70"
          >
            <Text className="text-primary font-semibold">View Full Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Your Stats</Text>
          
          <View className="space-y-3">
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Total Deliveries</Text>
              <Text className="text-foreground font-semibold">142</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Rating</Text>
              <Text className="text-foreground font-semibold">⭐ 4.9</Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-muted">This Week</Text>
              <Text className="text-foreground font-semibold">€287.50</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        {!isOnline && (
          <View className="bg-warning/10 border border-warning p-4 rounded-lg mb-6">
            <Text className="text-warning font-bold mb-2">💡 Getting Started</Text>
            <Text className="text-foreground text-sm leading-relaxed">
              Toggle "Online" to start receiving delivery requests. When a new job is available, 
              you'll have 15 seconds to accept or decline.
            </Text>
          </View>
        )}

        {/* Switch to Customer Mode */}
        <TouchableOpacity
          onPress={handleSwitchToCustomerMode}
          className="bg-surface border border-border p-4 rounded-lg mb-6 active:opacity-70"
        >
          <Text className="text-foreground font-semibold text-center">🛒 Switch to Customer Mode</Text>
          <Text className="text-muted text-sm text-center mt-1">Browse stores and place orders</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
