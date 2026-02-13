import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

export default function AdminDriverManagement() {
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: drivers, isLoading, refetch } = trpc.admin.getAllDrivers.useQuery(undefined, {
    refetchInterval: 15000,
  });

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

  // Sort: online first, then by deliveries
  const sortedDrivers = [...(drivers || [])].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return (b.totalDeliveries || 0) - (a.totalDeliveries || 0);
  });

  const onlineCount = sortedDrivers.filter(d => d.isOnline).length;
  const availableCount = sortedDrivers.filter(d => d.isOnline && d.isAvailable).length;

  return (
    <ScreenContainer className="bg-background">
      {/* Summary Bar */}
      <View className="flex-row px-4 py-3 border-b border-border gap-4">
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
          <Text className="text-sm text-foreground font-medium">{onlineCount} Online</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#00E5FF" }} />
          <Text className="text-sm text-foreground font-medium">{availableCount} Available</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#9BA1A6" }} />
          <Text className="text-sm text-foreground font-medium">{sortedDrivers.length} Total</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        {sortedDrivers.length > 0 ? (
          <View className="gap-3">
            {sortedDrivers.map(driver => {
              const expanded = expandedId === driver.id;
              const statusColor = driver.isOnline
                ? (driver.isAvailable ? "#22C55E" : "#F59E0B")
                : "#9BA1A6";
              const statusText = driver.isOnline
                ? (driver.isAvailable ? "Online - Available" : "Online - Busy")
                : "Offline";

              return (
                <TouchableOpacity
                  key={driver.id}
                  onPress={() => setExpandedId(expanded ? null : driver.id)}
                  className="bg-surface rounded-xl border border-border overflow-hidden active:opacity-80"
                >
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-3">
                        {/* Status Indicator */}
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: statusColor }} />
                        <View>
                          <Text className="text-base font-bold text-foreground">{driver.name}</Text>
                          <Text style={{ fontSize: 12, color: statusColor, fontWeight: "600" }}>{statusText}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm text-muted">{driver.totalDeliveries || 0} deliveries</Text>
                        {driver.earningsToday > 0 && (
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#22C55E" }}>
                            €{driver.earningsToday.toFixed(2)} today
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {expanded && (
                    <View className="px-4 pb-4 border-t border-border pt-3">
                      <View className="gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Email</Text>
                          <Text className="text-sm text-foreground">{driver.email || "—"}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Phone</Text>
                          <Text className="text-sm text-foreground">{driver.phone || "—"}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Vehicle</Text>
                          <Text className="text-sm text-foreground">
                            {driver.vehicleType || "—"} {driver.vehicleNumber ? `(${driver.vehicleNumber})` : ""}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Rating</Text>
                          <Text className="text-sm text-foreground">
                            ⭐ {driver.rating ? parseFloat(driver.rating).toFixed(1) : "5.0"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Total Deliveries</Text>
                          <Text className="text-sm text-foreground font-medium">{driver.totalDeliveries || 0}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Returns</Text>
                          <Text className="text-sm text-foreground">{driver.totalReturns || 0}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Joined</Text>
                          <Text className="text-sm text-foreground">
                            {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-muted text-center text-base">No drivers registered yet</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
