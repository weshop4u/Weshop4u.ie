import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const orderId = Number(id);

  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>("Calculating...");

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ orderId });

  // Simulate driver location updates (in production, this would come from real-time updates)
  useEffect(() => {
    if (!order) return;

    const interval = setInterval(() => {
      // Simulate driver moving towards delivery location
      // In production, this would be replaced with real-time location updates from the driver's device

      // For now, use a simulated location near the delivery address
      setDriverLocation({
        latitude: parseFloat(order.deliveryLatitude || "0") + (Math.random() - 0.5) * 0.01,
        longitude: parseFloat(order.deliveryLongitude || "0") + (Math.random() - 0.5) * 0.01,
      });

      // Calculate estimated time (simplified)
      const distance = Math.random() * 5 + 1; // 1-6 km
      const time = Math.ceil(distance * 3); // ~3 minutes per km
      setEstimatedTime(`${time} min`);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [order]);

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

  const deliveryCoords = {
    latitude: parseFloat(order.deliveryLatitude || "0"),
    longitude: parseFloat(order.deliveryLongitude || "0"),
  };

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

      {/* Map */}
      <View className="flex-1">
        {Platform.OS === "web" ? (
          <View className="flex-1 bg-surface items-center justify-center">
            <Text className="text-muted text-center px-8">
              Map view is available on mobile devices.{"\n"}
              Download the Expo Go app to test this feature.
            </Text>
          </View>
        ) : (
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              ...deliveryCoords,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Delivery Location Marker */}
            <Marker
              coordinate={deliveryCoords}
              title="Delivery Location"
              description={order.deliveryAddress}
              pinColor="red"
            />

            {/* Driver Location Marker */}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title="Driver"
                description="Your driver is here"
                pinColor="blue"
              >
                <View className="bg-primary rounded-full p-3">
                  <Text className="text-2xl">🚗</Text>
                </View>
              </Marker>
            )}

            {/* Route Line */}
            {driverLocation && (
              <Polyline
                coordinates={[driverLocation, deliveryCoords]}
                strokeColor="#0a7ea4"
                strokeWidth={3}
              />
            )}
          </MapView>
        )}
      </View>

      {/* Status Card */}
      <View className="bg-background border-t border-border p-4">
        <View className="bg-surface rounded-xl p-4 border border-border">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">
                {getStatusText(order.status)}
              </Text>
              <Text className="text-muted">Estimated arrival: {estimatedTime}</Text>
            </View>
            <View className="bg-primary/10 rounded-full px-4 py-2">
              <Text className="text-primary font-bold">{estimatedTime}</Text>
            </View>
          </View>

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
