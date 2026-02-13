import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, AppState, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function StoreDashboardScreen() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Register push token for store staff
  usePushNotifications(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "preparing" | "ready_for_pickup">("all");
  const prevPendingIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Get orders for the store
  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5000 }
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation();

  // Listen for push notifications (new order alerts from server)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === "new_order") {
        refetch();
      }
    });

    return () => subscription.remove();
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

  // Detect new pending orders and flash alert
  useEffect(() => {
    if (!orders) return;

    const currentPendingIds = new Set(
      orders.filter((o: any) => o.status === "pending").map((o: any) => o.id)
    );

    if (isFirstLoadRef.current) {
      prevPendingIdsRef.current = currentPendingIds;
      isFirstLoadRef.current = false;
      return;
    }

    const newPendingOrders: number[] = [];
    currentPendingIds.forEach((id) => {
      if (!prevPendingIdsRef.current.has(id)) {
        newPendingOrders.push(id);
      }
    });

    if (newPendingOrders.length > 0) {
      setNewOrderFlash(true);
      setTimeout(() => setNewOrderFlash(false), 3000);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [orders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAcceptOrder = (orderId: number) => {
    Alert.alert(
      "Accept Order",
      "Accept this order and start preparing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              await updateStatusMutation.mutateAsync({
                orderId,
                status: "preparing",
              });
              await refetch();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to accept order");
            }
          },
        },
      ]
    );
  };

  const handleMarkReady = (orderId: number) => {
    Alert.alert(
      "Mark Ready for Pickup",
      "Is this order complete and ready for driver pickup?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Ready",
          onPress: async () => {
            try {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              await updateStatusMutation.mutateAsync({
                orderId,
                status: "ready_for_pickup",
              });
              await refetch();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to update order");
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-warning/10 border-warning";
      case "preparing": return "bg-primary/10 border-primary";
      case "ready_for_pickup": return "bg-success/10 border-success";
      default: return "bg-surface border-border";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "New Order";
      case "accepted": return "Accepted";
      case "preparing": return "Preparing";
      case "ready_for_pickup": return "Ready for Pickup";
      case "picked_up": return "Picked Up";
      case "on_the_way": return "On the Way";
      case "delivered": return "Delivered";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  if (userLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading store dashboard...</Text>
      </ScreenContainer>
    );
  }

  if (!user || user.role !== "store_staff") {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center mb-4">
          You need to be logged in as store staff to access this dashboard.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/auth/store-login")}
          className="bg-primary px-8 py-3 rounded-full active:opacity-70"
        >
          <Text className="text-background font-bold">Store Login</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Get store name from first order or default
  const storeName = orders?.[0]?.store?.name || "Store Dashboard";

  // Filter orders based on selected tab
  const activeStatuses = ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way"];
  const filteredOrders = (orders || []).filter((order: any) => {
    if (filter === "all") return activeStatuses.includes(order.status);
    return order.status === filter;
  });

  const pendingCount = (orders || []).filter((o: any) => o.status === "pending").length;
  const preparingCount = (orders || []).filter((o: any) => o.status === "preparing").length;
  const readyCount = (orders || []).filter((o: any) => o.status === "ready_for_pickup").length;

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-primary p-4">
          <Text className="text-background text-2xl font-bold">{storeName}</Text>
          <Text className="text-background/80 text-sm">Store Dashboard</Text>
        </View>

        {/* New Order Flash Banner */}
        {newOrderFlash && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderWidth: 1, borderColor: "#F59E0B" }}>
            <Text style={{ color: "#92400E", fontWeight: "700", textAlign: "center", fontSize: 16 }}>
              NEW ORDER RECEIVED!
            </Text>
          </View>
        )}

        {/* Navigation Tabs */}
        <View className="flex-row bg-surface border-b border-border">
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={`flex-1 p-3 ${filter === "all" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold text-sm ${filter === "all" ? "text-primary" : "text-muted"}`}>
              All Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("pending")}
            className={`flex-1 p-3 ${filter === "pending" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold text-sm ${filter === "pending" ? "text-primary" : "text-muted"}`}>
              Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("preparing")}
            className={`flex-1 p-3 ${filter === "preparing" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold text-sm ${filter === "preparing" ? "text-primary" : "text-muted"}`}>
              Preparing{preparingCount > 0 ? ` (${preparingCount})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/store/deli")}
            className="flex-1 p-3"
          >
            <Text className="text-center font-semibold text-sm text-muted">
              Deli View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {filteredOrders.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-4xl mb-4">📦</Text>
              <Text className="text-muted text-lg">No orders</Text>
              <Text className="text-muted text-sm mt-2">
                {filter === "all" ? "New orders will appear here" : `No ${filter.replace("_", " ")} orders`}
              </Text>
            </View>
          ) : (
            filteredOrders.map((order: any) => (
              <View
                key={order.id}
                className={`mb-4 p-4 rounded-lg border-2 ${getStatusColor(order.status)}`}
              >
                {/* Order Header */}
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                    <Text className="text-muted text-sm">
                      {order.driver?.name || "No driver assigned"}
                    </Text>
                    <Text className="text-muted text-xs">
                      {new Date(order.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                    <Text className="font-semibold text-sm">{getStatusText(order.status)}</Text>
                  </View>
                </View>

                {/* Order Items */}
                <View className="bg-background p-3 rounded-lg mb-3">
                  {order.items?.map((item: any, idx: number) => (
                    <View key={item.id || idx} className="py-2 border-b border-border" style={idx === order.items.length - 1 ? { borderBottomWidth: 0 } : {}}>
                      <Text className="text-foreground font-semibold">
                        {item.quantity}x {item.product?.name || item.productName || "Unknown Item"}
                      </Text>
                      {item.notes && (
                        <Text className="text-muted text-sm italic">{item.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>

                {/* Payment Info */}
                <View className="flex-row justify-between mb-2">
                  <Text className="text-muted">Payment</Text>
                  <Text className="text-foreground font-semibold">
                    {order.paymentMethod === "card" ? "Card (Paid)" : "Cash on Delivery"}
                  </Text>
                </View>

                <View className="flex-row justify-between mb-3">
                  <Text className="text-muted">Total</Text>
                  <Text className="text-foreground font-bold text-lg">€{order.total}</Text>
                </View>

                {/* Delivery Address */}
                {order.deliveryAddress && (
                  <View className="mb-3">
                    <Text className="text-xs text-muted mb-1">DELIVERY TO</Text>
                    <Text className="text-foreground text-sm">{order.deliveryAddress}</Text>
                  </View>
                )}

                {/* Customer Notes */}
                {order.customerNotes ? (
                  <View className="mb-3">
                    <Text className="text-xs text-muted mb-1">NOTES</Text>
                    <Text className="text-foreground italic text-sm">{order.customerNotes}</Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                {order.status === "pending" && (
                  <TouchableOpacity
                    onPress={() => handleAcceptOrder(order.id)}
                    disabled={updateStatusMutation.isPending}
                    className="bg-success p-4 rounded-lg items-center active:opacity-70"
                  >
                    <Text className="text-background font-bold text-lg">
                      {updateStatusMutation.isPending ? "Updating..." : "✓ Accept & Start Preparing"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "preparing" && (
                  <TouchableOpacity
                    onPress={() => handleMarkReady(order.id)}
                    disabled={updateStatusMutation.isPending}
                    className="bg-success p-4 rounded-lg items-center active:opacity-70"
                  >
                    <Text className="text-background font-bold text-lg">
                      {updateStatusMutation.isPending ? "Updating..." : "✓ Mark Ready for Pickup"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "ready_for_pickup" && (
                  <View className="bg-success/10 p-3 rounded-lg items-center">
                    <Text className="text-success font-bold">Waiting for Driver Pickup</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
