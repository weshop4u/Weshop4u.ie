import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";

export default function OrderConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const orderIdNum = parseInt(orderId);
  const isGuest = !user;

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ orderId: orderIdNum });

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-muted mt-4">Loading order details...</Text>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-2xl mb-4">❌</Text>
        <Text className="text-foreground text-lg mb-2">Order not found</Text>
        <TouchableOpacity
          onPress={() => router.push("/")}
          className="bg-primary px-6 py-3 rounded-lg mt-4 active:opacity-70"
        >
          <Text className="text-background font-semibold">Back to Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { emoji: string; text: string; color: string }> = {
      pending: { emoji: "⏳", text: "Order Placed", color: "text-warning" },
      accepted: { emoji: "✅", text: "Accepted by Store", color: "text-success" },
      preparing: { emoji: "👨‍🍳", text: "Preparing Order", color: "text-primary" },
      ready_for_pickup: { emoji: "📦", text: "Ready for Pickup", color: "text-primary" },
      picked_up: { emoji: "🚗", text: "Driver Picked Up", color: "text-primary" },
      on_the_way: { emoji: "🛵", text: "On the Way", color: "text-primary" },
      delivered: { emoji: "✅", text: "Delivered", color: "text-success" },
      cancelled: { emoji: "❌", text: "Cancelled", color: "text-error" },
    };
    return statusMap[status] || { emoji: "📦", text: status, color: "text-muted" };
  };

  const statusDisplay = getStatusDisplay(order.status);

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Success Header */}
        <View className="items-center mb-8 mt-4">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-2xl font-bold text-foreground mb-2">Order Confirmed!</Text>
          <Text className="text-muted text-center">
            Your order has been placed successfully
          </Text>
        </View>

        {/* Order Number */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-muted text-sm mb-1">Order Number</Text>
          <Text className="text-foreground font-bold text-xl">{order.orderNumber}</Text>
        </View>

        {/* Guest Account Creation Prompt */}
        {isGuest && (
          <View style={{
            backgroundColor: colors.primary + '10',
            borderColor: colors.primary,
            borderWidth: 1.5,
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 8 }}>
              Create a Free Account
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 16 }}>
              Save your details for faster checkout next time, track your order history, and unlock higher spending limits.
            </Text>
            
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>✓</Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>Track all your orders in one place</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>✓</Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>Save your delivery address</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>✓</Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>Higher cash order limits (€50+)</Text>
              </View>
            </View>
            
            <TouchableOpacity
              onPress={() => router.push("/auth/register")}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                marginTop: 16,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                Create Account
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => {}} 
              style={{ padding: 8, alignItems: 'center', marginTop: 4 }}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                No thanks, continue as guest
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Status */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-muted text-sm mb-3">Current Status</Text>
          <View className="flex-row items-center">
            <Text className="text-4xl mr-3">{statusDisplay.emoji}</Text>
            <View>
              <Text className={`font-bold text-lg ${statusDisplay.color}`}>
                {statusDisplay.text}
              </Text>
              <Text className="text-muted text-sm">
                {order.status === "pending" && "Waiting for store to accept"}
                {order.status === "accepted" && "Store is preparing your order"}
                {order.status === "preparing" && "Your order is being prepared"}
                {order.status === "ready_for_pickup" && "Waiting for driver"}
                {order.status === "picked_up" && "Driver has your order"}
                {order.status === "on_the_way" && "Driver is heading to you"}
                {order.status === "delivered" && "Order completed"}
                {order.status === "cancelled" && "Order was cancelled"}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Details */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Delivery Details</Text>
          
          <View className="mb-3">
            <Text className="text-muted text-sm">Delivery Address</Text>
            <Text className="text-foreground">{order.deliveryAddress}</Text>
          </View>

          {order.deliveryDistance && (
            <View className="mb-3">
              <Text className="text-muted text-sm">Distance</Text>
              <Text className="text-foreground">{parseFloat(order.deliveryDistance).toFixed(2)} km</Text>
            </View>
          )}

          {order.customerNotes && (
            <View>
              <Text className="text-muted text-sm">Order Notes</Text>
              <Text className="text-foreground">{order.customerNotes}</Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Order Items</Text>
          {order.items.map((item: any) => {
            const mods = item.modifiers || [];
            // Group modifiers by group name, dedup quantities
            const grouped: Record<string, { name: string; price: string; count: number }[]> = {};
            for (const m of mods) {
              const gn = m.groupName || "Options";
              if (!grouped[gn]) grouped[gn] = [];
              const cleanName = m.modifierName.replace(/ ×\d+$/, '');
              const existing = grouped[gn].find((d: any) => d.name === cleanName && d.price === m.modifierPrice);
              if (existing) { existing.count++; } else { grouped[gn].push({ name: cleanName, price: m.modifierPrice, count: 1 }); }
            }
            return (
              <View key={item.id} style={{ marginBottom: 10 }}>
                <View className="flex-row justify-between">
                  <Text className="text-foreground flex-1 font-semibold">
                    {item.quantity}x {item.productName}
                  </Text>
                  <Text className="text-foreground font-semibold">
                    €{parseFloat(item.subtotal).toFixed(2)}
                  </Text>
                </View>
                {mods.length > 0 && (
                  <View style={{ marginLeft: 8, marginTop: 4 }}>
                    {Object.entries(grouped).map(([groupName, options]) => (
                      <View key={groupName} style={{ marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>{groupName}:</Text>
                        {options.map((opt: any, oi: number) => {
                          const extraPrice = parseFloat(opt.price) * opt.count;
                          return (
                            <Text key={oi} style={{ fontSize: 12, color: colors.foreground, marginLeft: 8, lineHeight: 18 }}>
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

        {/* Payment Summary */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Payment Summary</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-foreground">€{parseFloat(order.subtotal).toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Service Fee</Text>
            <Text className="text-foreground">€{parseFloat(order.serviceFee).toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
            <Text className="text-muted">Delivery Fee</Text>
            <Text className="text-foreground">€{parseFloat(order.deliveryFee).toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-3">
            <Text className="text-foreground font-bold text-lg">Total</Text>
            <Text className="text-primary font-bold text-lg">€{parseFloat(order.total).toFixed(2)}</Text>
          </View>

          <View className="pt-3 border-t border-border">
            <Text className="text-muted text-sm">Payment Method</Text>
            <Text className="text-foreground">
              {order.paymentMethod === "card" ? "Card Payment" : "Cash on Delivery"}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ marginBottom: Math.max(insets.bottom, 16) + 16, gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push(`/order-tracking/${orderId}`)}
            className="bg-primary p-4 rounded-lg items-center active:opacity-70"
          >
            <Text className="text-background font-bold text-lg">Track Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/")}
            className="bg-surface p-4 rounded-lg items-center active:opacity-70"
          >
            <Text className="text-foreground font-semibold">Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
