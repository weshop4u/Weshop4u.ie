import { View, Text, TouchableOpacity, FlatList, RefreshControl, Platform, AppState, Image, ActivityIndicator, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/lib/cart-provider";
import { scheduleLocalNotification } from "@/lib/safe-notifications";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { formatIrishTime, formatIrishDateTime } from "@/lib/timezone";
import { WebLayout } from "@/components/web-layout";


function getEstimatedTime(order: any): string | null {
  const status = order.status;
  if (["delivered", "cancelled", "pending"].includes(status)) return null;
  const distanceKm = order.estimatedDistance ? parseFloat(order.estimatedDistance) : 3;
  const drivingMinutes = Math.ceil(distanceKm * 3);
  switch (status) {
    case "accepted":
      return `~${drivingMinutes + 15}-${drivingMinutes + 25} min`;
    case "preparing":
      return `~${drivingMinutes + 10}-${drivingMinutes + 20} min`;
    case "ready_for_pickup":
      return `~${drivingMinutes + 5}-${drivingMinutes + 15} min`;
    case "picked_up":
    case "on_the_way":
      return `~${drivingMinutes}-${drivingMinutes + 10} min`;
    default:
      return null;
  }
}

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
  return formatIrishTime(dateStr);
}

function formatDate(dateStr: string | Date): string {
  return formatIrishDateTime(dateStr);
}

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

function StatusTimeline({ order, colors }: { order: any; colors: any }) {
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
          <View key={step.key} style={{ flexDirection: "row" }}>
            <View style={{ alignItems: "center", width: 32 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: isCompleted ? colors.primary : colors.border,
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: isCurrent ? colors.primary : "transparent",
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
                    backgroundColor: idx < currentIdx ? colors.primary : colors.border,
                  }}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingLeft: 8, paddingBottom: idx < STATUS_STEPS.length - 1 ? 8 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 13 }}>{step.icon}</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isCurrent ? "bold" : "normal",
                    color: isCompleted ? colors.foreground : colors.muted,
                  }}
                >
                  {step.label}
                </Text>
                {timestamp ? (
                  <Text style={{ fontSize: 11, color: colors.muted, marginLeft: "auto" }}>
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

// Separate components to avoid re-render issues with FlatList
function ActiveOrderCard({ order, isExpanded, onToggleExpand, colors, router, onCancelOrder, cancelPending }: any) {
  return (
    <View
      style={{
        backgroundColor: colors.primary + '08',
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground }}>
              {order.orderNumber || `Order #${order.id}`}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {order.store?.name || "Store"} · €{parseFloat(order.total).toFixed(2)}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
              {order.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </Text>
          </View>
        </View>

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

        {order.driverId && !getEstimatedTime(order) && (
          <View style={{ backgroundColor: colors.primary + '15', padding: 10, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>
              🚗 {order.driver?.name ? `${order.driver.name} has been assigned` : "A driver has been assigned to your order"}
            </Text>
          </View>
        )}

        {(order as any).batchId && (order as any).batchSequence && (
          <View style={{ backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#93C5FD' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{(order as any).batchSequence}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#1E40AF', flex: 1 }}>
              {(order as any).batchSequence === 1
                ? "Your driver has multiple deliveries — yours is next!"
                : `Your driver has multiple deliveries — yours is #${(order as any).batchSequence} in queue`}
            </Text>
          </View>
        )}

        <StatusTimeline order={order} colors={colors} />

        {order.driverId && ["accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way"].includes(order.status) && (
          <TouchableOpacity
            onPress={() => router.push(`/order-tracking/${order.id}` as any)}
            style={{
              backgroundColor: colors.primary,
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

      <TouchableOpacity
        onPress={() => onToggleExpand(order.id)}
        style={{ borderTopWidth: 1, borderTopColor: colors.primary + '30', padding: 12, alignItems: "center" }}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
          {isExpanded ? "Hide Details ▲" : "View Details ▼"}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.primary + '30' }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, marginTop: 12, marginBottom: 8 }}>Items:</Text>
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: colors.muted, flex: 1 }}>
                {item.quantity}x {item.product?.name || "Product"}
              </Text>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          {order.tipAmount && parseFloat(order.tipAmount) > 0 && (
            <View style={{ marginTop: 8, backgroundColor: colors.primary + '15', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Driver Tip: €{parseFloat(order.tipAmount).toFixed(2)}</Text>
            </View>
          )}
          {order.deliveryAddress && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>Delivery Address:</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{order.deliveryAddress}</Text>
            </View>
          )}
          {order.paymentMethod === "card" && order.paymentStatus !== "completed" && order.status === "pending" && (
            <TouchableOpacity
              onPress={() => router.push(`/payment/${order.id}` as any)}
              style={{
                marginTop: 16,
                backgroundColor: '#00E5FF15',
                borderWidth: 1,
                borderColor: '#00E5FF',
                borderRadius: 10,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: '#00B8D4', fontWeight: "bold", fontSize: 14 }}>Retry Payment</Text>
              <Text style={{ color: '#00B8D4', fontSize: 11, marginTop: 2, opacity: 0.7 }}>Complete your card payment</Text>
            </TouchableOpacity>
          )}
          {order.status === "pending" && (
            <TouchableOpacity
              onPress={() => onCancelOrder(order.id, order.orderNumber || `#${order.id}`)}
              disabled={cancelPending}
              style={{
                marginTop: 8,
                backgroundColor: colors.error + '10',
                borderWidth: 1,
                borderColor: colors.error,
                borderRadius: 10,
                padding: 12,
                alignItems: "center",
                opacity: cancelPending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.error, fontWeight: "bold", fontSize: 14 }}>
                {cancelPending ? "Cancelling..." : "Cancel Order"}
              </Text>
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 2, opacity: 0.7 }}>
                Only available while order is pending
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function PastOrderCard({ order, isExpanded, onToggleExpand, colors, router, isRated, ratingOrderId, selectedRating, ratingComment, onSetRatingOrderId, onSetSelectedRating, onSetRatingComment, onSubmitRating, onReorder, ratingPending }: any) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <TouchableOpacity
        onPress={() => onToggleExpand(order.id)}
        style={{ padding: 16 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.foreground }}>
              {order.orderNumber || `Order #${order.id}`}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {formatDate(order.createdAt)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: order.status === "delivered" ? colors.success : colors.error, fontWeight: "600", fontSize: 13 }}>
              {order.status === "delivered" ? "Delivered" : "Cancelled"}
            </Text>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16, marginTop: 2 }}>
              €{parseFloat(order.total).toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{order.store?.name || "Store"}</Text>
          <Text style={{ color: colors.primary, fontSize: 13 }}>
            {isExpanded ? "Hide ▲" : "Details ▼"}
          </Text>
        </View>
      </TouchableOpacity>

      {order.status === "delivered" &&
        order.driverId &&
        !order.hasRating &&
        !isRated && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 16 }}>
            {ratingOrderId === order.id ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.foreground, marginBottom: 8, textAlign: "center" }}>
                  How was your delivery experience?
                </Text>
                <StarRating rating={selectedRating} onRate={onSetSelectedRating} />
                <TextInput
                  placeholder="Leave a comment (optional)"
                  placeholderTextColor={colors.muted}
                  value={ratingComment}
                  onChangeText={onSetRatingComment}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 12,
                    fontSize: 14,
                    color: colors.foreground,
                    backgroundColor: colors.background,
                  }}
                  multiline
                  returnKeyType="done"
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      onSetRatingOrderId(null);
                      onSetSelectedRating(0);
                      onSetRatingComment("");
                    }}
                    style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onSubmitRating(order.id)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: selectedRating > 0 ? colors.primary : colors.surface,
                      alignItems: "center",
                    }}
                    disabled={selectedRating < 1 || ratingPending}
                  >
                    <Text style={{ color: selectedRating > 0 ? "#fff" : colors.muted, fontWeight: "bold" }}>
                      {ratingPending ? "Submitting..." : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => onSetRatingOrderId(order.id)}
                style={{
                  backgroundColor: "#FFF7ED",
                  borderWidth: 1,
                  borderColor: colors.warning,
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

      {(order.hasRating || isRated) && order.status === "delivered" && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>✅ Thanks for rating!</Text>
        </View>
      )}

      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, marginTop: 12, marginBottom: 8 }}>Items:</Text>
          {order.items?.map((item: any, idx: number) => (
            <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: colors.muted, flex: 1 }}>
                {item.quantity}x {item.product?.name || "Product"}
              </Text>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: colors.muted }}>Subtotal</Text>
              <Text style={{ color: colors.foreground }}>
                €{(parseFloat(order.total) - parseFloat(order.deliveryFee || "0")).toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: colors.muted }}>Delivery</Text>
              <Text style={{ color: colors.foreground }}>€{parseFloat(order.deliveryFee || "0").toFixed(2)}</Text>
            </View>
            {order.tipAmount && parseFloat(order.tipAmount) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Driver Tip</Text>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>€{parseFloat(order.tipAmount).toFixed(2)}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 }}>
              <Text style={{ color: colors.foreground, fontWeight: "bold" }}>Total</Text>
              <Text style={{ color: colors.foreground, fontWeight: "bold" }}>€{parseFloat(order.total).toFixed(2)}</Text>
            </View>
          </View>
          {order.deliveryAddress && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>Delivery Address:</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{order.deliveryAddress}</Text>
            </View>
          )}
          {order.status === "delivered" && (
            <TouchableOpacity
              onPress={() => onReorder(order)}
              style={{ marginTop: 16, backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Reorder</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  // Use Record instead of Set for stable serialization on native
  const [ratingSubmitted, setRatingSubmitted] = useState<Record<number, boolean>>({});
  const { clearCart, addToCart } = useCart();

  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<{ id: number; number: string } | null>(null);
  const [inlineMessage, setInlineMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const lastStatusesRef = useRef<Record<number, string>>({});

  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(undefined, {
    refetchInterval: 5000,
    enabled: !!user,
  });

  useEffect(() => {
    if (inlineMessage) {
      const timer = setTimeout(() => setInlineMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [inlineMessage]);

  // ALL hooks MUST be above this line - React requires consistent hook order across renders
  useEffect(() => {
    if (!user) return; // Guard inside effect, not before it
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch, user]);

  // Track status changes and send local notifications
  useEffect(() => {
    if (!orders) return;
    const prevStatuses = lastStatusesRef.current;
    for (const order of orders) {
      const prevStatus = prevStatuses[order.id];
      if (prevStatus && prevStatus !== order.status) {
        const msg = STATUS_MESSAGES[order.status];
        if (msg) {
          scheduleLocalNotification({
            title: msg.title,
            body: msg.body,
            channelId: "orders",
            data: { orderId: order.id },
          });
        }
      }
      prevStatuses[order.id] = order.status;
    }
    lastStatusesRef.current = prevStatuses;
  }, [orders]);

  const rateDriverMutation = trpc.orders.rateDriver.useMutation({
    onSuccess: (_, variables) => {
      setRatingSubmitted((prev) => ({ ...prev, [variables.orderId]: true }));
      setRatingOrderId(null);
      setSelectedRating(0);
      setRatingComment("");
      refetch();
    },
  });

  const cancelOrderMutation = trpc.orders.cancelOrder.useMutation({
    onSuccess: () => {
      setInlineMessage({ type: "success", text: "Your order has been cancelled successfully." });
      setCancelConfirmOrder(null);
      refetch();
    },
    onError: (error) => {
      setInlineMessage({ type: "error", text: error.message || "Failed to cancel order." });
      setCancelConfirmOrder(null);
    },
  });

  const handleCancelOrder = (orderId: number, orderNumber: string) => {
    setCancelConfirmOrder({ id: orderId, number: orderNumber });
  };

  const confirmCancel = () => {
    if (cancelConfirmOrder) {
      cancelOrderMutation.mutate({ orderId: cancelConfirmOrder.id });
    }
  };

  const handleReorder = async (order: any) => {
    clearCart();
    for (const item of order.items) {
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
    }
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

  const handleToggleExpand = (orderId: number) => {
    setExpandedOrderId((prev) => prev === orderId ? null : orderId);
  };

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  // Early return for unauthenticated users - AFTER all hooks
  if (!user) {
    return (
      <Wrapper>
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <View style={{ width: 144, height: 144, borderRadius: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' }}>
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 144, height: 144, borderRadius: 72 }}
              resizeMode="cover"
            />
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
              backgroundColor: colors.primary,
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
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
      </Wrapper>
    );
  }

  const activeOrders = orders?.filter((o) => isActiveOrder(o.status)) || [];
  const pastOrders = orders?.filter((o) => !isActiveOrder(o.status)) || [];

  if (isLoading) {
    return (
      <Wrapper>
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
      </Wrapper>
    );
  }

  // Combine active and past orders into a single list with section markers
  const listData = [
    ...activeOrders.map(o => ({ ...o, _section: 'active' as const })),
    ...pastOrders.map(o => ({ ...o, _section: 'past' as const })),
  ];

  return (
    <Wrapper>
    <ScreenContainer>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground }}>My Orders</Text>
      </View>

      {/* Inline Message Banner */}
      {inlineMessage && (
        <View style={{
          margin: 16, marginBottom: 0, padding: 12, borderRadius: 8,
          backgroundColor: inlineMessage.type === "success" ? colors.success + '15' : colors.error + '15',
          borderWidth: 1,
          borderColor: inlineMessage.type === "success" ? colors.success : colors.error,
          flexDirection: 'row', alignItems: 'center',
        }}>
          <Text style={{ color: inlineMessage.type === "success" ? colors.success : colors.error, flex: 1, fontSize: 14 }}>
            {inlineMessage.text}
          </Text>
          <TouchableOpacity onPress={() => setInlineMessage(null)}>
            <Text style={{ color: inlineMessage.type === "success" ? colors.success : colors.error, fontWeight: '700', fontSize: 16, paddingLeft: 8 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel Confirmation Overlay */}
      {cancelConfirmOrder && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
          justifyContent: 'center', alignItems: 'center', padding: 24,
        }}>
          <View style={{
            backgroundColor: colors.background, borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 340,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
            elevation: 8,
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
              Cancel Order?
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to cancel order {cancelConfirmOrder.number}? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setCancelConfirmOrder(null)}
                style={{
                  flex: 1, padding: 14, borderRadius: 10,
                  borderWidth: 1, borderColor: colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancel}
                disabled={cancelOrderMutation.isPending}
                style={{
                  flex: 1, padding: 14, borderRadius: 10,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  opacity: cancelOrderMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {cancelOrderMutation.isPending ? "Cancelling..." : "Cancel Order"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FlatList
        style={{ flex: 1, padding: 16 }}
        data={listData}
        keyExtractor={(item) => String(item.id)}
        extraData={expandedOrderId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={activeOrders.length > 0 ? (
          <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.primary, marginBottom: 12 }}>
            📍 Active Orders
          </Text>
        ) : pastOrders.length > 0 ? (
          <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.muted, marginBottom: 12 }}>
            Past Orders
          </Text>
        ) : null}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 16 }}
              resizeMode="cover"
            />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground, marginBottom: 8 }}>No Orders Yet</Text>
            <Text style={{ color: colors.muted, textAlign: "center", marginBottom: 24 }}>
              Your order history will appear here{"\n"}once you place your first order
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/")}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
        renderItem={({ item: order, index }) => {
          const showPastHeader = order._section === 'past' && (index === 0 || (activeOrders.length > 0 && index === activeOrders.length));
          return (
            <View>
              {showPastHeader && (
                <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.muted, marginBottom: 12, marginTop: activeOrders.length > 0 ? 24 : 0 }}>
                  Past Orders
                </Text>
              )}
              {order._section === 'active' ? (
                <ActiveOrderCard
                  order={order}
                  isExpanded={expandedOrderId === order.id}
                  onToggleExpand={handleToggleExpand}
                  colors={colors}
                  router={router}
                  onCancelOrder={handleCancelOrder}
                  cancelPending={cancelOrderMutation.isPending}
                />
              ) : (
                <PastOrderCard
                  order={order}
                  isExpanded={expandedOrderId === order.id}
                  onToggleExpand={handleToggleExpand}
                  colors={colors}
                  router={router}
                  isRated={!!ratingSubmitted[order.id]}
                  ratingOrderId={ratingOrderId}
                  selectedRating={selectedRating}
                  ratingComment={ratingComment}
                  onSetRatingOrderId={setRatingOrderId}
                  onSetSelectedRating={setSelectedRating}
                  onSetRatingComment={setRatingComment}
                  onSubmitRating={handleSubmitRating}
                  onReorder={handleReorder}
                  ratingPending={rateDriverMutation.isPending}
                />
              )}
            </View>
          );
        }}
      />
    </ScreenContainer>
    </Wrapper>
  );
}
