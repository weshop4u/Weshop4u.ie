import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function DeliViewScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);

  // Mock store data
  const storeName = "Spar Balbriggan - Deli";

  // Mock orders with deli items - will be replaced with real-time data
  const mockOrders = [
    {
      id: 1,
      orderNumber: "WS4U-123456",
      customerName: "John Doe",
      status: "preparing",
      deliItems: [
        { id: 1, name: "Chicken Fillet Roll", quantity: 1, notes: "No mayo", isReady: false },
      ],
      otherItemsCount: 2, // Coca Cola, Marlboro
      createdAt: "2026-02-09 14:30",
    },
    {
      id: 2,
      orderNumber: "WS4U-123457",
      customerName: "Jane Smith",
      status: "preparing",
      deliItems: [
        { id: 4, name: "Breakfast Roll", quantity: 1, notes: "Extra bacon", isReady: false },
      ],
      otherItemsCount: 1, // Coffee
      createdAt: "2026-02-09 14:15",
    },
    {
      id: 3,
      orderNumber: "WS4U-123458",
      customerName: "Mike Johnson",
      status: "preparing",
      deliItems: [
        { id: 6, name: "Ham & Cheese Toastie", quantity: 2, notes: "", isReady: true },
      ],
      otherItemsCount: 0,
      createdAt: "2026-02-09 14:00",
    },
  ];

  useEffect(() => {
    // Load orders with deli items from backend
    setOrders(mockOrders);

    // TODO: Set up real-time polling or WebSocket connection
    // const interval = setInterval(() => {
    //   // Fetch orders with deli items
    // }, 5000);
    // return () => clearInterval(interval);
  }, []);

  const handleMarkItemReady = (orderId: number, itemId: number) => {
    Alert.alert(
      "Mark Item Ready",
      "Is this deli item complete and ready?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Ready",
          onPress: () => {
            // TODO: Call backend API to mark deli item as ready
            setOrders(orders.map(order => {
              if (order.id === orderId) {
                return {
                  ...order,
                  deliItems: order.deliItems.map((item: any) =>
                    item.id === itemId ? { ...item, isReady: true } : item
                  ),
                };
              }
              return order;
            }));
          },
        },
      ]
    );
  };

  const handleMarkAllReady = (orderId: number) => {
    Alert.alert(
      "Mark All Deli Items Ready",
      "Are all deli items for this order complete?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All Ready",
          onPress: () => {
            // TODO: Call backend API to mark all deli items as ready
            setOrders(orders.map(order => {
              if (order.id === orderId) {
                return {
                  ...order,
                  deliItems: order.deliItems.map((item: any) => ({ ...item, isReady: true })),
                };
              }
              return order;
            }));
            Alert.alert("Success", "All deli items marked as ready!");
          },
        },
      ]
    );
  };

  const activeOrders = orders.filter(order =>
    order.deliItems.some((item: any) => !item.isReady)
  );

  const completedOrders = orders.filter(order =>
    order.deliItems.every((item: any) => item.isReady)
  );

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-primary p-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-2 active:opacity-70"
          >
            <Text className="text-background text-sm">← Back to Main Dashboard</Text>
          </TouchableOpacity>
          <Text className="text-background text-2xl font-bold">{storeName}</Text>
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

        <ScrollView className="flex-1 p-4">
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <View className="mb-6">
              <Text className="text-foreground font-bold text-xl mb-3">🔥 Active Orders</Text>
              {activeOrders.map((order) => (
                <View
                  key={order.id}
                  className="mb-4 p-4 rounded-lg border-2 bg-warning/10 border-warning"
                >
                  {/* Order Header */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View>
                      <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                      <Text className="text-muted text-sm">{order.customerName}</Text>
                      <Text className="text-muted text-xs">{order.createdAt}</Text>
                    </View>
                    <View className="bg-warning px-3 py-1 rounded-full">
                      <Text className="text-background font-bold text-sm">PREPARING</Text>
                    </View>
                  </View>

                  {/* Deli Items */}
                  <View className="bg-background p-3 rounded-lg mb-3">
                    <Text className="text-foreground font-bold mb-2">🥪 Deli Items:</Text>
                    {order.deliItems.map((item: any) => (
                      <View key={item.id} className="mb-3">
                        <View className="flex-row justify-between items-center">
                          <View className="flex-1">
                            <Text className="text-foreground font-semibold text-lg">
                              {item.quantity}x {item.name}
                            </Text>
                            {item.notes && (
                              <Text className="text-warning text-sm italic mt-1">
                                Note: {item.notes}
                              </Text>
                            )}
                          </View>
                          {item.isReady ? (
                            <View className="bg-success px-3 py-2 rounded-lg">
                              <Text className="text-background font-bold">✓ READY</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => handleMarkItemReady(order.id, item.id)}
                              className="bg-primary px-3 py-2 rounded-lg active:opacity-70"
                            >
                              <Text className="text-background font-bold">Mark Ready</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
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
                  {order.deliItems.some((item: any) => !item.isReady) && (
                    <TouchableOpacity
                      onPress={() => handleMarkAllReady(order.id)}
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
              {completedOrders.map((order) => (
                <View
                  key={order.id}
                  className="mb-4 p-4 rounded-lg border-2 bg-success/10 border-success"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                      <Text className="text-muted text-sm">{order.customerName}</Text>
                    </View>
                    <View className="bg-success px-3 py-1 rounded-full">
                      <Text className="text-background font-bold text-sm">READY</Text>
                    </View>
                  </View>

                  <View className="bg-background p-3 rounded-lg">
                    {order.deliItems.map((item: any) => (
                      <Text key={item.id} className="text-foreground">
                        ✓ {item.quantity}x {item.name}
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
              <Text className="text-muted text-lg">No deli orders yet</Text>
              <Text className="text-muted text-sm mt-2">Orders with deli items will appear here</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
