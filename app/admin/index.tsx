import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useMemo } from "react";

function StatCard({ label, value, subValue, color }: { label: string; value: string | number; subValue?: string; color?: string }) {
  return (
    <View className="bg-surface rounded-xl p-4 border border-border flex-1 min-w-[140px]">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color: color || "#00E5FF" }}>{value}</Text>
      {subValue && <Text className="text-xs text-muted mt-1">{subValue}</Text>}
    </View>
  );
}

const webCursor = Platform.OS === "web" ? { cursor: "pointer" as any } : {};

function PopularProductsSection() {
  const { data: popularProducts, isLoading } = trpc.analytics.getPopularProducts.useQuery({ limit: 10, days: 30 });

  if (isLoading) {
    return (
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Popular Products</Text>
        <View className="bg-surface rounded-xl p-4 border border-border items-center justify-center" style={{ height: 200 }}>
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
      </View>
    );
  }

  if (!popularProducts || popularProducts.length === 0) {
    return (
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Popular Products</Text>
        <View className="bg-surface rounded-xl p-4 border border-border items-center justify-center" style={{ height: 100 }}>
          <Text style={{ color: "#94A3B8", fontSize: 14 }}>No sales data yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A" }}>Popular Products (Last 30 Days)</Text>
      </View>
      <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
        {/* Table Header */}
        <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
          <Text style={{ flex: 1.5, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Product</Text>
          <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Qty Sold</Text>
          <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Orders</Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Revenue</Text>
        </View>
        {/* Rows */}
        {popularProducts.slice(0, 10).map((product: any, idx: number) => (
          <View key={product.productId} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 9 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
            <Text style={{ flex: 1.5, fontSize: 13, color: "#0F172A", fontWeight: "600" }} numberOfLines={1}>{product.productName}</Text>
            <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{product.totalQuantity}</Text>
            <Text style={{ flex: 0.8, fontSize: 13, color: "#334155", textAlign: "center" }}>{product.orderCount}</Text>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#22C55E", textAlign: "right" }}>€{product.totalRevenue.toFixed(2)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusBadge({ status, count, onPress }: { status: string; count: number; onPress?: () => void }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#FEF3C7", text: "#D97706" },
    accepted: { bg: "#DBEAFE", text: "#2563EB" },
    preparing: { bg: "#E0E7FF", text: "#4F46E5" },
    ready_for_pickup: { bg: "#D1FAE5", text: "#059669" },
    picked_up: { bg: "#CFFAFE", text: "#0891B2" },
    on_the_way: { bg: "#CCFBF1", text: "#0D9488" },
    delivered: { bg: "#DCFCE7", text: "#16A34A" },
    cancelled: { bg: "#FEE2E2", text: "#DC2626" },
  };
  const c = colors[status] || { bg: "#F3F4F6", text: "#6B7280" };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const content = (
    <View className="flex-row items-center justify-between py-2" style={onPress ? { borderRadius: 6, paddingHorizontal: 8, marginHorizontal: -8 } : undefined}>
      <View className="flex-row items-center gap-2">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.text }} />
        <Text style={{ fontSize: 14, color: "#687076" }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{count}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={webCursor}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function DashboardContent() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const { data: stats, isLoading, refetch } = trpc.admin.getDashboardStats.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Unread messages count for badge
  const { data: unreadData } = trpc.messages.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // Pending driver applications count
  const { data: pendingDriverData } = trpc.admin.getPendingDriverCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const pendingDriverCount = pendingDriverData?.count ?? 0;

  // Recent orders for preview
  const { data: recentOrders } = trpc.admin.getAllOrders.useQuery(
    { limit: 5, offset: 0 },
    { refetchInterval: 30000 }
  );

  // Pending orders count for notification badge
  const pendingOrderCount = useMemo(() => {
    if (!stats?.orders.statusBreakdown) return 0;
    return (stats.orders.statusBreakdown as any).pending ?? 0;
  }, [stats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading dashboard...</Text>
      </View>
    );
  }

  // Desktop web: no ScreenContainer or ScrollView (AdminDesktopLayout handles it)
  if (isDesktopWeb) {
    return (
      <View style={{ gap: 24 }}>
        {/* Today's Overview - 4 cards in a row on desktop */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Today's Overview</Text>
          <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.7} style={{ flex: 1, minWidth: 200, ...webCursor }}>
              <StatCard label="Orders" value={stats?.orders.today.count ?? 0} color="#00E5FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.7} style={{ flex: 1, minWidth: 200, ...webCursor }}>
              <StatCard label="Revenue" value={`€${(stats?.orders.today.revenue ?? 0).toFixed(2)}`} subValue={`Fees: €${(stats?.orders.today.serviceFees ?? 0).toFixed(2)}`} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.7} style={{ flex: 1, minWidth: 200, ...webCursor }}>
              <StatCard label="Delivery Fees" value={`€${(stats?.orders.today.deliveryFees ?? 0).toFixed(2)}`} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.7} style={{ flex: 1, minWidth: 200, ...webCursor }}>
              <StatCard label="Tips" value={`€${(stats?.orders.today.tips ?? 0).toFixed(2)}`} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Two-column layout: Revenue + Live Status */}
        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          {/* Revenue Summary */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Revenue Summary</Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ ...webCursor, flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <Text style={{ color: "#687076" }}>This Week</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#0F172A", fontWeight: "700" }}>€{(stats?.orders.thisWeek.revenue ?? 0).toFixed(2)}</Text>
                  <Text style={{ fontSize: 12, color: "#687076" }}>{stats?.orders.thisWeek.count ?? 0} orders</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ ...webCursor, flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <Text style={{ color: "#687076" }}>This Month</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#0F172A", fontWeight: "700" }}>€{(stats?.orders.thisMonth.revenue ?? 0).toFixed(2)}</Text>
                  <Text style={{ fontSize: 12, color: "#687076" }}>{stats?.orders.thisMonth.count ?? 0} orders</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ ...webCursor, flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
                <Text style={{ color: "#687076" }}>All Time</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#0F172A", fontWeight: "700" }}>€{(stats?.orders.allTime.revenue ?? 0).toFixed(2)}</Text>
                  <Text style={{ fontSize: 12, color: "#687076" }}>{stats?.orders.allTime.count ?? 0} orders</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Status */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Live Status</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.7} style={{ flex: 1, ...webCursor, position: "relative" }}>
                  <StatCard label="Active Orders" value={stats?.orders.active ?? 0} color="#F59E0B" />
                  {pendingOrderCount > 0 && (
                    <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderWidth: 2, borderColor: "#fff" }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{pendingOrderCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} activeOpacity={0.7} style={{ flex: 1, ...webCursor }}>
                  <StatCard label="Drivers Online" value={stats?.drivers.online ?? 0} subValue={`${stats?.drivers.available ?? 0} available`} color="#22C55E" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} activeOpacity={0.7} style={{ flex: 1, ...webCursor }}>
                  <StatCard label="Total Drivers" value={stats?.drivers.total ?? 0} color="#00E5FF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/admin/manage-stores" as any)} activeOpacity={0.7} style={{ flex: 1, ...webCursor }}>
                  <StatCard label="Active Stores" value={`${stats?.stores.active ?? 0}/${stats?.stores.total ?? 0}`} color="#00E5FF" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => router.push("/admin/customers" as any)} activeOpacity={0.7} style={{ ...webCursor }}>
                    <StatCard label="Total Customers" value={stats?.customers.total ?? 0} subValue={stats?.customers.today ? `+${stats.customers.today} today` : undefined} color="#EC4899" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </View>

        {/* Two-column: Order Breakdown + Quick Actions */}
        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          {/* Order Breakdown */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Order Breakdown</Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              {stats?.orders.statusBreakdown && Object.entries(stats.orders.statusBreakdown).map(([status, count]) => (
                <StatusBadge key={status} status={status} count={count} onPress={() => router.push("/admin/orders" as any)} />
              ))}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Quick Actions</Text>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push("/admin/phone-order" as any)}
                style={{ backgroundColor: "#22C55E", padding: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>📞</Text>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Create Phone Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/orders" as any)}
                style={{ backgroundColor: "#00E5FF", padding: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>📋</Text>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>View All Orders</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/manage-stores" as any)}
                style={{ backgroundColor: "#0a7ea4", padding: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>🏪</Text>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Manage Stores</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/products" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>📦</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Manage Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/product-prices" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>💰</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Product Prices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/driver-management" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>🚗</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Driver Management</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/driver-applications" as any)}
                style={{ backgroundColor: pendingDriverCount > 0 ? "#FEF3C7" : "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: pendingDriverCount > 0 ? "#F59E0B" : "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>📝</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Driver Applications</Text>
                {pendingDriverCount > 0 && (
                  <View style={{ backgroundColor: "#F59E0B", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{pendingDriverCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/discount-codes" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>🏷️</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Discount Codes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/customers" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>👥</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Customers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/messages" as any)}
                style={{ backgroundColor: "#F8FAFC", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>💬</Text>
                <Text style={{ color: "#0F172A", fontWeight: "600", fontSize: 15 }}>Messages</Text>
                {unreadCount > 0 && (
                  <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/admin/settings" as any)}
                style={{ backgroundColor: "#A78BFA", padding: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>🧪</Text>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Testing Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Popular Products */}
        <PopularProductsSection />

        {/* Recent Orders Preview */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A" }}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={webCursor}>
              <Text style={{ fontSize: 14, color: "#0a7ea4", fontWeight: "600" }}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
            {/* Table Header */}
            <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text style={{ flex: 1.2, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Order</Text>
              <Text style={{ flex: 1.5, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Customer</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</Text>
              <Text style={{ flex: 0.8, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Payment</Text>
              <Text style={{ flex: 0.6, fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Total</Text>
            </View>
            {/* Rows */}
            {recentOrders && recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order: any, idx: number) => {
              const statusColors: Record<string, { bg: string; text: string }> = {
                pending: { bg: "#FEF3C7", text: "#D97706" },
                accepted: { bg: "#DBEAFE", text: "#2563EB" },
                preparing: { bg: "#E0E7FF", text: "#4F46E5" },
                ready_for_pickup: { bg: "#D1FAE5", text: "#059669" },
                picked_up: { bg: "#CFFAFE", text: "#0891B2" },
                on_the_way: { bg: "#CCFBF1", text: "#0D9488" },
                delivered: { bg: "#DCFCE7", text: "#16A34A" },
                cancelled: { bg: "#FEE2E2", text: "#DC2626" },
              };
              const sc = statusColors[order.status] || { bg: "#F3F4F6", text: "#6B7280" };
              const statusLabel = order.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
              const paymentLabel = order.paymentMethod === "cash_on_delivery" || order.paymentMethod === "cash" ? "Cash" : "Card";
              const isCashDelivered = (order.paymentMethod === "cash_on_delivery" || order.paymentMethod === "cash") && order.status === "delivered";
              const paymentStatusLabel = order.paymentStatus === "completed" ? "Paid" : isCashDelivered ? "Collected" : order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "pending" ? "Pending" : order.paymentStatus;
              const paymentColor = order.paymentStatus === "completed" ? "#16A34A" : isCashDelivered ? "#16A34A" : order.paymentStatus === "paid" ? "#16A34A" : "#D97706";
              const timeAgo = order.createdAt ? (() => {
                const diff = Date.now() - new Date(order.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })() : "";
              return (
                <TouchableOpacity key={order.id} onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ ...webCursor, flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 4 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{order.orderNumber}</Text>
                    <Text style={{ fontSize: 11, color: "#94A3B8" }}>{timeAgo}</Text>
                  </View>
                  <Text style={{ flex: 1.5, fontSize: 13, color: "#334155" }} numberOfLines={1}>{order.customerName}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: sc.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 0.8 }}>
                    <Text style={{ fontSize: 12, color: "#334155" }}>{paymentLabel}</Text>
                    <Text style={{ fontSize: 11, color: paymentColor, fontWeight: "600" }}>{paymentStatusLabel}</Text>
                  </View>
                  <Text style={{ flex: 0.6, fontSize: 13, fontWeight: "700", color: "#0F172A", textAlign: "right" }}>€{Number(order.total).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            }) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>No recent orders</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout
  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-bold text-foreground">Dashboard</Text>
          <Text className="text-sm text-muted">WESHOP4U Operations</Text>
        </View>

        <View className="px-4 pt-4">
          <Text className="text-lg font-bold text-foreground mb-3">Today</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
              <StatCard label="Orders" value={stats?.orders.today.count ?? 0} color="#00E5FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
              <StatCard label="Revenue" value={`€${(stats?.orders.today.revenue ?? 0).toFixed(2)}`} subValue={`Fees: €${(stats?.orders.today.serviceFees ?? 0).toFixed(2)}`} color="#22C55E" />
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
              <StatCard label="Delivery Fees" value={`€${(stats?.orders.today.deliveryFees ?? 0).toFixed(2)}`} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
              <StatCard label="Tips" value={`€${(stats?.orders.today.tips ?? 0).toFixed(2)}`} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Revenue Summary</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text className="text-muted">This Week</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.thisWeek.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.thisWeek.count ?? 0} orders</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text className="text-muted">This Month</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.thisMonth.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.thisMonth.count ?? 0} orders</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text className="text-muted">All Time</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.allTime.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.allTime.count ?? 0} orders</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Live Status</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1, position: "relative" }}>
              <StatCard label="Active Orders" value={stats?.orders.active ?? 0} color="#F59E0B" />
              {pendingOrderCount > 0 && (
                <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 12, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 2, borderColor: "#fff" }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{pendingOrderCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} style={{ flex: 1 }}>
              <StatCard label="Drivers Online" value={stats?.drivers.online ?? 0} subValue={`${stats?.drivers.available ?? 0} available`} color="#22C55E" />
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} style={{ flex: 1 }}>
              <StatCard label="Total Drivers" value={stats?.drivers.total ?? 0} color="#00E5FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/admin/manage-stores" as any)} style={{ flex: 1 }}>
              <StatCard label="Active Stores" value={`${stats?.stores.active ?? 0}/${stats?.stores.total ?? 0}`} color="#00E5FF" />
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity onPress={() => router.push("/admin/customers" as any)} style={{ flex: 1 }}>
              <StatCard label="Total Customers" value={stats?.customers.total ?? 0} subValue={stats?.customers.today ? `+${stats.customers.today} today` : undefined} color="#EC4899" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Order Breakdown</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {stats?.orders.statusBreakdown && Object.entries(stats.orders.statusBreakdown).map(([status, count]) => (
              <StatusBadge key={status} status={status} count={count} onPress={() => router.push("/admin/orders" as any)} />
            ))}
          </View>
        </View>

        {/* Recent Orders Preview - Mobile */}
        <View className="px-4 pt-6">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text className="text-lg font-bold text-foreground">Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)}>
              <Text style={{ fontSize: 14, color: "#0a7ea4", fontWeight: "600" }}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl border border-border" style={{ overflow: "hidden" }}>
            {recentOrders && recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order: any, idx: number) => {
              const statusColors: Record<string, { bg: string; text: string }> = {
                pending: { bg: "#FEF3C7", text: "#D97706" },
                accepted: { bg: "#DBEAFE", text: "#2563EB" },
                preparing: { bg: "#E0E7FF", text: "#4F46E5" },
                ready_for_pickup: { bg: "#D1FAE5", text: "#059669" },
                picked_up: { bg: "#CFFAFE", text: "#0891B2" },
                on_the_way: { bg: "#CCFBF1", text: "#0D9488" },
                delivered: { bg: "#DCFCE7", text: "#16A34A" },
                cancelled: { bg: "#FEE2E2", text: "#DC2626" },
              };
              const sc = statusColors[order.status] || { bg: "#F3F4F6", text: "#6B7280" };
              const statusLabel = order.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
              const timeAgo = order.createdAt ? (() => {
                const diff = Date.now() - new Date(order.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })() : "";
              return (
                <TouchableOpacity key={order.id} onPress={() => router.push("/admin/orders" as any)} activeOpacity={0.6} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, backgroundColor: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottomWidth: idx < 4 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{order.orderNumber}</Text>
                    <Text style={{ fontSize: 11, color: "#94A3B8" }}>{order.customerName} · {timeAgo}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={{ backgroundColor: sc.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: sc.text }}>{statusLabel}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>€{Number(order.total).toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>No recent orders</Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Management</Text>
          <TouchableOpacity onPress={() => router.push("/admin/phone-order" as any)} style={{ backgroundColor: "#22C55E", padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 16 }}>📞 Create Phone Order</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} className="bg-primary p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-background font-bold text-center text-base">📋 View All Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">🚗 Driver Management</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/create-driver" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">➕ Create New Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/manage-stores" as any)} style={{ backgroundColor: "#0a7ea4", padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 16 }}>🏪 Manage Stores</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/products" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">✏️ Manage Products</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/import-products" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">📦 Import Products (CSV)</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/categories" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">🖼️ Manage Category Images</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/store-logos" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70 mb-3">
            <Text className="text-foreground font-semibold text-center text-base">🏪 Upload Store Logos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/admin/messages" as any)} className="bg-surface border border-border p-4 rounded-xl active:opacity-70">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Text className="text-foreground font-semibold text-center text-base">💬 Messages</Text>
              {unreadCount > 0 && (
                <View style={{ backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function AdminPanel() {
  return (
    <AdminDesktopLayout title="Dashboard">
      <DashboardContent />
    </AdminDesktopLayout>
  );
}
