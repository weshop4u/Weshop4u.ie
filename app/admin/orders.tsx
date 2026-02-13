import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useMemo } from "react";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#D97706" },
  accepted: { bg: "#DBEAFE", text: "#2563EB" },
  preparing: { bg: "#E0E7FF", text: "#4F46E5" },
  ready_for_pickup: { bg: "#D1FAE5", text: "#059669" },
  picked_up: { bg: "#CFFAFE", text: "#0891B2" },
  on_the_way: { bg: "#CCFBF1", text: "#0D9488" },
  delivered: { bg: "#DCFCE7", text: "#16A34A" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626" },
};

const STATUS_FILTERS = ["all", "pending", "accepted", "preparing", "ready_for_pickup", "on_the_way", "delivered", "cancelled"];

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  return `${d.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} ${time}`;
}

export default function AdminOrdersScreen() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: orders, isLoading, refetch } = trpc.admin.getAllOrders.useQuery(
    { status: statusFilter, limit: 100 },
    { refetchInterval: 15000 }
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      {/* Status Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-border" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        {STATUS_FILTERS.map(status => {
          const active = statusFilter === status;
          const label = status === "all" ? "All" : status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
          return (
            <TouchableOpacity
              key={status}
              onPress={() => setStatusFilter(status)}
              style={{
                backgroundColor: active ? "#00E5FF" : "transparent",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                marginRight: 8,
                borderWidth: active ? 0 : 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#151718" : "#687076" }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        {orders && orders.length > 0 ? (
          <View className="gap-3">
            {orders.map(order => {
              const sc = STATUS_COLORS[order.status] || { bg: "#F3F4F6", text: "#6B7280" };
              const expanded = expandedId === order.id;

              return (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => setExpandedId(expanded ? null : order.id)}
                  className="bg-surface rounded-xl border border-border overflow-hidden active:opacity-80"
                >
                  {/* Order Header */}
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-bold text-foreground">{order.orderNumber}</Text>
                        <View style={{ backgroundColor: sc.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>
                            {order.status.replace(/_/g, " ").toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-lg font-bold text-primary">€{parseFloat(order.total).toFixed(2)}</Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm text-muted" numberOfLines={1}>
                          {order.storeName} → {order.customerName}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted ml-2">{formatDate(order.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {expanded && (
                    <View className="px-4 pb-4 border-t border-border pt-3">
                      <View className="gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Customer</Text>
                          <Text className="text-sm text-foreground font-medium">{order.customerName}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Store</Text>
                          <Text className="text-sm text-foreground font-medium">{order.storeName}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Driver</Text>
                          <Text className="text-sm text-foreground font-medium">{order.driverName}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Payment</Text>
                          <Text className="text-sm text-foreground font-medium">
                            {order.paymentMethod === "card" ? "Card" : "Cash"} ({order.paymentStatus})
                          </Text>
                        </View>

                        {/* Price Breakdown */}
                        <View className="mt-2 pt-2 border-t border-border">
                          <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Subtotal</Text>
                            <Text className="text-sm text-foreground">€{parseFloat(order.subtotal).toFixed(2)}</Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Service Fee</Text>
                            <Text className="text-sm text-foreground">€{parseFloat(order.serviceFee).toFixed(2)}</Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Delivery Fee</Text>
                            <Text className="text-sm text-foreground">€{parseFloat(order.deliveryFee).toFixed(2)}</Text>
                          </View>
                          {parseFloat(order.tipAmount || "0") > 0 && (
                            <View className="flex-row justify-between">
                              <Text className="text-sm text-muted">Driver Tip</Text>
                              <Text style={{ fontSize: 14, color: "#8B5CF6" }}>€{parseFloat(order.tipAmount || "0").toFixed(2)}</Text>
                            </View>
                          )}
                        </View>

                        {/* Distance */}
                        {order.deliveryDistance && (
                          <View className="flex-row justify-between mt-1">
                            <Text className="text-sm text-muted">Distance</Text>
                            <Text className="text-sm text-foreground">{parseFloat(order.deliveryDistance).toFixed(1)} km</Text>
                          </View>
                        )}

                        {/* Delivery Address */}
                        <View className="mt-2 pt-2 border-t border-border">
                          <Text className="text-sm text-muted mb-1">Delivery Address</Text>
                          <Text className="text-sm text-foreground">{order.deliveryAddress}</Text>
                        </View>

                        {/* Customer Notes */}
                        {order.customerNotes && (
                          <View className="mt-2">
                            <Text className="text-sm text-muted mb-1">Notes</Text>
                            <Text className="text-sm text-foreground italic">{order.customerNotes}</Text>
                          </View>
                        )}

                        {/* Timestamps */}
                        {order.deliveredAt && (
                          <View className="flex-row justify-between mt-2">
                            <Text className="text-sm text-muted">Delivered</Text>
                            <Text className="text-sm text-foreground">{formatDate(order.deliveredAt)}</Text>
                          </View>
                        )}
                        {order.cancelledAt && (
                          <View className="flex-row justify-between mt-2">
                            <Text className="text-sm text-muted">Cancelled</Text>
                            <Text style={{ fontSize: 14, color: "#DC2626" }}>{formatDate(order.cancelledAt)}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-muted text-center text-base">
              {statusFilter === "all" ? "No orders yet" : `No ${statusFilter.replace(/_/g, " ")} orders`}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
