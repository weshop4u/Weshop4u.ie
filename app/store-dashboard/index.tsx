import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, AppState } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const isExpoGo = Constants.appOwnership === "expo";

export default function StoreDashboardScreen() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Register push token for store staff
  usePushNotifications(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const prevPendingIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const audioPlayer = useAudioPlayer("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get pending orders for the store
  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5000 }
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation();

  // Enable audio playback in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

  // Listen for push notifications (new order alerts from server)
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isExpoGo) return; // Skip in Expo Go
    let subscription: Notifications.Subscription | null = null;
    try {
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        if (data?.type === "new_order") {
          // Immediately refetch orders when we get a push notification
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

  // Detect new pending orders and play alert
  useEffect(() => {
    if (!orders) return;

    const currentPendingIds = new Set(
      orders.filter((o: any) => o.status === "pending").map((o: any) => o.id)
    );

    if (isFirstLoadRef.current) {
      // First load — just record current state, don't alert
      prevPendingIdsRef.current = currentPendingIds;
      isFirstLoadRef.current = false;
      return;
    }

    // Check if there are any NEW pending orders (IDs we haven't seen before)
    const newPendingOrders: number[] = [];
    currentPendingIds.forEach((id) => {
      if (!prevPendingIdsRef.current.has(id)) {
        newPendingOrders.push(id);
      }
    });

    if (newPendingOrders.length > 0) {
      // New order(s) detected!
      setNewOrderFlash(true);
      setTimeout(() => setNewOrderFlash(false), 3000);

      if (audioEnabled && Platform.OS !== "web") {
        // Play alert sound
        try {
          audioPlayer.seekTo(0);
          audioPlayer.play();
        } catch (e) {
          console.error("[Audio] Failed to play alert:", e);
        }

        // Haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [orders, audioEnabled, audioPlayer]);

  // Repeating alert sound while there are unaccepted pending orders
  useEffect(() => {
    const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];

    if (pendingOrders.length > 0 && audioEnabled && Platform.OS !== "web") {
      // Clear any existing timer
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);

      // Play alert every 30 seconds while orders are pending
      repeatTimerRef.current = setInterval(() => {
        try {
          audioPlayer.seekTo(0);
          audioPlayer.play();
        } catch (e) {
          // Ignore audio errors
        }
      }, 30000);
    } else {
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
    }

    return () => {
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
    };
  }, [orders, audioEnabled, audioPlayer]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await updateStatusMutation.mutateAsync({
        orderId,
        status: status as any,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning/10 border-warning text-warning";
      case "accepted":
      case "preparing":
        return "bg-primary/10 border-primary text-primary";
      case "ready_for_pickup":
        return "bg-success/10 border-success text-success";
      default:
        return "bg-surface border-border text-muted";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return { status: "accepted", label: "Accept Order" };
      case "accepted":
        return { status: "preparing", label: "Start Preparing" };
      case "preparing":
        return { status: "ready_for_pickup", label: "Mark Ready" };
      default:
        return null;
    }
  };

  if (userLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!user || user.role !== "store_staff") {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center mb-4">
          You don't have permission to access the store dashboard.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-8 py-3 rounded-full active:opacity-70"
        >
          <Text className="text-background font-bold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];
  const activeOrders = orders?.filter((o: any) => ["accepted", "preparing", "ready_for_pickup"].includes(o.status)) || [];

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Store Dashboard</Text>
          <Text className="text-muted">Manage incoming orders</Text>
        </View>

        {/* Audio Toggle */}
        <View className="bg-surface p-4 rounded-lg mb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-foreground font-bold">Audio Alerts</Text>
            <Text className="text-muted text-sm">
              {audioEnabled ? "Sound plays when new orders arrive" : "Audio alerts are muted"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAudioEnabled(!audioEnabled)}
            style={{
              width: 64,
              height: 32,
              borderRadius: 16,
              backgroundColor: audioEnabled ? "#22C55E" : "#9BA1A6",
              justifyContent: "center",
              paddingHorizontal: 4,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#fff",
                alignSelf: audioEnabled ? "flex-end" : "flex-start",
              }}
            />
          </TouchableOpacity>
        </View>

        {/* New Order Flash Banner */}
        {newOrderFlash && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: "#F59E0B" }}>
            <Text style={{ color: "#92400E", fontWeight: "700", textAlign: "center", fontSize: 16 }}>
              🔔 NEW ORDER RECEIVED!
            </Text>
          </View>
        )}

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Text className="text-xl font-bold text-foreground">
                🔔 New Orders
              </Text>
              <View style={{ backgroundColor: "#EF4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{pendingOrders.length}</Text>
              </View>
            </View>
            {pendingOrders.map((order: any) => {
              const nextStatus = getNextStatus(order.status);
              return (
                <View
                  key={order.id}
                  className="bg-warning/10 border-2 border-warning rounded-xl p-4 mb-3"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">
                        Order #{order.orderNumber}
                      </Text>
                      <Text className="text-muted text-sm">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text className="text-xl font-bold text-foreground">€{order.total}</Text>
                  </View>

                  {/* Payment Method */}
                  <View className="mb-2">
                    <Text className="text-xs text-muted mb-1">PAYMENT</Text>
                    <Text className="text-foreground font-semibold">
                      {order.paymentMethod === "card" ? "💳 Card" : "💵 Cash on Delivery"}
                    </Text>
                  </View>

                  <View className="mb-3">
                    <Text className="text-xs text-muted mb-1">DELIVERY TO</Text>
                    <Text className="text-foreground">{order.deliveryAddress}</Text>
                  </View>

                  {order.customerNotes ? (
                    <View className="mb-3">
                      <Text className="text-xs text-muted mb-1">NOTES</Text>
                      <Text className="text-foreground italic">{order.customerNotes}</Text>
                    </View>
                  ) : null}

                  {nextStatus && (
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(order.id, nextStatus.status)}
                      disabled={updateStatusMutation.isPending}
                      className="bg-primary p-3 rounded-lg items-center active:opacity-70"
                    >
                      <Text className="text-background font-bold">
                        {updateStatusMutation.isPending ? "Updating..." : nextStatus.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground mb-3">
              📦 Active Orders ({activeOrders.length})
            </Text>
            {activeOrders.map((order: any) => {
              const nextStatus = getNextStatus(order.status);
              return (
                <View
                  key={order.id}
                  className="bg-surface border border-border rounded-xl p-4 mb-3"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">
                        Order #{order.orderNumber}
                      </Text>
                      <Text className="text-muted text-sm">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </Text>
                    </View>
                    <View className={`rounded-full px-3 py-1 border ${getStatusColor(order.status)}`}>
                      <Text className={`text-xs font-bold ${getStatusColor(order.status)}`}>
                        {order.status.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View className="mb-3">
                    <Text className="text-xs text-muted mb-1">DELIVERY TO</Text>
                    <Text className="text-foreground">{order.deliveryAddress}</Text>
                  </View>

                  <View className="flex-row justify-between mb-3">
                    <View>
                      <Text className="text-xs text-muted">Order Total</Text>
                      <Text className="text-foreground font-semibold">€{order.total}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted">Payment</Text>
                      <Text className="text-foreground font-semibold">
                        {order.paymentMethod === "card" ? "💳 Card" : "💵 Cash"}
                      </Text>
                    </View>
                  </View>

                  {nextStatus && (
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(order.id, nextStatus.status)}
                      disabled={updateStatusMutation.isPending}
                      className="bg-primary p-3 rounded-lg items-center active:opacity-70"
                    >
                      <Text className="text-background font-bold">
                        {updateStatusMutation.isPending ? "Updating..." : nextStatus.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && (!orders || orders.length === 0) && (
          <View className="bg-surface p-8 rounded-lg items-center">
            <Text className="text-4xl mb-4">📦</Text>
            <Text className="text-xl font-bold text-foreground mb-2">No Orders Yet</Text>
            <Text className="text-muted text-center">
              New orders will appear here. You'll get an alert when one comes in.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
