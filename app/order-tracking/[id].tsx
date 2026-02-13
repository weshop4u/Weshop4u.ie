import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

// No native maps dependency — this screen uses the Leaflet-based map
// in [orderId].tsx for real tracking. This is a legacy/fallback screen.

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const orderId = Number(id);

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ orderId });

  const getStatusText = (status: string) => {
    switch (status) {
      case "picked_up":
        return "Driver has picked up your order";
      case "on_the_way":
        return "Driver is on the way";
      default:
        return "Preparing your order";
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-bold text-foreground mb-2">Order Not Found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-8 py-3 rounded-full active:opacity-70 mt-4"
        >
          <Text className="text-background font-bold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Redirect to the main order tracking screen which has the full timeline + map
  useEffect(() => {
    router.replace(`/order-tracking/${orderId}` as any);
  }, [orderId]);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="px-4 py-4 bg-background border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mb-2"
        >
          <Text className="text-primary text-lg">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-foreground">Track Order</Text>
        <Text className="text-muted">Order #{order.orderNumber}</Text>
      </View>

      {/* Status Card */}
      <View className="flex-1 justify-center p-4">
        <View className="bg-surface rounded-xl p-6 border border-border">
          <View className="items-center mb-4">
            <Text style={{ fontSize: 48 }}>📦</Text>
          </View>
          <Text className="text-lg font-bold text-foreground text-center mb-2">
            {getStatusText(order.status)}
          </Text>
          <Text className="text-muted text-center mb-4">
            Redirecting to full tracking view...
          </Text>

          <View className="border-t border-border pt-3">
            <Text className="text-sm text-muted mb-1">Delivery Address</Text>
            <Text className="text-foreground">{order.deliveryAddress}</Text>
          </View>

          <View className="border-t border-border pt-3 mt-3">
            <Text className="text-sm text-muted mb-1">Order Total</Text>
            <Text className="text-xl font-bold text-foreground">€{order.total}</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
