import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { formatIrishDateTime } from "@/lib/timezone";

// Web-compatible alert/confirm helpers
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const confirmAction = (title: string, message: string): Promise<boolean> => {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirm", onPress: () => resolve(true) },
    ]);
  });
};

export default function DeliViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const storeId = params.storeId ? Number(params.storeId) : 1;
  const [refreshing, setRefreshing] = useState(false);
  // Track locally which items are marked ready (since backend doesn't persist item-level readiness yet)
  const [readyItems, setReadyItems] = useState<Set<string>>(new Set());

  // Get store info
  const { data: storeInfo } = trpc.stores.getById.useQuery({ id: storeId });

  // Get deli orders from the real backend
  const { data: deliOrders, isLoading, refetch } = trpc.store.getDeliOrders.useQuery(
    { storeId },
    { refetchInterval: 5000 }
  );

  // Mutation for marking individual deli items ready (local + backend)
  const markDeliItemMutation = trpc.store.markDeliItemReady.useMutation();

  // Mutation for marking entire order as ready for pickup
  const markOrderReadyMutation = trpc.store.markOrderReady.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isItemReady = (orderId: number, itemId: number) => {
    return readyItems.has(`${orderId}-${itemId}`);
  };

  const handleMarkItemReady = async (orderId: number, itemId: number) => {
    const confirmed = await confirmAction("Mark Item Ready", "Is this deli item complete and ready?");
    if (!confirmed) return;
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await markDeliItemMutation.mutateAsync({
        orderItemId: itemId,
        orderId,
        storeId,
      });
      setReadyItems(prev => {
        const next = new Set(prev);
        next.add(`${orderId}-${itemId}`);
        return next;
      });
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to mark item ready");
    }
  };

  const handleMarkAllReady = async (orderId: number, items: any[]) => {
    const confirmed = await confirmAction("Mark All Deli Items Ready", "Are all deli items for this order complete?");
    if (!confirmed) return;
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      // Mark all items locally
      setReadyItems(prev => {
        const next = new Set(prev);
        items.forEach((item: any) => {
          next.add(`${orderId}-${item.id}`);
        });
        return next;
      });
      showAlert("Success", "All deli items marked as ready!");
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to mark items ready");
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading deli orders...</Text>
      </ScreenContainer>
    );
  }

  const storeName = storeInfo?.name || "Store";
  const orders = deliOrders || [];

  // Split into active (has unready items) and completed (all items ready)
  const activeOrders = orders.filter((order: any) =>
    order.deliItems?.some((item: any) => !isItemReady(order.id, item.id))
  );

  const completedOrders = orders.filter((order: any) =>
    order.deliItems?.length > 0 && order.deliItems.every((item: any) => isItemReady(order.id, item.id))
  );

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-primary p-4">
          <TouchableOpacity
            onPress={() => router.replace("/store" as any)}
            className="mb-2 active:opacity-70"
          >
            <Text className="text-background text-sm">← Back to Main Dashboard</Text>
          </TouchableOpacity>
          <Text className="text-background text-2xl font-bold">{storeName} - Deli</Text>
          <Text className="text-background/80 text-sm">Deli Orders Only</Text>
        </View>

        {/* Stats */}
        <View className="flex-row bg-surface p-4 border-b border-border">
          <View className="flex-1 items-center">
            <Text className="text-warning font-bold text-3xl">{activeOrders.length}</Text>
            <Text className="text-muted text-sm">Active</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-success font-bold text-3xl">{completedOrders.length}</Text>
            <Text className="text-muted text-sm">Ready</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <View className="mb-6">
              <Text className="text-foreground font-bold text-xl mb-3">🔥 Active Orders</Text>
              {activeOrders.map((order: any) => (
                <View
                  key={order.id}
                  className="mb-4 p-4 rounded-lg border-2 bg-warning/10 border-warning"
                >
                  {/* Order Header */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View>
                      <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                      <Text className="text-muted text-xs">
                        {formatIrishDateTime(order.createdAt)}
                      </Text>
                    </View>
                    <View className="bg-warning px-3 py-1 rounded-full">
                      <Text className="text-background font-bold text-sm">
                        {order.status === "preparing" ? "PREPARING" : order.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Deli Items */}
                  <View className="bg-background p-3 rounded-lg mb-3">
                    <Text className="text-foreground font-bold mb-2">🥪 Deli Items:</Text>
                    {order.deliItems?.map((item: any) => {
                      const mods = item.modifiers || [];
                      const grouped: Record<string, { name: string; price: string; count: number }[]> = {};
                      for (const m of mods) {
                        const gn = m.groupName || "Options";
                        if (!grouped[gn]) grouped[gn] = [];
                        const cleanName = m.modifierName.replace(/ ×\d+$/, '');
                        const existing = grouped[gn].find((d: any) => d.name === cleanName && d.price === m.modifierPrice);
                        if (existing) { existing.count++; } else { grouped[gn].push({ name: cleanName, price: m.modifierPrice, count: 1 }); }
                      }
                      return (
                        <View key={item.id} className="mb-3">
                          <View className="flex-row justify-between items-center">
                            <View className="flex-1">
                              <Text className="text-foreground font-semibold text-lg">
                                {item.quantity}x {item.product?.name || item.productName || "Item"}
                              </Text>
                              {item.specialInstructions && (
                                <Text className="text-warning text-sm italic mt-1">
                                  Note: {item.specialInstructions}
                                </Text>
                              )}
                            </View>
                            {isItemReady(order.id, item.id) ? (
                              <View className="bg-success px-3 py-2 rounded-lg">
                                <Text className="text-background font-bold">✓ READY</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleMarkItemReady(order.id, item.id)}
                                disabled={markDeliItemMutation.isPending}
                                className="bg-primary px-3 py-2 rounded-lg active:opacity-70"
                              >
                                <Text className="text-background font-bold">Mark Ready</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          {mods.length > 0 && (
                            <View style={{ marginLeft: 4, marginTop: 6 }}>
                              {Object.entries(grouped).map(([groupName, options]) => (
                                <View key={groupName} style={{ marginBottom: 3 }}>
                                  <Text className="text-muted" style={{ fontSize: 12, fontWeight: "600" }}>{groupName}:</Text>
                                  {options.map((opt: any, oi: number) => {
                                    const extraPrice = parseFloat(opt.price) * opt.count;
                                    return (
                                      <Text key={oi} className="text-foreground" style={{ fontSize: 13, marginLeft: 10, lineHeight: 20 }}>
                                        • {opt.name}{opt.count > 1 ? ` ×${opt.count}` : ""}{extraPrice > 0 ? ` +€${extraPrice.toFixed(2)}` : ""}
                                      </Text>
                                    );
                                  })}
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Other Items Info */}
                  {order.otherItemsCount > 0 && (
                    <View className="bg-muted/10 p-3 rounded-lg mb-3">
                      <Text className="text-muted text-sm">
                        📦 Other items in order: {order.otherItemsCount} item(s)
                      </Text>
                      <Text className="text-muted text-xs mt-1">
                        (Counter staff will collect these)
                      </Text>
                    </View>
                  )}

                  {/* Mark All Ready Button */}
                  {order.deliItems?.some((item: any) => !isItemReady(order.id, item.id)) && (
                    <TouchableOpacity
                      onPress={() => handleMarkAllReady(order.id, order.deliItems)}
                      className="bg-success p-4 rounded-lg items-center active:opacity-70"
                    >
                      <Text className="text-background font-bold text-lg">
                        ✓ Mark All Deli Items Ready
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <View className="mb-6">
              <Text className="text-foreground font-bold text-xl mb-3">✅ Completed</Text>
              {completedOrders.map((order: any) => (
                <View
                  key={order.id}
                  className="mb-4 p-4 rounded-lg border-2 bg-success/10 border-success"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                      <Text className="text-muted text-xs">
                        {formatIrishDateTime(order.createdAt)}
                      </Text>
                    </View>
                    <View className="bg-success px-3 py-1 rounded-full">
                      <Text className="text-background font-bold text-sm">READY</Text>
                    </View>
                  </View>

                  <View className="bg-background p-3 rounded-lg">
                    {order.deliItems?.map((item: any) => (
                      <Text key={item.id} className="text-foreground">
                        ✓ {item.quantity}x {item.product?.name || item.productName || "Item"}
                      </Text>
                    ))}
                  </View>

                  {order.otherItemsCount > 0 && (
                    <Text className="text-muted text-sm mt-2">
                      Waiting for counter staff to collect {order.otherItemsCount} other item(s)
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {activeOrders.length === 0 && completedOrders.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-4xl mb-4">🥪</Text>
              <Text className="text-muted text-lg">No deli orders</Text>
              <Text className="text-muted text-sm mt-2">
                Orders with deli items will appear here when they're being prepared
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
