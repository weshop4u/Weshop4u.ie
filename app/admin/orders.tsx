import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, FlatList, Platform, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { StyleSheet } from "react-native";
import { formatIrishSmartDateTime, formatIrishTimeAgo } from "@/lib/timezone";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

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
  return formatIrishSmartDateTime(date);
}

function getTimeSince(date: Date | string | null): string {
  return formatIrishTimeAgo(date) || "";
}

type SortField = "date" | "total" | "status" | "store" | "customer";
type SortDir = "asc" | "desc";

function AdminOrdersScreenContent() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModalOrderId, setAssignModalOrderId] = useState<number | null>(null);
  const [statusModalOrderId, setStatusModalOrderId] = useState<number | null>(null);
  const [cancelConfirmOrderId, setCancelConfirmOrderId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: orders, isLoading, refetch } = trpc.admin.getAllOrders.useQuery(
    { status: statusFilter, limit: 100 },
    { refetchInterval: 10000 }
  );

  const { data: availableDrivers } = trpc.admin.getAvailableDriversForAssignment.useQuery(undefined, {
    enabled: assignModalOrderId !== null,
  });

  const updateStatusMutation = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => { refetch(); setErrorMessage(""); },
    onError: (err) => { setErrorMessage(err.message); },
  });

  const assignDriverMutation = trpc.admin.assignDriver.useMutation({
    onSuccess: () => { refetch(); setAssignModalOrderId(null); setErrorMessage(""); },
    onError: (err) => { setErrorMessage(err.message); },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleUpdateStatus = (orderId: number, status: string) => {
    if (status === "cancelled") {
      setCancelConfirmOrderId(orderId);
    } else {
      updateStatusMutation.mutate({ orderId, status: status as any });
      setStatusModalOrderId(null);
    }
  };

  const confirmCancelOrder = () => {
    if (cancelConfirmOrderId) {
      updateStatusMutation.mutate({ orderId: cancelConfirmOrderId, status: "cancelled" as any, reason: "Cancelled by admin" });
      setCancelConfirmOrderId(null);
      setStatusModalOrderId(null);
    }
  };

  const handleAssignDriver = (orderId: number, driverUserId: number) => {
    assignDriverMutation.mutate({ orderId, driverUserId });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedOrders = useMemo(() => {
    if (!orders) return [];
    const sorted = [...orders];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case "total": cmp = parseFloat(a.total) - parseFloat(b.total); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "store": cmp = (a.storeName ?? "").localeCompare(b.storeName ?? ""); break;
        case "customer": cmp = (a.customerName ?? "").localeCompare(b.customerName ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [orders, sortField, sortDir]);

  // Count pending orders waiting > 5 min
  const alertOrders = (orders || []).filter(o => {
    if (o.status !== "pending") return false;
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins > 5;
  });

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const SortHeader = ({ field, label, minW }: { field: SortField; label: string; minW?: number }) => (
    <TouchableOpacity
      onPress={() => toggleSort(field)}
      style={[dtStyles.th, minW ? { minWidth: minW } : { flex: 1 }]}
    >
      <Text style={dtStyles.thText}>
        {label} {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </Text>
    </TouchableOpacity>
  );

  // ─── DESKTOP TABLE LAYOUT ───
  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        {/* Error Banner */}
        {errorMessage ? (
          <TouchableOpacity
            onPress={() => setErrorMessage("")}
            style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EF4444" }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>
              Error: {errorMessage} (tap to dismiss)
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Alert Banner */}
        {alertOrders.length > 0 && (
          <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#D97706" }}>
              ⚠️ {alertOrders.length} order{alertOrders.length > 1 ? "s" : ""} waiting 5+ minutes without a driver
            </Text>
          </View>
        )}

        {/* Summary Stats Row */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          {STATUS_FILTERS.slice(0, 5).map(status => {
            const count = status === "all" ? (orders?.length || 0) : (orders?.filter(o => o.status === status).length || 0);
            const sc = STATUS_COLORS[status] || { bg: "#F3F4F6", text: "#6B7280" };
            const label = status === "all" ? "All Orders" : status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status)}
                style={{
                  flex: 1,
                  backgroundColor: statusFilter === status ? sc.bg || "#E0F7FA" : "#fff",
                  borderWidth: 1,
                  borderColor: statusFilter === status ? sc.text || "#00E5FF" : "#E2E8F0",
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800", color: sc.text || "#0F172A" }}>{count}</Text>
                <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "500", marginTop: 2 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Status Filter Pills */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {STATUS_FILTERS.map(status => {
            const active = statusFilter === status;
            const label = status === "all" ? "All" : status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            const count = status === "all" ? (orders?.length || 0) : (orders?.filter(o => o.status === status).length || 0);
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status)}
                style={{
                  backgroundColor: active ? "#0F172A" : "#fff",
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: active ? "#0F172A" : "#E2E8F0",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#64748B" }}>
                  {label}
                </Text>
                {count > 0 && (
                  <View style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : "#F1F5F9", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: active ? "#fff" : "#64748B" }}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Desktop Table */}
        <View style={dtStyles.tableContainer}>
          {/* Table Header */}
          <View style={dtStyles.thead}>
            <SortHeader field="date" label="Date" minW={130} />
            <View style={[dtStyles.th, { minWidth: 100 }]}><Text style={dtStyles.thText}>Order #</Text></View>
            <SortHeader field="store" label="Store" />
            <SortHeader field="customer" label="Customer" />
            <SortHeader field="status" label="Status" minW={120} />
            <View style={[dtStyles.th, { minWidth: 80 }]}><Text style={dtStyles.thText}>Driver</Text></View>
            <View style={[dtStyles.th, { minWidth: 80 }]}><Text style={dtStyles.thText}>Payment</Text></View>
            <SortHeader field="total" label="Total" minW={90} />
            <View style={[dtStyles.th, { minWidth: 160 }]}><Text style={dtStyles.thText}>Actions</Text></View>
          </View>

          {/* Table Body */}
          <ScrollView style={{ maxHeight: 600 }}>
            {sortedOrders.length > 0 ? sortedOrders.map(order => {
              const sc = STATUS_COLORS[order.status] || { bg: "#F3F4F6", text: "#6B7280" };
              const isActive = !["delivered", "cancelled"].includes(order.status);
              const isWaiting = order.status === "pending" && (Date.now() - new Date(order.createdAt).getTime()) > 300000;
              const expanded = expandedId === order.id;

              return (
                <View key={order.id}>
                  <TouchableOpacity
                    onPress={() => setExpandedId(expanded ? null : order.id)}
                    style={[dtStyles.tr, isWaiting && { backgroundColor: "#FFFBEB" }]}
                  >
                    <View style={[dtStyles.td, { minWidth: 130 }]}>
                      <Text style={dtStyles.tdText}>{formatDate(order.createdAt)}</Text>
                      <Text style={{ fontSize: 11, color: "#94A3B8" }}>{getTimeSince(order.createdAt)}</Text>
                    </View>
                    <View style={[dtStyles.td, { minWidth: 100 }]}>
                      <Text style={[dtStyles.tdText, { fontWeight: "700" }]}>{order.orderNumber}</Text>
                    </View>
                    <View style={[dtStyles.td, { flex: 1 }]}>
                      <Text style={dtStyles.tdText} numberOfLines={1}>{order.storeName}</Text>
                    </View>
                    <View style={[dtStyles.td, { flex: 1 }]}>
                      <Text style={dtStyles.tdText} numberOfLines={1}>{order.customerName}</Text>
                    </View>
                    <View style={[dtStyles.td, { minWidth: 120 }]}>
                      <View style={{ backgroundColor: sc.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>
                          {order.status.replace(/_/g, " ").toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={[dtStyles.td, { minWidth: 80 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: order.driverName === "Unassigned" ? "#F59E0B" : "#22C55E" }} />
                        <Text style={{ fontSize: 12, color: order.driverName === "Unassigned" ? "#D97706" : "#059669", fontWeight: "500" }} numberOfLines={1}>
                          {order.driverName === "Unassigned" ? "—" : order.driverName}
                        </Text>
                      </View>
                    </View>
                    <View style={[dtStyles.td, { minWidth: 80 }]}>
                      {order.paymentMethod === "cash_on_delivery" ? (
                        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>CASH</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: "#64748B" }}>Card</Text>
                      )}
                    </View>
                    <View style={[dtStyles.td, { minWidth: 90 }]}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#00E5FF" }}>€{parseFloat(order.total).toFixed(2)}</Text>
                    </View>
                    <View style={[dtStyles.td, { minWidth: 160, flexDirection: "row", gap: 6 }]}>
                      {isActive && (
                        <>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); setAssignModalOrderId(order.id); }}
                            style={dtStyles.actionBtn}
                          >
                            <Text style={dtStyles.actionBtnText}>🚗</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); setStatusModalOrderId(order.id); }}
                            style={[dtStyles.actionBtn, { backgroundColor: "#E0E7FF" }]}
                          >
                            <Text style={dtStyles.actionBtnText}>📋</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); handleUpdateStatus(order.id, "cancelled"); }}
                            style={[dtStyles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                          >
                            <Text style={dtStyles.actionBtnText}>✕</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Expanded row details */}
                  {expanded && (
                    <View style={dtStyles.expandedRow}>
                      <View style={{ flexDirection: "row", gap: 32, flexWrap: "wrap" }}>
                        {/* Store */}
                        <View style={{ minWidth: 140 }}>
                          <Text style={dtStyles.detailLabel}>Store</Text>
                          <Text style={[dtStyles.detailValue, { fontWeight: "700" }]}>{order.storeName}</Text>
                        </View>
                        {/* Order Items */}
                        <View style={{ minWidth: 260, flex: 1 }}>
                          <Text style={dtStyles.detailLabel}>Items Ordered</Text>
                          {(order as any).items && (order as any).items.length > 0 ? (
                            (order as any).items.map((item: any, idx: number) => (
                              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                                <Text style={[dtStyles.detailValue, { flex: 1 }]}>
                                  {item.quantity}x {item.productName}
                                </Text>
                                <Text style={[dtStyles.detailValue, { color: "#00E5FF", fontWeight: "600", marginLeft: 12 }]}>
                                  €{(parseFloat(item.productPrice) * item.quantity).toFixed(2)}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={[dtStyles.detailValue, { color: "#94A3B8" }]}>No items data</Text>
                          )}
                        </View>
                        {/* Delivery Address */}
                        <View style={{ minWidth: 200 }}>
                          <Text style={dtStyles.detailLabel}>Delivery Address</Text>
                          <Text style={dtStyles.detailValue}>{order.deliveryAddress}</Text>
                        </View>
                        <View style={{ minWidth: 150 }}>
                          <Text style={dtStyles.detailLabel}>Price Breakdown</Text>
                          <Text style={dtStyles.detailValue}>Subtotal: €{parseFloat(order.subtotal).toFixed(2)}</Text>
                          <Text style={dtStyles.detailValue}>Service: €{parseFloat(order.serviceFee).toFixed(2)}</Text>
                          <Text style={dtStyles.detailValue}>Delivery: €{parseFloat(order.deliveryFee).toFixed(2)}</Text>
                          {parseFloat(order.tipAmount || "0") > 0 && (
                            <Text style={[dtStyles.detailValue, { color: "#8B5CF6" }]}>Tip: €{parseFloat(order.tipAmount || "0").toFixed(2)}</Text>
                          )}
                        </View>
                        <View style={{ minWidth: 150 }}>
                          <Text style={dtStyles.detailLabel}>Details</Text>
                          <Text style={dtStyles.detailValue}>Payment: {order.paymentMethod === "card" ? "Card" : "Cash"} ({order.paymentStatus})</Text>
                          {order.deliveryDistance && <Text style={dtStyles.detailValue}>Distance: {parseFloat(order.deliveryDistance as string).toFixed(1)} km</Text>}
                          {order.deliveredAt && <Text style={dtStyles.detailValue}>Delivered: {formatDate(order.deliveredAt)}</Text>}
                          {order.cancelledAt && <Text style={[dtStyles.detailValue, { color: "#DC2626" }]}>Cancelled: {formatDate(order.cancelledAt)}</Text>}
                        </View>
                        {order.customerNotes && (
                          <View style={{ minWidth: 200 }}>
                            <Text style={dtStyles.detailLabel}>Customer Notes</Text>
                            <Text style={[dtStyles.detailValue, { fontStyle: "italic" }]}>{order.customerNotes}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            }) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ color: "#94A3B8", fontSize: 15 }}>
                  {statusFilter === "all" ? "No orders yet" : `No ${statusFilter.replace(/_/g, " ")} orders`}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Modals (same for desktop) */}
        {renderModals()}
      </View>
    );
  }

  // ─── MOBILE LAYOUT (unchanged) ───
  return (
    <ScreenContainer className="bg-background">
      {errorMessage ? (
        <TouchableOpacity
          onPress={() => setErrorMessage("")}
          style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EF4444" }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>
            Error: {errorMessage} (tap to dismiss)
          </Text>
        </TouchableOpacity>
      ) : null}

      {alertOrders.length > 0 && (
        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F59E0B" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#D97706" }}>
            {alertOrders.length} order{alertOrders.length > 1 ? "s" : ""} waiting 5+ minutes without a driver
          </Text>
        </View>
      )}

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
                backgroundColor: active ? colors.primary : "transparent",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                marginRight: 8,
                borderWidth: active ? 0 : 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : colors.muted }}>
                {label}
              </Text>
              {count > 0 && (
                <View style={{ backgroundColor: active ? "rgba(255,255,255,0.3)" : colors.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: active ? "#fff" : colors.muted }}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom, paddingHorizontal: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
                      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>€{parseFloat(order.total).toFixed(2)}</Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm text-muted" numberOfLines={1}>
                          {order.storeName} → {order.customerName}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: isWaiting ? "#D97706" : colors.muted, fontWeight: isWaiting ? "700" : "400" }}>
                        {waitTime}
                      </Text>
                    </View>

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
                            <Text className="text-sm text-foreground">{parseFloat(order.deliveryDistance as string).toFixed(1)} km</Text>
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

                        {isActive && (
                          <View className="mt-3 pt-3 border-t border-border gap-2">
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 4 }}>ACTIONS</Text>
                            <TouchableOpacity
                              onPress={() => setAssignModalOrderId(order.id)}
                              style={styles.actionButton}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#2563EB" }}>
                                {order.driverName === "Unassigned" ? "Assign Driver" : "Reassign Driver"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setStatusModalOrderId(order.id)}
                              style={[styles.actionButton, { backgroundColor: "#E0E7FF" }]}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#4F46E5" }}>Update Status</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleUpdateStatus(order.id, "cancelled")}
                              style={[styles.actionButton, { backgroundColor: "#FEE2E2" }]}
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

      {renderModals()}
    </ScreenContainer>
  );

  // ─── SHARED MODALS ───
  function renderModals() {
    return (
      <>
        {/* Cancel Confirmation */}
        {cancelConfirmOrderId !== null && (
          <View style={styles.overlay}>
            <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Cancel Order?</Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
                Are you sure you want to cancel this order? This action cannot be undone.
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setCancelConfirmOrderId(null)}
                  style={[styles.confirmButton, { backgroundColor: colors.border }]}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>No, Keep It</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmCancelOrder}
                  style={[styles.confirmButton, { backgroundColor: "#DC2626" }]}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", textAlign: "center" }}>Yes, Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Assign Driver Modal */}
        <Modal visible={assignModalOrderId !== null} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: isDesktop ? "center" : "flex-end", alignItems: isDesktop ? "center" : "stretch" }}>
            <View style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              ...(isDesktop ? { borderRadius: 16, width: 480, maxHeight: "70%" } : { maxHeight: "70%", paddingBottom: insets.bottom + 16 }),
            }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Assign Driver</Text>
                <TouchableOpacity onPress={() => setAssignModalOrderId(null)}>
                  <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "600" }}>Close</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableDrivers || []}
                keyExtractor={(item) => String(item.userId)}
                contentContainerStyle={{ padding: 12 }}
                renderItem={({ item }) => {
                  const statusColor = item.isOnline ? (item.isAvailable ? "#22C55E" : "#F59E0B") : colors.muted;
                  const statusLabel = item.isOnline ? (item.isAvailable ? "Available" : "Busy") : "Offline";
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        if (assignModalOrderId) handleAssignDriver(assignModalOrderId, item.userId);
                      }}
                      style={{ backgroundColor: colors.background, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
                          <View>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                              {item.displayNumber ? `Driver ${item.displayNumber}` : item.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: statusColor, fontWeight: "600" }}>{statusLabel}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 12, color: colors.muted }}>{item.totalDeliveries || 0} deliveries</Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>{item.vehicleType || "—"}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Text style={{ color: colors.muted }}>No drivers registered</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        {/* Update Status Modal */}
        <Modal visible={statusModalOrderId !== null} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: isDesktop ? "center" : "flex-end", alignItems: isDesktop ? "center" : "stretch" }}>
            <View style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              ...(isDesktop ? { borderRadius: 16, width: 400 } : { paddingBottom: insets.bottom + 16 }),
            }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Update Status</Text>
                <TouchableOpacity onPress={() => setStatusModalOrderId(null)}>
                  <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "600" }}>Close</Text>
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
                        backgroundColor: isCurrent ? sc.bg : colors.background,
                        padding: 14,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: isCurrent ? sc.text : colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sc.text }} />
                      <Text style={{ fontSize: 15, fontWeight: isCurrent ? "800" : "600", color: isCurrent ? sc.text : colors.foreground }}>
                        {label} {isCurrent ? "(Current)" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  }
}

// ─── Desktop Table Styles ───
const dtStyles = StyleSheet.create({
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  thText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  td: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  tdText: {
    fontSize: 13,
    color: "#0F172A",
  },
  expandedRow: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    color: "#0F172A",
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: "#DBEAFE",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: "85%",
    maxWidth: 360,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
});

export default function AdminOrdersScreen() {
  return (
    <AdminDesktopLayout title="All Orders">
      <AdminOrdersScreenContent />
    </AdminDesktopLayout>
  );
}
