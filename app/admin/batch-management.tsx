import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, useWindowDimensions, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

export default function BatchManagementScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  // Get all drivers with active orders
  const { data: driversData, isLoading: driversLoading, refetch: refetchDrivers } = trpc.admin.getDriverLocations.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Filter to drivers who have active orders
  const activeDrivers = (driversData || []).filter((d: any) => d.activeOrderCount > 0);

  const content = (
    <ScrollView style={{ flex: 1, padding: isDesktop ? 24 : 16 }}>
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.foreground, marginBottom: 4 }}>
          Batch Deliveries
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          Manage multi-order batches, reorder delivery sequence, and assign cross-store orders to drivers
        </Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flex: 1, minWidth: 140, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.primary }}>{activeDrivers.length}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Drivers with Active Orders</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flex: 1, minWidth: 140, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#F59E0B" }}>
            {activeDrivers.reduce((sum: number, d: any) => sum + (d.activeOrderCount || 0), 0)}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Total Active Orders</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flex: 1, minWidth: 140, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#22C55E" }}>
            {activeDrivers.filter((d: any) => d.activeOrderCount > 1).length}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Multi-Order Batches</Text>
        </View>
      </View>

      {driversLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : activeDrivers.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 32, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 4 }}>No Active Batches</Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
            When drivers pick up multiple orders, their batches will appear here for management.
          </Text>
        </View>
      ) : (
        activeDrivers.map((driver: any) => (
          <DriverBatchCard
            key={driver.driverId}
            driver={driver}
            onRefresh={refetchDrivers}
          />
        ))
      )}

      {/* Assign Order Section */}
      <AssignOrderSection drivers={activeDrivers} allDrivers={driversData || []} onRefresh={refetchDrivers} />

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {isDesktop ? (
        <AdminDesktopLayout title="Batch Deliveries">{content}</AdminDesktopLayout>
      ) : (
        content
      )}
    </ScreenContainer>
  );
}

// Driver Batch Card with reorder capability
function DriverBatchCard({ driver, onRefresh }: { driver: any; onRefresh: () => void }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  // Fetch batch details for this driver
  const { data: batchData, isLoading, refetch } = trpc.admin.getDriverBatch.useQuery(
    { driverId: driver.driverId },
    { enabled: expanded }
  );

  const reorderMutation = trpc.admin.reorderBatch.useMutation();

  const handleMoveUp = useCallback(async (orderId: number, currentSeq: number) => {
    if (!batchData?.batchId || !batchData?.orders) return;
    const batchOrders = [...batchData.orders].sort((a: any, b: any) => (a.batchSequence || 0) - (b.batchSequence || 0));
    const idx = batchOrders.findIndex((o: any) => o.id === orderId);
    if (idx <= 0) return;

    // Swap with previous
    const newSequence = batchOrders.map((o: any, i: number) => {
      if (i === idx - 1) return { orderId: o.id, sequence: i + 2 };
      if (i === idx) return { orderId: o.id, sequence: i };
      return { orderId: o.id, sequence: i + 1 };
    });

    try {
      await reorderMutation.mutateAsync({ batchId: batchData.batchId, orderSequence: newSequence });
      refetch();
    } catch (e) {
      console.error("Failed to reorder:", e);
    }
  }, [batchData]);

  const handleMoveDown = useCallback(async (orderId: number, currentSeq: number) => {
    if (!batchData?.batchId || !batchData?.orders) return;
    const batchOrders = [...batchData.orders].sort((a: any, b: any) => (a.batchSequence || 0) - (b.batchSequence || 0));
    const idx = batchOrders.findIndex((o: any) => o.id === orderId);
    if (idx >= batchOrders.length - 1) return;

    // Swap with next
    const newSequence = batchOrders.map((o: any, i: number) => {
      if (i === idx) return { orderId: o.id, sequence: i + 2 };
      if (i === idx + 1) return { orderId: o.id, sequence: i };
      return { orderId: o.id, sequence: i + 1 };
    });

    try {
      await reorderMutation.mutateAsync({ batchId: batchData.batchId, orderSequence: newSequence });
      refetch();
    } catch (e) {
      console.error("Failed to reorder:", e);
    }
  }, [batchData]);

  const statusColor = (status: string) => {
    switch (status) {
      case "picked_up":
      case "on_the_way":
        return "#22C55E";
      case "ready_for_pickup":
        return "#F59E0B";
      default:
        return colors.muted;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pending";
      case "accepted": return "Accepted";
      case "preparing": return "Preparing";
      case "ready_for_pickup": return "Ready";
      case "picked_up": return "Picked Up";
      case "on_the_way": return "On The Way";
      default: return status;
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: driver.activeOrderCount > 1 ? "#3B82F6" : colors.border, overflow: "hidden" }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: driver.isOnline ? "#22C55E" : colors.muted,
            justifyContent: "center", alignItems: "center", marginRight: 12,
          }}>
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
              {(driver.driverName || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground }}>
              {driver.driverName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {driver.activeOrderCount} order{driver.activeOrderCount !== 1 ? "s" : ""} active
              {driver.activeOrderCount > 1 && (
                <Text style={{ color: "#3B82F6", fontWeight: "600" }}> • Batch</Text>
              )}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {driver.activeOrderCount > 1 && (
            <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, color: "#1E40AF", fontWeight: "bold" }}>BATCH</Text>
            </View>
          )}
          <Text style={{ fontSize: 20, color: colors.muted }}>{expanded ? "▼" : "▶"}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded batch details */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 16 }}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : batchData?.orders && batchData.orders.length > 0 ? (
            <View>
              {batchData.batchId && (
                <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: "#1E40AF", fontWeight: "600" }}>
                    Batch ID: {batchData.batchId} • {batchData.batchSize} orders
                  </Text>
                </View>
              )}

              <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.foreground, marginBottom: 8 }}>
                Delivery Sequence {batchData.orders.length > 1 ? "(drag arrows to reorder)" : ""}
              </Text>

              {[...batchData.orders].sort((a: any, b: any) => (a.batchSequence || 0) - (b.batchSequence || 0)).map((order: any, idx: number) => (
                <View
                  key={order.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  {/* Sequence number */}
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: statusColor(order.status),
                    justifyContent: "center", alignItems: "center", marginRight: 10,
                  }}>
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>{idx + 1}</Text>
                  </View>

                  {/* Order info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.foreground }}>
                        {order.orderNumber || `#${order.id}`}
                      </Text>
                      <View style={{ backgroundColor: statusColor(order.status) + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: statusColor(order.status), fontWeight: "600" }}>
                          {statusLabel(order.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {order.storeName} → {order.deliveryAddress || "No address"}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {order.customerName || "Guest"} • {order.paymentMethod === "cash_on_delivery" ? "Cash" : "Card"} • €{parseFloat(order.total || "0").toFixed(2)}
                    </Text>
                  </View>

                  {/* Reorder arrows */}
                  {batchData.orders.length > 1 && (
                    <View style={{ gap: 4, marginLeft: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleMoveUp(order.id, order.batchSequence || idx + 1)}
                        disabled={idx === 0 || reorderMutation.isPending}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          backgroundColor: idx === 0 ? colors.surface : "#DBEAFE",
                          justifyContent: "center", alignItems: "center",
                          opacity: idx === 0 ? 0.3 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: idx === 0 ? colors.muted : "#1E40AF" }}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveDown(order.id, order.batchSequence || idx + 1)}
                        disabled={idx === batchData.orders.length - 1 || reorderMutation.isPending}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          backgroundColor: idx === batchData.orders.length - 1 ? colors.surface : "#DBEAFE",
                          justifyContent: "center", alignItems: "center",
                          opacity: idx === batchData.orders.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: idx === batchData.orders.length - 1 ? colors.muted : "#1E40AF" }}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {reorderMutation.isPending && (
                <Text style={{ fontSize: 12, color: colors.primary, textAlign: "center", marginTop: 4 }}>Saving new order...</Text>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.muted, textAlign: "center" }}>No active orders</Text>
          )}
        </View>
      )}
    </View>
  );
}

// Admin assign order to driver section
function AssignOrderSection({ drivers, allDrivers, onRefresh }: { drivers: any[]; allDrivers: any[]; onRefresh: () => void }) {
  const colors = useColors();
  const [orderIdInput, setOrderIdInput] = useState("");
  const [driverIdInput, setDriverIdInput] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  const assignMutation = trpc.admin.assignOrderToDriver.useMutation();

  const handleAssign = async () => {
    setAssignError("");
    setAssignSuccess("");
    const orderId = parseInt(orderIdInput);
    const driverId = parseInt(driverIdInput);
    if (!orderId || !driverId) {
      setAssignError("Please enter valid Order ID and Driver ID");
      return;
    }
    try {
      const result = await assignMutation.mutateAsync({ orderId, driverId });
      setAssignSuccess(`Order #${orderId} assigned to driver (Batch: ${result.batchId}, Position: ${result.batchSequence})`);
      setOrderIdInput("");
      setDriverIdInput("");
      onRefresh();
    } catch (e: any) {
      setAssignError(e.message || "Failed to assign order");
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginTop: 24, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 4 }}>
        📦 Assign Order to Driver
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
        Manually assign an order to a specific driver (for cross-store batching). The driver will receive a push notification.
      </Text>

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>Order ID</Text>
          <TextInput
            value={orderIdInput}
            onChangeText={setOrderIdInput}
            placeholder="e.g. 42"
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              fontSize: 14,
              color: colors.foreground,
            }}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>Driver ID</Text>
          <TextInput
            value={driverIdInput}
            onChangeText={setDriverIdInput}
            placeholder="e.g. 5"
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 10,
              fontSize: 14,
              color: colors.foreground,
            }}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={handleAssign}
        disabled={assignMutation.isPending}
        style={{
          backgroundColor: colors.primary,
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
          opacity: assignMutation.isPending ? 0.5 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
          {assignMutation.isPending ? "Assigning..." : "Assign Order to Driver"}
        </Text>
      </TouchableOpacity>

      {assignError ? (
        <View style={{ backgroundColor: "#FEE2E2", padding: 10, borderRadius: 8, marginTop: 8 }}>
          <Text style={{ color: "#DC2626", fontSize: 13 }}>{assignError}</Text>
        </View>
      ) : null}

      {assignSuccess ? (
        <View style={{ backgroundColor: "#DCFCE7", padding: 10, borderRadius: 8, marginTop: 8 }}>
          <Text style={{ color: "#16A34A", fontSize: 13 }}>{assignSuccess}</Text>
        </View>
      ) : null}

      {/* Quick reference: active drivers */}
      {allDrivers.filter((d: any) => d.isOnline).length > 0 && (
        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>
            Online Drivers (for reference):
          </Text>
          {allDrivers.filter((d: any) => d.isOnline).map((d: any) => (
            <View key={d.driverId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, color: colors.foreground }}>
                {d.driverName} (ID: {d.driverId})
              </Text>
              <Text style={{ fontSize: 12, color: d.activeOrderCount > 0 ? "#F59E0B" : "#22C55E" }}>
                {d.activeOrderCount > 0 ? `${d.activeOrderCount} orders` : "Available"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
