import { View, Text, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? parseInt(params.orderId as string) : null;
  
  const { data: order, isLoading } = trpc.orders.getById.useQuery(
    { orderId: orderId! },
    { enabled: !!orderId }
  );
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();
  
  const [deliveryStatus, setDeliveryStatus] = useState<"going_to_store" | "at_store" | "going_to_customer" | "delivered">("going_to_store");

  const openNavigation = (latitude: string | null, longitude: string | null, label: string) => {
    if (!latitude || !longitude) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`;
    Linking.openURL(url).catch((error) => {
      console.error("Could not open navigation app:", error);
    });
  };

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch((error) => {
      console.error("Could not make phone call:", error);
    });
  };

  const handlePickedUp = async () => {
    if (!orderId) return;
    
    try {
      await updateStatusMutation.mutateAsync({
        orderId,
        status: "picked_up",
      });
      setDeliveryStatus("going_to_customer");
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const handleDelivered = async () => {
    if (!orderId) return;
    
    try {
      await updateStatusMutation.mutateAsync({
        orderId,
        status: "delivered",
      });
      setDeliveryStatus("delivered");
      // Navigate back to driver dashboard
      setTimeout(() => {
        router.push("/driver");
      }, 1000);
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const getStatusDisplay = () => {
    switch (deliveryStatus) {
      case "going_to_store":
        return { emoji: "🏪", text: "Going to Store", color: "text-primary" };
      case "at_store":
        return { emoji: "📦", text: "At Store - Pick Up Order", color: "text-warning" };
      case "going_to_customer":
        return { emoji: "🚗", text: "Delivering to Customer", color: "text-primary" };
      case "delivered":
        return { emoji: "✅", text: "Delivered", color: "text-success" };
    }
  };

  const status = getStatusDisplay();

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-foreground text-lg mb-4">Order not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-lg active:opacity-70"
        >
          <Text className="text-background font-bold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Extract real data from order
  const storeName = order.store?.name || "Store";
  const storeAddress = order.store?.address || "Address unavailable";
  const storePhone = order.store?.phone || "";
  const storeLat = order.store?.latitude || null;
  const storeLng = order.store?.longitude || null;
  const customerAddress = order.deliveryAddress || "Address unavailable";
  const customerPhone = order.guestPhone || "";
  const customerLat = order.deliveryLatitude || null;
  const customerLng = order.deliveryLongitude || null;
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const orderTotal = parseFloat(order.total || "0");
  const paymentMethod = order.paymentMethod || "card";
  const customerNotes = order.customerNotes || null;
  const orderNumber = order.orderNumber || `Order #${order.id}`;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mb-4"
        >
          <Text className="text-primary text-lg">‹ Back to Available Jobs</Text>
        </TouchableOpacity>

        {/* Status Header */}
        <View className="bg-primary/10 border-2 border-primary p-4 rounded-lg mb-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Active Delivery</Text>
              <Text className="text-foreground font-bold text-xl">{orderNumber}</Text>
            </View>
            <Text className="text-4xl">{status.emoji}</Text>
          </View>
          <View className="mt-3 bg-background p-3 rounded-lg">
            <Text className={`${status.color} font-bold text-center`}>{status.text}</Text>
          </View>
        </View>

        {/* Customer Notes - ALWAYS visible at the top */}
        {customerNotes && (
          <View className="bg-warning/10 border border-warning p-4 rounded-lg mb-6">
            <Text className="text-warning font-bold text-sm mb-1">📝 Customer Notes:</Text>
            <Text className="text-foreground text-base">{customerNotes}</Text>
          </View>
        )}

        {/* Store Information */}
        {(deliveryStatus === "going_to_store" || deliveryStatus === "at_store") && (
          <View className="bg-surface p-4 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-3">📍 Pick Up Location</Text>
            
            <Text className="text-foreground font-semibold mb-1">{storeName}</Text>
            <Text className="text-muted text-sm mb-3">{storeAddress}</Text>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openNavigation(storeLat, storeLng, storeName)}
                className="flex-1 bg-primary p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-semibold">🗺️ Navigate</Text>
              </TouchableOpacity>
              {storePhone ? (
                <TouchableOpacity
                  onPress={() => callPhone(storePhone)}
                  className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-foreground font-semibold">📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {deliveryStatus === "going_to_store" && (
              <TouchableOpacity
                onPress={handlePickedUp}
                className="mt-3 bg-success p-4 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-bold text-lg">✓ Picked Up Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer Information */}
        {deliveryStatus === "going_to_customer" && (
          <View className="bg-surface p-4 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-3">🏠 Delivery Location</Text>
            
            <Text className="text-muted text-sm mb-3">{customerAddress}</Text>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openNavigation(customerLat, customerLng, "Customer")}
                className="flex-1 bg-primary p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-semibold">🗺️ Navigate</Text>
              </TouchableOpacity>
              {customerPhone ? (
                <TouchableOpacity
                  onPress={() => callPhone(customerPhone)}
                  className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-foreground font-semibold">📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleDelivered}
              className="mt-3 bg-success p-4 rounded-lg items-center active:opacity-70"
            >
              <Text className="text-background font-bold text-lg">✓ Delivery Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Complete Message */}
        {deliveryStatus === "delivered" && (
          <View className="bg-success/10 border border-success p-4 rounded-lg mb-6 items-center">
            <Text className="text-success font-bold text-xl mb-2">🎉 Delivery Complete!</Text>
            <Text className="text-muted text-center">Redirecting to dashboard...</Text>
          </View>
        )}

        {/* Order Items */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Order Items</Text>
          {order.items && order.items.length > 0 ? (
            order.items.map((item: any, index: number) => (
              <View key={index} className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-foreground">{item.quantity}x {item.productName || `Item #${item.productId}`}</Text>
                <Text className="text-muted">€{parseFloat(item.subtotal || "0").toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <Text className="text-muted">No items available</Text>
          )}
        </View>

        {/* Payment Information */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Payment Details</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Payment Method</Text>
            <Text className="text-foreground font-semibold">
              {paymentMethod === "card" ? "Card (Paid)" : "Cash on Delivery"}
            </Text>
          </View>

          {paymentMethod === "cash_on_delivery" && (
            <View className="bg-warning/10 border border-warning p-3 rounded-lg mt-2">
              <Text className="text-warning font-bold mb-1">💰 Collect Cash</Text>
              <Text className="text-foreground">
                Collect <Text className="font-bold">€{orderTotal.toFixed(2)}</Text> from customer
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mt-3 pt-3 border-t border-border">
            <Text className="text-muted">Order Total</Text>
            <Text className="text-foreground font-semibold">€{orderTotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-muted">Your Earnings</Text>
            <Text className="text-primary font-bold text-lg">€{deliveryFee.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
