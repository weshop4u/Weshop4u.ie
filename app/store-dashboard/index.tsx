import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

export default function StoreDashboardScreen() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  const [refreshing, setRefreshing] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const audioPlayer = useAudioPlayer("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"); // Notification sound
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Get pending orders for the store
  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5000 } // Poll every 5 seconds
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation();

  // Enable audio playback in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

  // Play sound when new order arrives
  useEffect(() => {
    if (orders && orders.length > lastOrderCount && lastOrderCount > 0 && audioEnabled) {
      if (Platform.OS !== "web") {
        audioPlayer.play();
      }
    }
    if (orders) {
      setLastOrderCount(orders.length);
    }
  }, [orders, lastOrderCount, audioEnabled, audioPlayer]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
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
        <View className="bg-surface p-4 rounded-lg mb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-foreground font-bold">Audio Alerts</Text>
            <Text className="text-muted text-sm">Play sound for new orders</Text>
          </View>
          <TouchableOpacity
            onPress={() => setAudioEnabled(!audioEnabled)}
            className={`w-16 h-8 rounded-full justify-center px-1 ${
              audioEnabled ? "bg-success" : "bg-border"
            }`}
          >
            <View
              className={`w-6 h-6 rounded-full bg-background shadow-lg ${
                audioEnabled ? "self-end" : "self-start"
              }`}
            />
          </TouchableOpacity>
        </View>

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground mb-3">
              🔔 New Orders ({pendingOrders.length})
            </Text>
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

                  <View className="mb-3">
                    <Text className="text-xs text-muted mb-1">DELIVERY TO</Text>
                    <Text className="text-foreground">{order.deliveryAddress}</Text>
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
              New orders will appear here. Pull down to refresh.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
