import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/lib/cart-provider";
import * as Notifications from "expo-notifications";
import { Alert, AppState } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/hooks/use-auth";

const isExpoGo = Constants.appOwnership === "expo";

// Estimate delivery time based on status and distance
function getEstimatedTime(order: any): string | null {
  const status = order.status;
  // Only show estimate for active in-transit statuses
  if (["delivered", "cancelled", "pending"].includes(status)) return null;
  
  // Base estimate: ~3 min per km for driving + prep time
  const distanceKm = order.estimatedDistance ? parseFloat(order.estimatedDistance) : 3;
  const drivingMinutes = Math.ceil(distanceKm * 3); // ~3 min/km in town
  
  switch (status) {
    case "accepted":
      return `~${drivingMinutes + 15}-${drivingMinutes + 25} min`; // prep + drive
    case "preparing":
      return `~${drivingMinutes + 10}-${drivingMinutes + 20} min`; // finishing prep + drive
    case "ready_for_pickup":
      return `~${drivingMinutes + 5}-${drivingMinutes + 15} min`; // waiting for driver + drive
    case "picked_up":
    case "on_the_way":
      return `~${drivingMinutes}-${drivingMinutes + 10} min`; // driving only
    default:
      return null;
  }
}

// Status change notification messages
const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  accepted: { title: "Order Accepted! ✅", body: "The store has accepted your order and will start preparing it soon." },
  preparing: { title: "Being Prepared 👨‍🍳", body: "Your order is now being prepared at the store." },
  ready_for_pickup: { title: "Ready for Pickup 📦", body: "Your order is ready and waiting for a driver." },
  picked_up: { title: "Order Picked Up! 🚗", body: "A driver has picked up your order from the store." },
  on_the_way: { title: "On The Way! 🛣️", body: "Your order is on its way to you!" },
  delivered: { title: "Delivered! 🎉", body: "Your order has been delivered. Enjoy!" },
};

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: "📋" },
  { key: "accepted", label: "Store Accepted", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready_for_pickup", label: "Ready for Pickup", icon: "📦" },
  { key: "picked_up", label: "Picked Up", icon: "🚗" },
  { key: "on_the_way", label: "On The Way", icon: "🛣️" },
  { key: "delivered", label: "Delivered", icon: "🎉" },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function isActiveOrder(status: string): boolean {
  return !["delivered", "cancelled"].includes(status);
}

function formatTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Star rating component
function StarRating({
  rating,
  onRate,
  size = 32,
}: {
  rating: number;
  onRate?: (r: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRate?.(star)}
          disabled={!onRate}
          style={{ padding: 4 }}
        >
          <Text style={{ fontSize: size, opacity: star <= rating ? 1 : 0.25 }}>
            ⭐
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Status timeline component
function StatusTimeline({ order }: { order: any }) {
  const currentIdx = getStepIndex(order.status);

  const getTimestamp = (stepKey: string): string => {
    switch (stepKey) {
      case "pending":
        return formatTime(order.createdAt);
      case "accepted":
        return formatTime(order.acceptedAt);
      case "picked_up":
      case "on_the_way":
        return formatTime(order.pickedUpAt);
      case "delivered":
        return formatTime(order.deliveredAt);
      default:
        return "";
    }
  };

  return (
    <View style={{ paddingVertical: 8 }}>
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const timestamp = getTimestamp(step.key);

        return (
          <View key={step.key} style={{ flexDirection: "row", marginBottom: idx < STATUS_STEPS.length - 1 ? 0 : 0 }}>
            {/* Timeline line + dot */}
            <View style={{ alignItems: "center", width: 32 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: isCompleted ? "#0a7ea4" : "#E5E7EB",
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: isCurrent ? "#0a7ea4" : "transparent",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isCompleted && (
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</Text>
                )}
              </View>
              {idx < STATUS_STEPS.length - 1 && (
                <View
                  style={{
                    width: 2,
                    height: 28,
                    backgroundColor: idx < currentIdx ? "#0a7ea4" : "#E5E7EB",
                  }}
                />
              )}
            </View>

            {/* Label */}
            <View style={{ flex: 1, paddingLeft: 8, paddingBottom: idx < STATUS_STEPS.length - 1 ? 8 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 13 }}>{step.icon}</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isCurrent ? "bold" : "normal",
                    color: isCompleted ? "#11181C" : "#9BA1A6",
                  }}
                >
                  {step.label}
                </Text>
                {timestamp ? (
                  <Text style={{ fontSize: 11, color: "#9BA1A6", marginLeft: "auto" }}>
                    {timestamp}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState<Set<number>>(new Set());
  const { clearCart, addToCart } = useCart();

  // Track last known statuses for notification triggers
  const lastStatusesRef = useRef<Record<number, string>>({});

  // Fetch user's orders with auto-refresh for active orders (only when authenticated)
  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds for real-time tracking
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <View className="w-32 h-32 bg-primary rounded-full items-center justify-center mb-4">
            <Text className="text-6xl">📦</Text>
          </View>
          <Text className="text-3xl font-bold text-foreground text-center">
            Log In to Continue
          </Text>
          <Text className="text-base text-muted text-center">
            Create an account or log in to track orders, save addresses, and enjoy faster checkout
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/auth/login" as any)}
            style={{
              backgroundColor: "#0a7ea4",
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 25,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/auth/signup" as any)}
            style={{
              paddingHorizontal: 32,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: "#0a7ea4", fontSize: 16, fontWeight: "600" }}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Listen for push notifications to trigger immediate refetch
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isExpoGo) return; // Skip in Expo Go
    let subscription: Notifications.Subscription | null = null;
    try {
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        if (data?.type === "order_update") {
          refetch();
        }
      });
    } catch (e) {
      console.log("[Push] Could not add notification listener");
    }

    return () => subscription?.remove();
  }, [refetch]);

  // Refetch when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // Send local notification when order status changes
  useEffect(() => {
    if (!orders || Platform.OS === "web") return;
    const prevStatuses = lastStatusesRef.current;
    for (const order of orders) {
      const prevStatus = prevStatuses[order.id];
      if (prevStatus && prevStatus !== order.status && STATUS_MESSAGES[order.status]) {
        const msg = STATUS_MESSAGES[order.status];
        if (!isExpoGo) {
          try {
            Notifications.scheduleNotificationAsync({
              content: {
                title: msg.title,
                body: `${order.store?.name || "Store"} - ${msg.body}`,
                sound: true,
              },
              trigger: null, // Immediate
            });
          } catch (e) {
            console.log("[Push] Could not schedule notification");
          }
        }
      }
      prevStatuses[order.id] = order.status;
    }
    lastStatusesRef.current = prevStatuses;
  }, [orders]);

  const rateDriverMutation = trpc.orders.rateDriver.useMutation({
    onSuccess: (_, variables) => {
      setRatingSubmitted((prev) => new Set([...prev, variables.orderId]));
      setRatingOrderId(null);
      setSelectedRating(0);
      setRatingComment("");
      refetch();
    },
  });

  const cancelOrderMutation = trpc.orders.cancelOrder.useMutation({
    onSuccess: () => {
      Alert.alert("Order Cancelled", "Your order has been cancelled successfully.");
      refetch();
    },
    onError: (error) => {
      Alert.alert("Cannot Cancel", error.message || "Failed to cancel order.");
    },
  });

  const handleCancelOrder = (orderId: number, orderNumber: string) => {
    Alert.alert(
      "Cancel Order?",
      `Are you sure you want to cancel order ${orderNumber}? This cannot be undone.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: () => cancelOrderMutation.mutate({ orderId }),
        },
      ]
    );
  };

  const handleReorder = (order: any) => {
    clearCart();
    order.items.forEach(async (item: any) => {
      await addToCart(
        order.storeId,
        order.store?.name || "Store",
        {
          productId: item.productId,
          productName: item.product?.name || "Product",
          productPrice: item.productPrice,
          quantity: item.quantity,
        }
      );
    });
    router.push(`/cart/${order.storeId}`);
  };

  const handleSubmitRating = (orderId: number) => {
    if (selectedRating < 1) return;
    rateDriverMutation.mutate({
      orderId,
      rating: selectedRating,
      comment: ratingComment || undefined,
    });
  };

  // Separate active and past orders
  const activeOrders = orders?.filter((o) => isActiveOrder(o.status)) || [];
  const pastOrders = orders?.filter((o) => !isActiveOrder(o.status)) || [];

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#11181C" }}>My Orders</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Active Orders Section */}
        {activeOrders.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#0a7ea4", marginBottom: 12 }}>
              📍 Active Orders
            </Text>
            {activeOrders.map((order) => (
              <View
                key={order.id}
                style={{
                  backgroundColor: "#F0FDFA",
                  borderWidth: 2,
                  borderColor: "#0a7ea4",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                {/* Order Header */}
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "bold", color: "#11181C" }}>
                        {order.orderNumber || `Order #${order.id}`}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#687076", marginTop: 2 }}>
                        {order.store?.name || "Store"} · €{parseFloat(order.total).toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                        {order.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </Text>
                    </View>
                  </View>

                  {/* Estimated delivery time */}
                  {getEstimatedTime(order) && (
                    <View style={{ backgroundColor: "#FFF7ED", padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 20 }}>⏱️</Text>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#D97706" }}>
                          Estimated arrival: {getEstimatedTime(order)}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>
                          {order.driverId ? "Driver is on the job" : "Waiting for driver assignment"}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Driver assigned indicator (no personal info) */}
                  {order.driverId && !getEstimatedTime(order) && (
                    <View style={{ backgroundColor: "#E0F2FE", padding: 10, borderRadius: 8, marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, color: "#0a7ea4", fontWeight: "600" }}>
                        🚗 A driver has been assigned to your order
                      </Text>
                    </View>
                  )}

                  {/* Status Timeline */}
                  <StatusTimeline order={order} />

                  {/* Chat with Driver button - only show when driver is assigned and order is active */}
                  {order.driverId && ["accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way"].includes(order.status) && (
                    <TouchableOpacity
                      onPress={() => router.push(`/order-tracking/${order.id}` as any)}
                      style={{
                        backgroundColor: "#0a7ea4",
                        padding: 12,
                        borderRadius: 10,
                        marginTop: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>💬</Text>
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                        Chat with Driver
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Expand for items */}
                <TouchableOpacity
                  onPress={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  style={{ borderTopWidth: 1, borderTopColor: "#D1E9E4", padding: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "#0a7ea4", fontSize: 13, fontWeight: "600" }}>
                    {expandedOrderId === order.id ? "Hide Details ▲" : "View Details ▼"}
                  </Text>
                </TouchableOpacity>

                {expandedOrderId === order.id && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#D1E9E4" }}>
                    <Text style={{ fontWeight: "600", color: "#11181C", marginTop: 12, marginBottom: 8 }}>Items:</Text>
                    {order.items?.map((item: any, index: number) => (
                      <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                        <Text style={{ color: "#687076", flex: 1 }}>
                          {item.quantity}x {item.product?.name || "Product"}
                        </Text>
                        <Text style={{ color: "#11181C", fontWeight: "600" }}>
                          €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    {order.tipAmount && parseFloat(order.tipAmount) > 0 && (
                      <View style={{ marginTop: 8, backgroundColor: '#E6F7FC', padding: 8, borderRadius: 8 }}>
                        <Text style={{ color: '#0a7ea4', fontSize: 13, fontWeight: '600' }}>Driver Tip: €{parseFloat(order.tipAmount).toFixed(2)}</Text>
                      </View>
                    )}
                    {order.deliveryAddress && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontWeight: "600", color: "#11181C", marginBottom: 4 }}>Delivery Address:</Text>
                        <Text style={{ color: "#687076", fontSize: 13 }}>{order.deliveryAddress}</Text>
                      </View>
                    )}

                    {/* Cancel button - only for pending orders */}
                    {order.status === "pending" && (
                      <TouchableOpacity
                        onPress={() => handleCancelOrder(order.id, order.orderNumber || `#${order.id}`)}
                        disabled={cancelOrderMutation.isPending}
                        style={{
                          marginTop: 16,
                          backgroundColor: "#FEF2F2",
                          borderWidth: 1,
                          borderColor: "#EF4444",
                          borderRadius: 10,
                          padding: 12,
                          alignItems: "center",
                          opacity: cancelOrderMutation.isPending ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: "#EF4444", fontWeight: "bold", fontSize: 14 }}>
                          {cancelOrderMutation.isPending ? "Cancelling..." : "Cancel Order"}
                        </Text>
                        <Text style={{ color: "#9B1C1C", fontSize: 11, marginTop: 2 }}>
                          Only available while order is pending
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Past Orders Section */}
        {pastOrders.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#687076", marginBottom: 12 }}>
              Past Orders
            </Text>
            {pastOrders.map((order) => (
              <View
                key={order.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                {/* Order Header */}
                <TouchableOpacity
                  onPress={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  style={{ padding: 16 }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "bold", color: "#11181C" }}>
                        {order.orderNumber || `Order #${order.id}`}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#687076", marginTop: 2 }}>
                        {formatDate(order.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: order.status === "delivered" ? "#22C55E" : "#EF4444", fontWeight: "600", fontSize: 13 }}>
                        {order.status === "delivered" ? "Delivered" : "Cancelled"}
                      </Text>
                      <Text style={{ color: "#11181C", fontWeight: "bold", fontSize: 16, marginTop: 2 }}>
                        €{parseFloat(order.total).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "#687076", fontSize: 13 }}>{order.store?.name || "Store"}</Text>
                    <Text style={{ color: "#0a7ea4", fontSize: 13 }}>
                      {expandedOrderId === order.id ? "Hide ▲" : "Details ▼"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Rating Prompt for delivered orders without rating */}
                {order.status === "delivered" &&
                  order.driverId &&
                  !order.hasRating &&
                  !ratingSubmitted.has(order.id) && (
                    <View style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", padding: 16 }}>
                      {ratingOrderId === order.id ? (
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: "bold", color: "#11181C", marginBottom: 8, textAlign: "center" }}>
                            How was your delivery experience?
                          </Text>
                          <StarRating rating={selectedRating} onRate={setSelectedRating} />
                          <TextInput
                            placeholder="Leave a comment (optional)"
                            value={ratingComment}
                            onChangeText={setRatingComment}
                            style={{
                              borderWidth: 1,
                              borderColor: "#E5E7EB",
                              borderRadius: 8,
                              padding: 10,
                              marginTop: 12,
                              fontSize: 14,
                              color: "#11181C",
                            }}
                            multiline
                            returnKeyType="done"
                          />
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                            <TouchableOpacity
                              onPress={() => {
                                setRatingOrderId(null);
                                setSelectedRating(0);
                                setRatingComment("");
                              }}
                              style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" }}
                            >
                              <Text style={{ color: "#687076", fontWeight: "600" }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleSubmitRating(order.id)}
                              style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: selectedRating > 0 ? "#0a7ea4" : "#E5E7EB",
                                alignItems: "center",
                              }}
                              disabled={selectedRating < 1 || rateDriverMutation.isPending}
                            >
                              <Text style={{ color: selectedRating > 0 ? "#fff" : "#9BA1A6", fontWeight: "bold" }}>
                                {rateDriverMutation.isPending ? "Submitting..." : "Submit"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setRatingOrderId(order.id)}
                          style={{
                            backgroundColor: "#FFF7ED",
                            borderWidth: 1,
                            borderColor: "#FBBF24",
                            padding: 12,
                            borderRadius: 8,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#D97706", fontWeight: "bold", fontSize: 14 }}>
                            ⭐ Rate Your Driver
                          </Text>
                          <Text style={{ color: "#92400E", fontSize: 12, marginTop: 2 }}>
                            Help us improve our service
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                {/* Rating submitted confirmation */}
                {(order.hasRating || ratingSubmitted.has(order.id)) && order.status === "delivered" && (
                  <View style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", padding: 12, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600" }}>✅ Thanks for rating!</Text>
                  </View>
                )}

                {/* Expanded Details */}
                {expandedOrderId === order.id && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                    <Text style={{ fontWeight: "600", color: "#11181C", marginTop: 12, marginBottom: 8 }}>Items:</Text>
                    {order.items?.map((item: any, index: number) => (
                      <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                        <Text style={{ color: "#687076", flex: 1 }}>
                          {item.quantity}x {item.product?.name || "Product"}
                        </Text>
                        <Text style={{ color: "#11181C", fontWeight: "600" }}>
                          €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 8, paddingTop: 8 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                        <Text style={{ color: "#687076" }}>Subtotal</Text>
                        <Text style={{ color: "#11181C" }}>
                          €{(parseFloat(order.total) - parseFloat(order.deliveryFee || "0")).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                        <Text style={{ color: "#687076" }}>Delivery</Text>
                        <Text style={{ color: "#11181C" }}>€{parseFloat(order.deliveryFee || "0").toFixed(2)}</Text>
                      </View>
                      {order.tipAmount && parseFloat(order.tipAmount) > 0 && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                          <Text style={{ color: "#0a7ea4", fontWeight: "600" }}>Driver Tip</Text>
                          <Text style={{ color: "#0a7ea4", fontWeight: "600" }}>€{parseFloat(order.tipAmount).toFixed(2)}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 4, paddingTop: 8 }}>
                        <Text style={{ color: "#11181C", fontWeight: "bold" }}>Total</Text>
                        <Text style={{ color: "#11181C", fontWeight: "bold" }}>€{parseFloat(order.total).toFixed(2)}</Text>
                      </View>
                    </View>

                    {order.deliveryAddress && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontWeight: "600", color: "#11181C", marginBottom: 4 }}>Delivery Address:</Text>
                        <Text style={{ color: "#687076", fontSize: 13 }}>{order.deliveryAddress}</Text>
                      </View>
                    )}



                    {/* Reorder Button */}
                    {order.status === "delivered" && (
                      <TouchableOpacity
                        onPress={() => handleReorder(order)}
                        style={{ marginTop: 16, backgroundColor: "#0a7ea4", padding: 14, borderRadius: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Reorder</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {(!orders || orders.length === 0) && (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📦</Text>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#11181C", marginBottom: 8 }}>No Orders Yet</Text>
            <Text style={{ color: "#687076", textAlign: "center", marginBottom: 24 }}>
              Your order history will appear here{"\n"}once you place your first order
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/")}
              style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
