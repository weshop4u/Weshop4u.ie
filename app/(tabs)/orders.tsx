import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useCart } from "@/lib/cart-provider";

export default function OrderHistoryScreen() {
  const router = useRouter();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const { clearCart, addToCart } = useCart();

  // Fetch user's orders
  const { data: orders, isLoading } = trpc.orders.getUserOrders.useQuery();

  const handleReorder = (order: any) => {
    Alert.alert(
      "Reorder",
      `Add ${order.items.length} item(s) from ${order.store?.name} to your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reorder",
          onPress: () => {
            // Clear cart and add all items from the order
            clearCart();
            order.items.forEach(async (item: any) => {
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
            });
            // Navigate to cart
            router.push(`/cart/${order.storeId}`);
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-500";
      case "cancelled":
        return "text-red-500";
      case "on_the_way":
        return "text-blue-500";
      default:
        return "text-yellow-500";
    }
  };

  const getStatusText = (status: string) => {
    return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mr-4"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Order History</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {orders && orders.length > 0 ? (
          <View className="gap-4">
            {orders.map((order) => (
              <View
                key={order.id}
                className="bg-surface rounded-xl border border-border overflow-hidden"
              >
                {/* Order Header */}
                <TouchableOpacity
                  onPress={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  className="p-4 active:opacity-70"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        Order #{order.id}
                      </Text>
                      <Text className="text-muted text-sm">
                        {new Date(order.createdAt).toLocaleDateString("en-IE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className={`font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </Text>
                      <Text className="text-foreground font-bold text-lg mt-1">
                        €{parseFloat(order.total).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted text-sm">
                      {order.store?.name || "Store"}
                    </Text>
                    <Text className="text-primary text-sm">
                      {expandedOrderId === order.id ? "Hide Details ▲" : "View Details ▼"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Order Details */}
                {expandedOrderId === order.id && (
                  <View className="px-4 pb-4 border-t border-border">
                    <Text className="text-foreground font-semibold mt-3 mb-2">Items:</Text>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, index) => (
                        <View key={index} className="flex-row justify-between py-2">
                          <Text className="text-muted flex-1">
                            {item.quantity}x {item.product?.name || "Product"}
                          </Text>
                          <Text className="text-foreground font-semibold">
                            €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-muted text-sm">No items found</Text>
                    )}

                    <View className="border-t border-border mt-2 pt-2">
                      <View className="flex-row justify-between py-1">
                        <Text className="text-muted">Subtotal</Text>
                        <Text className="text-foreground">
                          €{(parseFloat(order.total) - parseFloat(order.deliveryFee || "0")).toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between py-1">
                        <Text className="text-muted">Delivery Fee</Text>
                        <Text className="text-foreground">€{parseFloat(order.deliveryFee || "0").toFixed(2)}</Text>
                      </View>
                      <View className="flex-row justify-between py-1 border-t border-border mt-1 pt-2">
                        <Text className="text-foreground font-bold">Total</Text>
                        <Text className="text-foreground font-bold">
                          €{parseFloat(order.total).toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {order.deliveryAddress && (
                      <View className="mt-3">
                        <Text className="text-foreground font-semibold mb-1">Delivery Address:</Text>
                        <Text className="text-muted text-sm">{order.deliveryAddress}</Text>
                      </View>
                    )}

                    {/* Reorder Button */}
                    {order.status === "delivered" && (
                      <TouchableOpacity
                        onPress={() => handleReorder(order)}
                        className="mt-4 bg-primary py-3 rounded-xl active:opacity-70"
                      >
                        <Text className="text-background text-center font-semibold">
                          Reorder
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-12">
            <Text className="text-6xl mb-4">📦</Text>
            <Text className="text-foreground font-bold text-xl mb-2">No Orders Yet</Text>
            <Text className="text-muted text-center mb-6">
              Your order history will appear here{"\n"}once you place your first order
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/")}
              className="bg-primary px-6 py-3 rounded-xl active:opacity-70"
            >
              <Text className="text-background font-semibold">Start Shopping</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
