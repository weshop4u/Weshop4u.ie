import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function StoreDashboardScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "preparing">("all");

  // Mock store data - will be replaced with real data from backend
  const storeId = 1; // Spar Balbriggan
  const storeName = "Spar Balbriggan";

  // Mock orders - will be replaced with real-time data
  const mockOrders = [
    {
      id: 1,
      orderNumber: "WS4U-123456",
      customerName: "John Doe",
      status: "pending",
      items: [
        { id: 1, name: "Chicken Fillet Roll", quantity: 1, category: "deli", notes: "No mayo" },
        { id: 2, name: "Coca Cola 500ml", quantity: 2, category: "drinks" },
        { id: 3, name: "Marlboro Red", quantity: 1, category: "tobacco" },
      ],
      subtotal: 16.61,
      deliveryFee: 3.90,
      total: 20.51,
      paymentMethod: "card" as const,
      createdAt: "2026-02-09 14:30",
    },
    {
      id: 2,
      orderNumber: "WS4U-123457",
      customerName: "Jane Smith",
      status: "preparing",
      items: [
        { id: 4, name: "Breakfast Roll", quantity: 1, category: "deli", notes: "Extra bacon" },
        { id: 5, name: "Coffee", quantity: 1, category: "drinks" },
      ],
      subtotal: 8.50,
      deliveryFee: 3.50,
      total: 12.00,
      paymentMethod: "cash_on_delivery" as const,
      createdAt: "2026-02-09 14:15",
    },
  ];

  useEffect(() => {
    // Load orders from backend
    setOrders(mockOrders);

    // TODO: Set up real-time polling or WebSocket connection
    // const interval = setInterval(() => {
    //   // Fetch new orders
    // }, 5000);
    // return () => clearInterval(interval);
  }, []);

  const handleAcceptOrder = (orderId: number) => {
    Alert.alert(
      "Accept Order",
      "Accept this order and start preparing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: () => {
            // TODO: Call backend API to accept order
            setOrders(orders.map(order =>
              order.id === orderId ? { ...order, status: "preparing" } : order
            ));
            Alert.alert("Success", "Order accepted! Start preparing items.");
          },
        },
      ]
    );
  };

  const handleRejectOrder = (orderId: number) => {
    Alert.alert(
      "Reject Order",
      "Are you sure you want to reject this order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            // TODO: Call backend API to reject order
            setOrders(orders.filter(order => order.id !== orderId));
            Alert.alert("Order Rejected", "The customer has been notified.");
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
          onPress: () => {
            // TODO: Call backend API to update order status
            setOrders(orders.map(order =>
              order.id === orderId ? { ...order, status: "ready_for_pickup" } : order
            ));
            Alert.alert("Success", "Order marked as ready! Driver will be notified.");
          },
        },
      ]
    );
  };

  const filteredOrders = orders.filter(order => {
    if (filter === "all") return order.status !== "delivered";
    return order.status === filter;
  });

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
      case "preparing": return "Preparing";
      case "ready_for_pickup": return "Ready for Pickup";
      default: return status;
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-primary p-4">
          <Text className="text-background text-2xl font-bold">{storeName}</Text>
          <Text className="text-background/80 text-sm">Store Dashboard</Text>
        </View>

        {/* Navigation Tabs */}
        <View className="flex-row bg-surface border-b border-border">
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={`flex-1 p-4 ${filter === "all" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold ${filter === "all" ? "text-primary" : "text-muted"}`}>
              All Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("pending")}
            className={`flex-1 p-4 ${filter === "pending" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold ${filter === "pending" ? "text-primary" : "text-muted"}`}>
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("preparing")}
            className={`flex-1 p-4 ${filter === "preparing" ? "border-b-2 border-primary" : ""}`}
          >
            <Text className={`text-center font-semibold ${filter === "preparing" ? "text-primary" : "text-muted"}`}>
              Preparing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/store/deli")}
            className="flex-1 p-4"
          >
            <Text className="text-center font-semibold text-muted">
              Deli View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <ScrollView className="flex-1 p-4">
          {filteredOrders.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-muted text-lg">No orders yet</Text>
              <Text className="text-muted text-sm mt-2">New orders will appear here</Text>
            </View>
          ) : (
            filteredOrders.map((order) => (
              <View
                key={order.id}
                className={`mb-4 p-4 rounded-lg border-2 ${getStatusColor(order.status)}`}
              >
                {/* Order Header */}
                <View className="flex-row justify-between items-center mb-3">
                  <View>
                    <Text className="text-foreground font-bold text-lg">{order.orderNumber}</Text>
                    <Text className="text-muted text-sm">{order.customerName}</Text>
                    <Text className="text-muted text-xs">{order.createdAt}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                    <Text className="font-semibold text-sm">{getStatusText(order.status)}</Text>
                  </View>
                </View>

                {/* Order Items */}
                <View className="bg-background p-3 rounded-lg mb-3">
                  {order.items.map((item: any) => (
                    <View key={item.id} className="flex-row justify-between py-2 border-b border-border last:border-b-0">
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">
                          {item.quantity}x {item.name}
                          {item.category === "deli" && " 🥪"}
                        </Text>
                        {item.notes && (
                          <Text className="text-muted text-sm italic">{item.notes}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Payment Info */}
                <View className="flex-row justify-between mb-3">
                  <Text className="text-muted">Payment</Text>
                  <Text className="text-foreground font-semibold">
                    {order.paymentMethod === "card" ? "Card (Paid)" : "Cash on Delivery"}
                  </Text>
                </View>

                <View className="flex-row justify-between mb-3">
                  <Text className="text-muted">Total</Text>
                  <Text className="text-foreground font-bold text-lg">€{order.total.toFixed(2)}</Text>
                </View>

                {/* Action Buttons */}
                {order.status === "pending" && (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleRejectOrder(order.id)}
                      className="flex-1 bg-error p-3 rounded-lg items-center active:opacity-70"
                    >
                      <Text className="text-background font-bold">Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAcceptOrder(order.id)}
                      className="flex-1 bg-success p-3 rounded-lg items-center active:opacity-70"
                    >
                      <Text className="text-background font-bold">Accept Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {order.status === "preparing" && (
                  <TouchableOpacity
                    onPress={() => handleMarkReady(order.id)}
                    className="bg-success p-4 rounded-lg items-center active:opacity-70"
                  >
                    <Text className="text-background font-bold text-lg">✓ Mark Ready for Pickup</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
