import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const orderIdNum = parseInt(orderId);

  const { data: order, isLoading, refetch } = trpc.orders.getById.useQuery({ orderId: orderIdNum });

  // Auto-refresh order status every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-muted mt-4">Loading order details...</Text>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-2xl mb-4">❌</Text>
        <Text className="text-foreground text-lg mb-2">Order not found</Text>
        <TouchableOpacity
          onPress={() => router.push("/")}
          className="bg-primary px-6 py-3 rounded-lg mt-4 active:opacity-70"
        >
          <Text className="text-background font-semibold">Back to Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Order status progression
  const statusSteps = [
    { key: "pending", label: "Order Placed", emoji: "📝" },
    { key: "accepted", label: "Store Accepted", emoji: "✅" },
    { key: "preparing", label: "Preparing", emoji: "👨‍🍳" },
    { key: "ready_for_pickup", label: "Ready for Pickup", emoji: "📦" },
    { key: "picked_up", label: "Driver Picked Up", emoji: "🚗" },
    { key: "on_the_way", label: "On the Way", emoji: "🛵" },
    { key: "delivered", label: "Delivered", emoji: "🎉" },
  ];

  const currentStatusIndex = statusSteps.findIndex(step => step.key === order.status);
  const isCancelled = order.status === "cancelled";

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
          <Text className="text-2xl font-bold text-foreground mb-2">Track Order</Text>
          <Text className="text-muted">Order #{order.orderNumber}</Text>
        </View>

        {/* Cancelled Status */}
        {isCancelled && (
          <View className="bg-error/10 border border-error p-4 rounded-lg mb-6">
            <View className="flex-row items-center">
              <Text className="text-4xl mr-3">❌</Text>
              <View className="flex-1">
                <Text className="text-error font-bold text-lg">Order Cancelled</Text>
                {order.cancellationReason && (
                  <Text className="text-error text-sm mt-1">{order.cancellationReason}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Status Progress */}
        {!isCancelled && (
          <View className="bg-surface p-6 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-6">Order Status</Text>
            
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isLast = index === statusSteps.length - 1;

              return (
                <View key={step.key}>
                  <View className="flex-row items-center">
                    {/* Status Icon */}
                    <View className={`w-12 h-12 rounded-full items-center justify-center ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}>
                      {isCompleted ? (
                        <Text className="text-2xl">{step.emoji}</Text>
                      ) : (
                        <View className="w-3 h-3 rounded-full bg-muted" />
                      )}
                    </View>

                    {/* Status Label */}
                    <View className="flex-1 ml-4">
                      <Text className={`font-semibold ${
                        isCompleted ? "text-foreground" : "text-muted"
                      }`}>
                        {step.label}
                      </Text>
                      {isCurrent && (
                        <Text className="text-primary text-sm mt-1">In Progress</Text>
                      )}
                    </View>

                    {/* Current Indicator */}
                    {isCurrent && (
                      <View className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </View>

                  {/* Connector Line */}
                  {!isLast && (
                    <View className={`w-0.5 h-8 ml-6 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Delivery Information */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Delivery Information</Text>
          
          <View className="mb-3">
            <Text className="text-muted text-sm">Delivery Address</Text>
            <Text className="text-foreground">{order.deliveryAddress}</Text>
          </View>

          {order.deliveryDistance && (
            <View className="mb-3">
              <Text className="text-muted text-sm">Distance</Text>
              <Text className="text-foreground">{parseFloat(order.deliveryDistance).toFixed(2)} km</Text>
            </View>
          )}

          <View className="mb-3">
            <Text className="text-muted text-sm">Payment Method</Text>
            <Text className="text-foreground">
              {order.paymentMethod === "card" ? "Card Payment" : "Cash on Delivery"}
            </Text>
          </View>

          {order.customerNotes && (
            <View>
              <Text className="text-muted text-sm">Order Notes</Text>
              <Text className="text-foreground">{order.customerNotes}</Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Order Items</Text>
          {order.items.map((item: any) => (
            <View key={item.id} className="flex-row justify-between mb-2">
              <Text className="text-foreground flex-1">
                {item.quantity}x {item.productName}
              </Text>
              <Text className="text-foreground">
                €{parseFloat(item.subtotal).toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View className="border-t border-border mt-3 pt-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-muted text-sm">Subtotal</Text>
              <Text className="text-muted text-sm">€{parseFloat(order.subtotal).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-muted text-sm">Service Fee</Text>
              <Text className="text-muted text-sm">€{parseFloat(order.serviceFee).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-sm">Delivery Fee</Text>
              <Text className="text-muted text-sm">€{parseFloat(order.deliveryFee).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-foreground font-bold">Total</Text>
              <Text className="text-primary font-bold">€{parseFloat(order.total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Timestamps */}
        <View className="bg-surface p-4 rounded-lg mb-8">
          <Text className="text-foreground font-bold text-lg mb-3">Timeline</Text>
          
          <View className="mb-2">
            <Text className="text-muted text-sm">Order Placed</Text>
            <Text className="text-foreground">
              {new Date(order.createdAt).toLocaleString()}
            </Text>
          </View>

          {order.acceptedAt && (
            <View className="mb-2">
              <Text className="text-muted text-sm">Accepted by Store</Text>
              <Text className="text-foreground">
                {new Date(order.acceptedAt).toLocaleString()}
              </Text>
            </View>
          )}

          {order.pickedUpAt && (
            <View className="mb-2">
              <Text className="text-muted text-sm">Picked Up by Driver</Text>
              <Text className="text-foreground">
                {new Date(order.pickedUpAt).toLocaleString()}
              </Text>
            </View>
          )}

          {order.deliveredAt && (
            <View className="mb-2">
              <Text className="text-muted text-sm">Delivered</Text>
              <Text className="text-foreground">
                {new Date(order.deliveredAt).toLocaleString()}
              </Text>
            </View>
          )}

          {order.cancelledAt && (
            <View className="mb-2">
              <Text className="text-error text-sm">Cancelled</Text>
              <Text className="text-error">
                {new Date(order.cancelledAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={() => router.push("/")}
          className="bg-primary p-4 rounded-lg items-center mb-8 active:opacity-70"
        >
          <Text className="text-background font-bold text-lg">Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
