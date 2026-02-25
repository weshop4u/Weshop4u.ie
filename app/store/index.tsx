import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { formatIrishDateTime } from "@/lib/timezone";

const isExpoGo = Constants.appOwnership === "expo";
import { playNewOrderSound, playDriverArrivedSound, startWebAlarm, stopWebAlarm } from "@/lib/notification-sound";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

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
  const insets = useSafeAreaInsets();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Register push token for store staff
  usePushNotifications(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "preparing" | "ready_for_pickup" | "completed">("all");
  const prevPendingIdsRef = useRef<Set<number>>(new Set());
  const prevDriverAtStoreIdsRef = useRef<Set<number>>(new Set());
  const [now, setNow] = useState(Date.now());
  const isFirstLoadRef = useRef(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [markingReadyId, setMarkingReadyId] = useState<number | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  const [printSuccess, setPrintSuccess] = useState<number | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const colors = useColors();

  // Audio player for persistent alarm (native)
  const alarmPlayer = useAudioPlayer(require("@/assets/sounds/order-alert.mp3"));
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enable audio in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

  // Start persistent looping alarm (matches driver alarm pattern)
  const startAlarm = () => {
    if (Platform.OS === "web") {
      startWebAlarm(4000); // Repeat every 4 seconds on web
    } else {
      try {
        alarmPlayer.seekTo(0);
        alarmPlayer.play();
      } catch (e) { /* ignore */ }

      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = setInterval(() => {
        try {
          alarmPlayer.seekTo(0);
          alarmPlayer.play();
        } catch (e) { /* ignore */ }
      }, 4000);

      // Persistent vibration - triple burst like driver alarm
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = setInterval(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
      }, 3000);
    }
  };

  // Stop alarm completely
  const stopAlarm = () => {
    if (Platform.OS === "web") {
      stopWebAlarm();
    } else {
      if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
      if (vibrationIntervalRef.current) { clearInterval(vibrationIntervalRef.current); vibrationIntervalRef.current = null; }
      try { alarmPlayer.pause(); } catch (e) { /* ignore */ }
    }
  };

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
  const createPrintJobMutation = trpc.print.createPrintJob.useMutation();

  // Listen for push notifications
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isExpoGo) return; // Skip in Expo Go
    let subscription: Notifications.Subscription | null = null;
    try {
      subscription = Notifications.addNotificationReceivedListener(() => {
        refetch();
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

  // Detect new pending orders and flash alert
  useEffect(() => {
    if (!storeOrders) return;

    const currentPendingIds = new Set(
      storeOrders.filter((o: any) => o.status === "pending").map((o: any) => o.id)
    );

    if (isFirstLoadRef.current) {
      prevPendingIdsRef.current = currentPendingIds;
      isFirstLoadRef.current = false;
      // Also start alarm if there are already pending orders on first load
      if (currentPendingIds.size > 0) {
        startAlarm();
      }
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

      // Start persistent looping alarm
      startAlarm();
    }

    // Stop alarm when no more pending orders
    const pendingCount = storeOrders.filter((o: any) => o.status === "pending").length;
    if (pendingCount === 0) {
      stopAlarm();
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [storeOrders]);

  // Detect when a driver arrives at the store and play sound
  useEffect(() => {
    if (!storeOrders) return;

    const currentDriverAtStoreIds = new Set(
      storeOrders
        .filter((o: any) =>
          (o.status === "ready_for_pickup" || o.status === "picked_up") &&
          o.tracking?.some((t: any) => t.status === "driver_at_store")
        )
        .map((o: any) => o.id)
    );

    // Check for newly arrived drivers
    let hasNewArrival = false;
    currentDriverAtStoreIds.forEach((id) => {
      if (!prevDriverAtStoreIdsRef.current.has(id)) {
        hasNewArrival = true;
      }
    });

    if (hasNewArrival) {
      playDriverArrivedSound();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    prevDriverAtStoreIdsRef.current = currentDriverAtStoreIds;
  }, [storeOrders]);

  // Tick every second for preparation timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const { logout: authLogout } = useAuth();
  const utils = trpc.useUtils();

  const handleLogout = async () => {
    const confirmed = await confirmAction("Log Out", "Are you sure you want to log out?");
    if (!confirmed) return;
    try {
      // Use useAuth logout which clears API session + SecureStore + sets user to null
      await authLogout();
      // Clear additional local storage
      await AsyncStorage.multiRemove(["user", "authToken", "userRole", "appMode"]);
      // Clear tRPC cache
      utils.invalidate();
      // Navigate
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch (error) {
      // Force clear on error
      try {
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
      } catch (e) { /* ignore */ }
      await AsyncStorage.multiRemove(["user", "authToken", "userRole", "appMode"]);
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/(tabs)" as any);
      }
    }
  };

  const handlePrintOrder = useCallback(async (orderId: number) => {
    if (!storeId) return;
    try {
      setPrintingOrderId(orderId);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const result = await createPrintJobMutation.mutateAsync({
        orderId,
        storeId,
      });
      setPrintSuccess(orderId);
      setTimeout(() => setPrintSuccess(null), 3000);

      // Trigger local print via a new browser window with receipt-only content
      if (typeof window !== "undefined" && result?.receiptContent) {
        try {
          const receiptHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt - Order #${orderId}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  @media print { body { margin: 0; padding: 2mm; } }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    margin: 0;
    padding: 8px;
    max-width: 58mm;
    white-space: pre-wrap;
    word-wrap: break-word;
    background: #fff;
    color: #000;
  }
</style>
</head><body>${result.receiptContent.replace(/\n/g, "<br>")}</body></html>`;
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
                // Close the window after printing (or after cancel)
                printWindow.onafterprint = () => printWindow.close();
                // Fallback close after 30 seconds in case onafterprint doesn't fire
                setTimeout(() => { try { printWindow.close(); } catch(e) {} }, 30000);
              }, 500);
            };
          }
        } catch (e) {
          console.log("[Print] Local print attempt:", e);
        }
      }
    } catch (error: any) {
      console.error("Print error:", error);
      showAlert("Print Error", error.message || "Failed to send print job");
    } finally {
      setPrintingOrderId(null);
    }
  }, [storeId, createPrintJobMutation]);

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
      case "delivered": return "bg-surface border-border";
      case "cancelled": return "bg-error/10 border-error";
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

  // Check if an order has a "driver_at_store" tracking event
  const hasDriverAtStore = (order: any): boolean => {
    if (!order.tracking) return false;
    return order.tracking.some((t: any) => t.status === "driver_at_store");
  };

  // Get driver name from order (if assigned)
  const getDriverName = (order: any): string | null => {
    // driverName now returns "Driver 01" format from server
    if (order.driverName) return order.driverName;
    return null;
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
  const completedStatuses = ["delivered", "cancelled"];

  const filteredOrders = allOrders.filter((order: any) => {
    if (filter === "all") return activeStatuses.includes(order.status);
    if (filter === "completed") return completedStatuses.includes(order.status);
    return order.status === filter;
  });

  // For completed tab: show last 24 hours by default, with option to view older
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sortedOrders = filter === "completed"
    ? [...filteredOrders]
        .filter((o: any) => showAllHistory || new Date(o.updatedAt || o.createdAt) >= twentyFourHoursAgo)
        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    : filteredOrders;

  // Count orders older than 24 hours for the "View History" button
  const olderCompletedCount = filter === "completed"
    ? filteredOrders.filter((o: any) => new Date(o.updatedAt || o.createdAt) < twentyFourHoursAgo).length
    : 0;

  const pendingCount = allOrders.filter((o: any) => o.status === "pending").length;
  const preparingCount = allOrders.filter((o: any) => o.status === "preparing").length;
  const readyCount = allOrders.filter((o: any) => o.status === "ready_for_pickup").length;
  const completedCount = allOrders.filter((o: any) => completedStatuses.includes(o.status)).length;

  // Count orders where driver is at the store
  const driverAtStoreOrders = allOrders.filter((o: any) =>
    (o.status === "ready_for_pickup" || o.status === "picked_up") && hasDriverAtStore(o)
  );

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View className="bg-primary p-4" style={{ flexGrow: 0, flexShrink: 0 }}>
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

        {/* Driver at Store Alert Banner */}
        {driverAtStoreOrders.length > 0 && filter !== "completed" && (
          <View style={{ backgroundColor: "#DBEAFE", padding: 12, borderWidth: 1, borderColor: "#3B82F6" }}>
            {driverAtStoreOrders.map((order: any) => {
              const driverName = getDriverName(order);
              return (
                <View key={order.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 2 }}>
                  <Text style={{ color: "#1E40AF", fontWeight: "700", fontSize: 14, textAlign: "center" }}>
                    🚗 {driverName || "Driver"} is at the store for {order.orderNumber || `#${order.id}`}
                  </Text>
                </View>
              );
            })}
            <Text style={{ color: "#1E40AF", fontSize: 12, textAlign: "center", marginTop: 2 }}>
              Please have the order ready at the counter
            </Text>
          </View>
        )}

        {/* Quick Actions Bar */}
        <View style={{ flexDirection: "row", backgroundColor: "rgba(10,126,164,0.05)", paddingVertical: 8, paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", flexGrow: 0, flexShrink: 0 }}>
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
          <TouchableOpacity
            onPress={() => router.push("/store/products")}
            style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" }}
          >
            <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>Products</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#f5f5f5", flexGrow: 0, flexShrink: 0 }}>
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              onPress={() => setFilter("all")}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: filter === "all" ? 2 : 0, borderBottomColor: "#0a7ea4" }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: filter === "all" ? "#0a7ea4" : "#687076" }}>
                All Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("pending")}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: filter === "pending" ? 2 : 0, borderBottomColor: "#0a7ea4" }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: filter === "pending" ? "#0a7ea4" : "#687076" }}>
                Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("preparing")}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: filter === "preparing" ? 2 : 0, borderBottomColor: "#0a7ea4" }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: filter === "preparing" ? "#0a7ea4" : "#687076" }}>
                Preparing{preparingCount > 0 ? ` (${preparingCount})` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("ready_for_pickup")}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: filter === "ready_for_pickup" ? 2 : 0, borderBottomColor: "#0a7ea4" }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: filter === "ready_for_pickup" ? "#0a7ea4" : "#687076" }}>
                Ready{readyCount > 0 ? ` (${readyCount})` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("completed")}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: filter === "completed" ? 2 : 0, borderBottomColor: "#0a7ea4" }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: filter === "completed" ? "#0a7ea4" : "#687076" }}>
                Completed{completedCount > 0 ? ` (${completedCount})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Orders List */}
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {sortedOrders.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
              <Text className="text-4xl mb-4">{filter === "completed" ? "✅" : "📦"}</Text>
              <Text className="text-muted text-lg">
                {filter === "completed"
                  ? (showAllHistory ? "No completed orders" : "No orders in the last 24 hours")
                  : "No orders"}
              </Text>
              <Text className="text-muted text-sm mt-2">
                {filter === "all" ? "New orders will appear here" :
                 filter === "completed" && !showAllHistory && olderCompletedCount > 0
                   ? `${olderCompletedCount} older order${olderCompletedCount > 1 ? 's' : ''} in history`
                   : filter === "completed" ? "Delivered and cancelled orders will appear here"
                   : `No ${filter.replace(/_/g, " ")} orders`}
              </Text>
              {filter === "completed" && !showAllHistory && olderCompletedCount > 0 && (
                <TouchableOpacity
                  onPress={() => setShowAllHistory(true)}
                  style={{ marginTop: 16, backgroundColor: "#0a7ea4", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>View Order History</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            sortedOrders.map((order: any) => (
              <View
                key={order.id}
                className={`mb-4 p-4 rounded-lg border-2 ${getStatusColor(order.status)}`}
              >
                {/* Driver at Store Indicator - prominent banner at top of order card */}
                {hasDriverAtStore(order) && (order.status === "ready_for_pickup" || order.status === "picked_up") && (
                  <View style={{
                    backgroundColor: "#DBEAFE",
                    borderWidth: 1,
                    borderColor: "#3B82F6",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                  }}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>🚗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1E40AF", fontWeight: "700", fontSize: 14 }}>
                        Driver is at the store!
                      </Text>
                      {getDriverName(order) && (
                        <Text style={{ color: "#1E40AF", fontSize: 12 }}>
                          {getDriverName(order)} is waiting to collect this order
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Order Header */}
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                    <Text className="text-muted text-xs">
                      {formatIrishDateTime(order.createdAt)}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                    <Text className="font-semibold text-sm">{getStatusText(order.status)}</Text>
                  </View>
                </View>

                {/* Preparation Timer */}
                {order.status === "preparing" && (() => {
                  // Find when order moved to preparing (from tracking or use acceptedAt/updatedAt)
                  const preparingEvent = order.tracking?.find((t: any) => t.status === "preparing" || t.status === "accepted");
                  const startTime = preparingEvent?.createdAt
                    ? new Date(preparingEvent.createdAt).getTime()
                    : order.acceptedAt
                    ? new Date(order.acceptedAt).getTime()
                    : new Date(order.updatedAt || order.createdAt).getTime();
                  const elapsedMs = now - startTime;
                  const elapsedMin = Math.floor(elapsedMs / 60000);
                  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
                  const isOverdue = elapsedMin >= 15;
                  const isWarning = elapsedMin >= 10 && elapsedMin < 15;
                  const timerColor = isOverdue ? "#EF4444" : isWarning ? "#F59E0B" : "#0a7ea4";
                  const bgColor = isOverdue ? "rgba(239,68,68,0.1)" : isWarning ? "rgba(245,158,11,0.1)" : "rgba(10,126,164,0.08)";
                  return (
                    <View style={{
                      backgroundColor: bgColor,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: isOverdue ? 1 : 0,
                      borderColor: isOverdue ? "#EF4444" : "transparent",
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontSize: 16, marginRight: 6 }}>{isOverdue ? "⚠️" : "⏱️"}</Text>
                        <Text style={{ color: timerColor, fontWeight: "600", fontSize: 13 }}>
                          {isOverdue ? "Overdue!" : isWarning ? "Getting long..." : "Preparing"}
                        </Text>
                      </View>
                      <Text style={{ color: timerColor, fontWeight: "700", fontSize: 18, fontVariant: ["tabular-nums"] }}>
                        {String(elapsedMin).padStart(2, "0")}:{String(elapsedSec).padStart(2, "0")}
                      </Text>
                    </View>
                  );
                })()}

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

                {/* Substitution Notice */}
                {order.allowSubstitution && (
                  <View style={{ backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#3B82F6", padding: 10, borderRadius: 8, marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "600" }}>
                      🔄 Customer allows substitutions if items out of stock
                    </Text>
                  </View>
                )}

                {/* Completed order info */}
                {order.status === "delivered" && (
                  <View style={{ backgroundColor: "rgba(34,197,94,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontWeight: "700" }}>✅ Delivered</Text>
                    {order.updatedAt && (
                      <Text style={{ color: "#687076", fontSize: 12, marginTop: 4 }}>
                        {formatIrishDateTime(order.updatedAt)}
                      </Text>
                    )}
                  </View>
                )}

                {order.status === "cancelled" && (
                  <View style={{ backgroundColor: "rgba(239,68,68,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#EF4444", fontWeight: "700" }}>✕ Cancelled</Text>
                    {order.updatedAt && (
                      <Text style={{ color: "#687076", fontSize: 12, marginTop: 4 }}>
                        {formatIrishDateTime(order.updatedAt)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Print Pick List Button - always visible so staff can reprint anytime */}
                {order.status !== "cancelled" && (
                  <TouchableOpacity
                    onPress={() => handlePrintOrder(order.id)}
                    disabled={printingOrderId === order.id}
                    style={{
                      backgroundColor: printSuccess === order.id ? "#22C55E" : "#1a1a2e",
                      padding: 14,
                      borderRadius: 8,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      marginBottom: 10,
                      opacity: printingOrderId === order.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{printSuccess === order.id ? "\u2705" : "\uD83D\uDDA8"}</Text>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                      {printingOrderId === order.id ? "Sending to Printer..." : printSuccess === order.id ? "Sent to Printer!" : "Print Pick List"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Action Buttons */}
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

                {order.status === "ready_for_pickup" && !hasDriverAtStore(order) && (
                  <View style={{ backgroundColor: "rgba(34,197,94,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontWeight: "700" }}>⏳ Waiting for Driver Pickup</Text>
                  </View>
                )}

                {order.status === "ready_for_pickup" && hasDriverAtStore(order) && (
                  <View style={{ backgroundColor: "rgba(59,130,246,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#1E40AF", fontWeight: "700" }}>📦 Hand order to driver</Text>
                  </View>
                )}

                {(order.status === "picked_up" || order.status === "on_the_way") && (
                  <View style={{ backgroundColor: "rgba(34,197,94,0.1)", padding: 12, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#22C55E", fontWeight: "700" }}>🚗 {getDriverName(order) || "Driver"} is delivering</Text>
                  </View>
                )}
              </View>
            ))
          )}
          {/* History toggle for completed tab */}
          {filter === "completed" && sortedOrders.length > 0 && !showAllHistory && olderCompletedCount > 0 && (
            <TouchableOpacity
              onPress={() => setShowAllHistory(true)}
              style={{ alignSelf: "center", marginVertical: 16, backgroundColor: "#0a7ea4", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>View {olderCompletedCount} Older Order{olderCompletedCount > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          {filter === "completed" && showAllHistory && (
            <TouchableOpacity
              onPress={() => setShowAllHistory(false)}
              style={{ alignSelf: "center", marginVertical: 16, backgroundColor: "#687076", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Show Last 24 Hours Only</Text>
            </TouchableOpacity>
          )}
          {filter === "completed" && sortedOrders.length > 0 && (
            <Text style={{ textAlign: "center", color: "#687076", fontSize: 12, marginBottom: 8 }}>
              {showAllHistory ? "Showing all order history" : "Showing last 24 hours"}
            </Text>
          )}
          {/* Bottom safe area spacer */}
          <View style={{ height: Math.max(insets.bottom, 16) }} />
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
