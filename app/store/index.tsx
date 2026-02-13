import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, AppState, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef } from "react";
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
  const [storeId, setStoreId] = useState<number | null>(null);

  // Get the store ID for this staff member from the user's store link
  const { data: storeStaffInfo } = trpc.auth.me.useQuery(undefined, {
    enabled: !!user && user.role === "store_staff",
    select: (data: any) => data,
  });

  // Use store.getOrders with the correct storeId instead of orders.getUserOrders
  // First we need to determine the storeId - get it from the first order or from user profile
  const { data: storeOrders, isLoading, refetch } = trpc.store.getOrders.useQuery(
    { storeId: storeId || 1, status: "all" },
    { enabled: !!user && storeId !== null, refetchInterval: 5000 }
  );

  // Get store info to display name
  const { data: storeInfo } = trpc.stores.getById.useQuery(
    { id: storeId || 1 },
    { enabled: storeId !== null }
  );

  // Use the correct store router mutations
  const acceptOrderMutation = trpc.store.acceptOrder.useMutation();
  const markReadyMutation = trpc.store.markOrderReady.useMutation();

  // Determine storeId from user's store_staff link
  // We'll use getUserOrders which now returns store orders for store_staff
  const { data: userOrders } = trpc.orders.getUserOrders.useQuery(undefined, {
    enabled: !!user && user.role === "store_staff" && storeId === null,
  });

  // Extract storeId from the first order or default to 1
  useEffect(() => {
    if (userOrders && userOrders.length > 0 && storeId === null) {
      setStoreId(userOrders[0].storeId);
    } else if (user && user.role === "store_staff" && storeId === null) {
      // Default to store 1 if no orders found yet - will be updated when orders come in
      setStoreId(1);
    }
  }, [userOrders, user, storeId]);

  // Listen for push notifications
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      refetch();
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
    if (!storeOrders) return;

    const currentPendingIds = new Set(
      storeOrders.filter((o: any) => o.status === "pending").map((o: any) => o.id)
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
  }, [storeOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAcceptOrder = (orderId: number) => {
    if (!storeId) return;

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
              await acceptOrderMutation.mutateAsync({
                orderId,
                storeId,
              });
              await refetch();
              Alert.alert("Success", "Order accepted! Start preparing items.");
            } catch (error: any) {
              console.error("Accept order error:", error);
              Alert.alert("Error", error.message || "Failed to accept order");
            }
          },
        },
      ]
    );
  };

  const handleMarkReady = (orderId: number) => {
    if (!storeId) return;

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
              await markReadyMutation.mutateAsync({
                orderId,
                storeId,
              });
              await refetch();
              Alert.alert("Success", "Order marked as ready! Driver will be notified.");
            } catch (error: any) {
              console.error("Mark ready error:", error);
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
      case "picked_up": case "on_the_way": return "bg-success/10 border-success";
      default: return "bg-surface border-border";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "New Order";
      case "preparing": return "Preparing";
      case "ready_for_pickup": return "Ready for Pickup";
      case "picked_up": return "Picked Up";
      case "on_the_way": return "On the Way";
      case "delivered": return "Delivered";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  if (userLoading || isLoading || storeId === null) {
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

  const storeName = storeInfo?.name || "Store Dashboard";
  const orders = storeOrders || [];

  // Filter orders based on selected tab
  const activeStatuses = ["pending", "preparing", "ready_for_pickup", "picked_up", "on_the_way"];
  const filteredOrders = orders.filter((order: any) => {
    if (filter === "all") return activeStatuses.includes(order.status);
    return order.status === filter;
  });

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;
  const preparingCount = orders.filter((o: any) => o.status === "preparing").length;
  const readyCount = orders.filter((o: any) => o.status === "ready_for_pickup").length;

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
              🔔 NEW ORDER RECEIVED!
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
            onPress={() => router.push({ pathname: "/store/deli", params: { storeId: String(storeId) } })}
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
                {filter === "all" ? "New orders will appear here" : `No ${filter.replace(/_/g, " ")} orders`}
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
                    <View key={item.id || idx} className="py-2 border-b border-border" style={idx === (order.items?.length || 0) - 1 ? { borderBottomWidth: 0 } : {}}>
                      <Text className="text-foreground font-semibold">
                        {item.quantity}x {item.product?.name || item.productName || "Item"}
                      </Text>
                      {item.specialInstructions && (
                        <Text className="text-muted text-sm italic">{item.specialInstructions}</Text>
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
                    disabled={acceptOrderMutation.isPending}
                    className="bg-success p-4 rounded-lg items-center active:opacity-70"
                    style={acceptOrderMutation.isPending ? { opacity: 0.6 } : {}}
                  >
                    <Text className="text-background font-bold text-lg">
                      {acceptOrderMutation.isPending ? "Accepting..." : "✓ Accept & Start Preparing"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "preparing" && (
                  <TouchableOpacity
                    onPress={() => handleMarkReady(order.id)}
                    disabled={markReadyMutation.isPending}
                    className="bg-success p-4 rounded-lg items-center active:opacity-70"
                    style={markReadyMutation.isPending ? { opacity: 0.6 } : {}}
                  >
                    <Text className="text-background font-bold text-lg">
                      {markReadyMutation.isPending ? "Updating..." : "✓ Mark Ready for Pickup"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "ready_for_pickup" && (
                  <View className="bg-success/10 p-3 rounded-lg items-center">
                    <Text className="text-success font-bold">⏳ Waiting for Driver Pickup</Text>
                  </View>
                )}

                {(order.status === "picked_up" || order.status === "on_the_way") && (
                  <View className="bg-success/10 p-3 rounded-lg items-center">
                    <Text className="text-success font-bold">🚗 Driver is delivering</Text>
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
