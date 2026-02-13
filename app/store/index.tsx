import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// Web-compatible confirm dialog
function confirmAction(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      const { Alert } = require("react-native");
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "OK", onPress: () => resolve(true) },
      ]);
    }
  });
}

// Web-compatible alert
function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message);
  }
}

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
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [markingReadyId, setMarkingReadyId] = useState<number | null>(null);

  // Get the store linked to this staff user from store_staff table
  const { data: myStore } = trpc.store.getMyStore.useQuery(
    { userId: user?.id! },
    { enabled: !!user && user.role === "store_staff" }
  );

  // Set storeId from the store_staff link
  useEffect(() => {
    if (myStore && storeId === null) {
      setStoreId(myStore.storeId);
    }
  }, [myStore, storeId]);

  // Use store.getOrders with the correct storeId
  const { data: storeOrders, isLoading, refetch } = trpc.store.getOrders.useQuery(
    { storeId: storeId || 1, status: "all" },
    { enabled: !!user && storeId !== null, refetchInterval: 5000 }
  );

  // Use the correct store router mutations
  const acceptOrderMutation = trpc.store.acceptOrder.useMutation();
  const markReadyMutation = trpc.store.markOrderReady.useMutation();

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

  const handleLogout = async () => {
    const confirmed = await confirmAction("Log Out", "Are you sure you want to log out?");
    if (!confirmed) return;
    try {
      // Clear session
      await AsyncStorage.multiRemove(["user", "authToken", "userRole"]);
      // Call backend logout
      try {
        const apiUrl = Platform.OS === "web" ? "/api/auth/logout" : `${process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000"}/api/auth/logout`;
        await fetch(apiUrl, { method: "POST", credentials: "include" });
      } catch (e) { /* ignore */ }
      router.replace("/auth/store-login");
    } catch (error) {
      showAlert("Error", "Failed to log out");
    }
  };

  const handleAcceptOrder = useCallback(async (orderId: number) => {
    if (!storeId) return;

    const confirmed = await confirmAction(
      "Accept Order",
      "Accept this order and start preparing?"
    );

    if (!confirmed) return;

    try {
      setAcceptingId(orderId);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await acceptOrderMutation.mutateAsync({
        orderId,
        storeId,
      });
      await refetch();
      showAlert("Success", "Order accepted! Start preparing items.");
    } catch (error: any) {
      console.error("Accept order error:", error);
      showAlert("Error", error.message || "Failed to accept order");
    } finally {
      setAcceptingId(null);
    }
  }, [storeId, acceptOrderMutation, refetch]);

  const handleMarkReady = useCallback(async (orderId: number) => {
    if (!storeId) return;

    const confirmed = await confirmAction(
      "Mark Ready for Pickup",
      "Is this order complete and ready for driver pickup?"
    );

    if (!confirmed) return;

    try {
      setMarkingReadyId(orderId);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await markReadyMutation.mutateAsync({
        orderId,
        storeId,
      });
      await refetch();
      showAlert("Success", "Order marked as ready! Driver will be notified.");
    } catch (error: any) {
      console.error("Mark ready error:", error);
      showAlert("Error", error.message || "Failed to update order");
    } finally {
      setMarkingReadyId(null);
    }
  }, [storeId, markReadyMutation, refetch]);

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

  const storeName = myStore?.storeName || "Store Dashboard";
  const allOrders = storeOrders || [];

  // Filter orders based on selected tab
  const activeStatuses = ["pending", "preparing", "ready_for_pickup", "picked_up", "on_the_way"];
  const filteredOrders = allOrders.filter((order: any) => {
    if (filter === "all") return activeStatuses.includes(order.status);
    return order.status === filter;
  });

  const pendingCount = allOrders.filter((o: any) => o.status === "pending").length;
  const preparingCount = allOrders.filter((o: any) => o.status === "preparing").length;
  const readyCount = allOrders.filter((o: any) => o.status === "ready_for_pickup").length;

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-primary p-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-background text-2xl font-bold">{storeName}</Text>
              <Text className="text-background/80 text-sm">Store Dashboard</Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              style={{ backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* New Order Flash Banner */}
        {newOrderFlash && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderWidth: 1, borderColor: "#F59E0B" }}>
            <Text style={{ color: "#92400E", fontWeight: "700", textAlign: "center", fontSize: 16 }}>
              🔔 NEW ORDER RECEIVED!
            </Text>
          </View>
        )}

        {/* Quick Actions Bar */}
        <View style={{ flexDirection: "row", backgroundColor: "rgba(10,126,164,0.05)", paddingVertical: 8, paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/store/hours", params: { storeId: String(storeId) } })}
            style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" }}
          >
            <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>Store Hours</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/store/deli", params: { storeId: String(storeId) } })}
            style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" }}
          >
            <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>Deli View</Text>
          </TouchableOpacity>
        </View>

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
            onPress={() => setFilter("ready_for_pickup")}
            className={`flex-1 p-3 ${filter === "ready_for_pickup" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold text-sm ${filter === "ready_for_pickup" ? "text-primary" : "text-muted"}`}>
              Ready{readyCount > 0 ? ` (${readyCount})` : ""}
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

                {/* Action Buttons - NO confirmation dialog, direct action for reliability */}
                {order.status === "pending" && (
                  <TouchableOpacity
                    onPress={() => handleAcceptOrder(order.id)}
                    disabled={acceptingId === order.id}
                    style={[
                      { backgroundColor: "#22C55E", padding: 16, borderRadius: 8, alignItems: "center" },
                      acceptingId === order.id ? { opacity: 0.6 } : {},
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                      {acceptingId === order.id ? "Accepting..." : "✓ Accept & Start Preparing"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "preparing" && (
                  <TouchableOpacity
                    onPress={() => handleMarkReady(order.id)}
                    disabled={markingReadyId === order.id}
                    style={[
                      { backgroundColor: "#22C55E", padding: 16, borderRadius: 8, alignItems: "center" },
                      markingReadyId === order.id ? { opacity: 0.6 } : {},
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                      {markingReadyId === order.id ? "Updating..." : "✓ Mark Ready for Pickup"}
                    </Text>
                  </TouchableOpacity>
                )}

                {order.status === "ready_for_pickup" && (
                  <View style={{ backgroundColor: "rgba(34,197,94,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontWeight: "700" }}>⏳ Waiting for Driver Pickup</Text>
                  </View>
                )}

                {(order.status === "picked_up" || order.status === "on_the_way") && (
                  <View style={{ backgroundColor: "rgba(34,197,94,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontWeight: "700" }}>🚗 Driver is delivering</Text>
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
