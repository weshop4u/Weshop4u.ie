import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

function StatCard({ label, value, subValue, color }: { label: string; value: string | number; subValue?: string; color?: string }) {
  return (
    <View className="bg-surface rounded-xl p-4 border border-border flex-1 min-w-[140px]">
      <Text className="text-xs text-muted mb-1">{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color: color || "#00E5FF" }}>{value}</Text>
      {subValue && <Text className="text-xs text-muted mt-1">{subValue}</Text>}
    </View>
  );
}

function StatusBadge({ status, count }: { status: string; count: number }) {
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

  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center gap-2">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.text }} />
        <Text style={{ fontSize: 14, color: "#687076" }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{count}</Text>
    </View>
  );
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
            <View style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Orders" value={stats?.orders.today.count ?? 0} color="#00E5FF" />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Revenue" value={`€${(stats?.orders.today.revenue ?? 0).toFixed(2)}`} subValue={`Fees: €${(stats?.orders.today.serviceFees ?? 0).toFixed(2)}`} color="#22C55E" />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Delivery Fees" value={`€${(stats?.orders.today.deliveryFees ?? 0).toFixed(2)}`} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Tips" value={`€${(stats?.orders.today.tips ?? 0).toFixed(2)}`} color="#8B5CF6" />
            </View>
          </View>
        </View>

        {/* Two-column layout: Revenue + Live Status */}
        <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
          {/* Revenue Summary */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Revenue Summary</Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-muted">This Week</Text>
                <View className="items-end">
                  <Text className="text-foreground font-bold">€{(stats?.orders.thisWeek.revenue ?? 0).toFixed(2)}</Text>
                  <Text className="text-xs text-muted">{stats?.orders.thisWeek.count ?? 0} orders</Text>
                </View>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-muted">This Month</Text>
                <View className="items-end">
                  <Text className="text-foreground font-bold">€{(stats?.orders.thisMonth.revenue ?? 0).toFixed(2)}</Text>
                  <Text className="text-xs text-muted">{stats?.orders.thisMonth.count ?? 0} orders</Text>
                </View>
              </View>
              <View className="flex-row justify-between py-2">
                <Text className="text-muted">All Time</Text>
                <View className="items-end">
                  <Text className="text-foreground font-bold">€{(stats?.orders.allTime.revenue ?? 0).toFixed(2)}</Text>
                  <Text className="text-xs text-muted">{stats?.orders.allTime.count ?? 0} orders</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Live Status */}
          <View style={{ flex: 1, minWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 }}>Live Status</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
                  <StatCard label="Active Orders" value={stats?.orders.active ?? 0} color="#F59E0B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} style={{ flex: 1 }}>
                  <StatCard label="Drivers Online" value={stats?.drivers.online ?? 0} subValue={`${stats?.drivers.available ?? 0} available`} color="#22C55E" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => router.push("/admin/driver-management" as any)} style={{ flex: 1 }}>
                  <StatCard label="Total Drivers" value={stats?.drivers.total ?? 0} color="#00E5FF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/admin/manage-stores" as any)} style={{ flex: 1 }}>
                  <StatCard label="Active Stores" value={`${stats?.stores.active ?? 0}/${stats?.stores.total ?? 0}`} color="#00E5FF" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => router.push("/admin/customers" as any)} style={{ opacity: 1 }}>
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
                <StatusBadge key={status} status={status} count={count} />
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
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout (unchanged)
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
            <StatCard label="Orders" value={stats?.orders.today.count ?? 0} color="#00E5FF" />
            <StatCard label="Revenue" value={`€${(stats?.orders.today.revenue ?? 0).toFixed(2)}`} subValue={`Fees: €${(stats?.orders.today.serviceFees ?? 0).toFixed(2)}`} color="#22C55E" />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Delivery Fees" value={`€${(stats?.orders.today.deliveryFees ?? 0).toFixed(2)}`} color="#F59E0B" />
            <StatCard label="Tips" value={`€${(stats?.orders.today.tips ?? 0).toFixed(2)}`} color="#8B5CF6" />
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Revenue Summary</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">This Week</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.thisWeek.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.thisWeek.count ?? 0} orders</Text>
              </View>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">This Month</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.thisMonth.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.thisMonth.count ?? 0} orders</Text>
              </View>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-muted">All Time</Text>
              <View className="items-end">
                <Text className="text-foreground font-bold">€{(stats?.orders.allTime.revenue ?? 0).toFixed(2)}</Text>
                <Text className="text-xs text-muted">{stats?.orders.allTime.count ?? 0} orders</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-lg font-bold text-foreground mb-3">Live Status</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity onPress={() => router.push("/admin/orders" as any)} style={{ flex: 1 }}>
              <StatCard label="Active Orders" value={stats?.orders.active ?? 0} color="#F59E0B" />
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
              <StatusBadge key={status} status={status} count={count} />
            ))}
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
