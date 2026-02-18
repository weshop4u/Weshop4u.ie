import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const ALL_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way", "delivered", "cancelled"] as const;
const STATUS_FILTERS = ["all", ...ALL_STATUSES];

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  return `${d.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} ${time}`;
}

function getTimeSince(date: Date | string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModalOrderId, setAssignModalOrderId] = useState<number | null>(null);
  const [statusModalOrderId, setStatusModalOrderId] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.admin.getAllOrders.useQuery(
    { status: statusFilter, limit: 100 },
    { refetchInterval: 10000 }
  );

  const { data: availableDrivers } = trpc.admin.getAvailableDriversForAssignment.useQuery(undefined, {
    enabled: assignModalOrderId !== null,
  });

  const updateStatusMutation = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => { Alert.alert("Error", err.message); },
  });

  const assignDriverMutation = trpc.admin.assignDriver.useMutation({
    onSuccess: () => { refetch(); setAssignModalOrderId(null); },
    onError: (err) => { Alert.alert("Error", err.message); },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleUpdateStatus = (orderId: number, status: string) => {
    if (status === "cancelled") {
      Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => {
          updateStatusMutation.mutate({ orderId, status: status as any, reason: "Cancelled by admin" });
          setStatusModalOrderId(null);
        }},
      ]);
    } else {
      updateStatusMutation.mutate({ orderId, status: status as any });
      setStatusModalOrderId(null);
    }
  };

  const handleAssignDriver = (orderId: number, driverUserId: number) => {
    assignDriverMutation.mutate({ orderId, driverUserId });
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  // Count pending orders waiting > 5 min
  const alertOrders = (orders || []).filter(o => {
    if (o.status !== "pending") return false;
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins > 5;
  });

  return (
    <ScreenContainer className="bg-background">
      {/* Alert Banner */}
      {alertOrders.length > 0 && (
        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F59E0B" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#D97706" }}>
            {alertOrders.length} order{alertOrders.length > 1 ? "s" : ""} waiting 5+ minutes without a driver
          </Text>
        </View>
      )}

      {/* Status Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-border" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        {STATUS_FILTERS.map(status => {
          const active = statusFilter === status;
          const label = status === "all" ? "All" : status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
          const count = status === "all" ? (orders?.length || 0) : (orders?.filter(o => o.status === status).length || 0);
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
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#151718" : "#687076" }}>
                {label}
              </Text>
              {count > 0 && (
                <View style={{ backgroundColor: active ? "rgba(0,0,0,0.15)" : "#E5E7EB", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: active ? "#151718" : "#687076" }}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom, paddingHorizontal: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        {orders && orders.length > 0 ? (
          <View className="gap-3">
            {orders.map(order => {
              const sc = STATUS_COLORS[order.status] || { bg: "#F3F4F6", text: "#6B7280" };
              const expanded = expandedId === order.id;
              const isActive = !["delivered", "cancelled"].includes(order.status);
              const waitTime = getTimeSince(order.createdAt);
              const isWaiting = order.status === "pending" && (Date.now() - new Date(order.createdAt).getTime()) > 300000;

              return (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => setExpandedId(expanded ? null : order.id)}
                  style={isWaiting ? { borderColor: "#F59E0B", borderWidth: 2, borderRadius: 12, overflow: "hidden" } : undefined}
                  className={isWaiting ? "bg-surface" : "bg-surface rounded-xl border border-border overflow-hidden"}
                >
                  {/* Order Header */}
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2 flex-1">
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
                      <Text style={{ fontSize: 12, color: isWaiting ? "#D97706" : "#687076", fontWeight: isWaiting ? "700" : "400" }}>
                        {waitTime}
                      </Text>
                    </View>

                    {/* Driver assignment status */}
                    <View className="flex-row items-center mt-2 gap-2">
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: order.driverName === "Unassigned" ? "#F59E0B" : "#22C55E" }} />
                      <Text style={{ fontSize: 12, color: order.driverName === "Unassigned" ? "#D97706" : "#059669", fontWeight: "600" }}>
                        {order.driverName}
                      </Text>
                      {order.paymentMethod === "cash_on_delivery" && (
                        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}>CASH</Text>
                        </View>
                      )}
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

                        {order.deliveryDistance && (
                          <View className="flex-row justify-between mt-1">
                            <Text className="text-sm text-muted">Distance</Text>
                            <Text className="text-sm text-foreground">{parseFloat(order.deliveryDistance).toFixed(1)} km</Text>
                          </View>
                        )}

                        <View className="mt-2 pt-2 border-t border-border">
                          <Text className="text-sm text-muted mb-1">Delivery Address</Text>
                          <Text className="text-sm text-foreground">{order.deliveryAddress}</Text>
                        </View>

                        {order.customerNotes && (
                          <View className="mt-2">
                            <Text className="text-sm text-muted mb-1">Notes</Text>
                            <Text className="text-sm text-foreground italic">{order.customerNotes}</Text>
                          </View>
                        )}

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

                        {/* Action Buttons */}
                        {isActive && (
                          <View className="mt-3 pt-3 border-t border-border gap-2">
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 4 }}>ACTIONS</Text>

                            {/* Assign / Reassign Driver */}
                            <TouchableOpacity
                              onPress={() => setAssignModalOrderId(order.id)}
                              style={{ backgroundColor: "#DBEAFE", padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#2563EB" }}>
                                {order.driverName === "Unassigned" ? "Assign Driver" : "Reassign Driver"}
                              </Text>
                            </TouchableOpacity>

                            {/* Update Status */}
                            <TouchableOpacity
                              onPress={() => setStatusModalOrderId(order.id)}
                              style={{ backgroundColor: "#E0E7FF", padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#4F46E5" }}>Update Status</Text>
                            </TouchableOpacity>

                            {/* Cancel Order */}
                            <TouchableOpacity
                              onPress={() => handleUpdateStatus(order.id, "cancelled")}
                              style={{ backgroundColor: "#FEE2E2", padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#DC2626" }}>Cancel Order</Text>
                            </TouchableOpacity>
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

      {/* Assign Driver Modal */}
      <Modal visible={assignModalOrderId !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1e2022", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: insets.bottom + 16 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#334155", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#ECEDEE" }}>Assign Driver</Text>
              <TouchableOpacity onPress={() => setAssignModalOrderId(null)}>
                <Text style={{ fontSize: 16, color: "#00E5FF", fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableDrivers || []}
              keyExtractor={(item) => String(item.userId)}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => {
                const statusColor = item.isOnline ? (item.isAvailable ? "#22C55E" : "#F59E0B") : "#9BA1A6";
                const statusLabel = item.isOnline ? (item.isAvailable ? "Available" : "Busy") : "Offline";
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (assignModalOrderId) handleAssignDriver(assignModalOrderId, item.userId);
                    }}
                    style={{ backgroundColor: "#151718", padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#334155" }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: "#ECEDEE" }}>
                            {item.displayNumber ? `Driver ${item.displayNumber}` : item.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: statusColor, fontWeight: "600" }}>{statusLabel}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 12, color: "#9BA1A6" }}>{item.totalDeliveries || 0} deliveries</Text>
                        <Text style={{ fontSize: 12, color: "#9BA1A6" }}>{item.vehicleType || "—"}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <Text style={{ color: "#9BA1A6" }}>No drivers registered</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Update Status Modal */}
      <Modal visible={statusModalOrderId !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1e2022", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#334155", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#ECEDEE" }}>Update Status</Text>
              <TouchableOpacity onPress={() => setStatusModalOrderId(null)}>
                <Text style={{ fontSize: 16, color: "#00E5FF", fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {ALL_STATUSES.map(status => {
                const sc = STATUS_COLORS[status];
                const label = status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                const currentOrder = orders?.find(o => o.id === statusModalOrderId);
                const isCurrent = currentOrder?.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => {
                      if (statusModalOrderId && !isCurrent) handleUpdateStatus(statusModalOrderId, status);
                    }}
                    style={{
                      backgroundColor: isCurrent ? sc.bg : "#151718",
                      padding: 14,
                      borderRadius: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: isCurrent ? sc.text : "#334155",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sc.text }} />
                    <Text style={{ fontSize: 15, fontWeight: isCurrent ? "800" : "600", color: isCurrent ? sc.text : "#ECEDEE" }}>
                      {label} {isCurrent ? "(Current)" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
