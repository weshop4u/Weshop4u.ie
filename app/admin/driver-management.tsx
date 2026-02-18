import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, TextInput, Alert, Modal } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminDriverManagement() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingDisplayNumber, setEditingDisplayNumber] = useState<{ userId: number; value: string } | null>(null);

  const { data: drivers, isLoading, refetch } = trpc.admin.getAllDrivers.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const setDisplayNumberMutation = trpc.admin.setDriverDisplayNumber.useMutation({
    onSuccess: () => {
      refetch();
      setEditingDisplayNumber(null);
      Alert.alert("Success", "Display number updated");
    },
    onError: (err) => { Alert.alert("Error", err.message); },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSaveDisplayNumber = () => {
    if (!editingDisplayNumber) return;
    setDisplayNumberMutation.mutate({
      driverUserId: editingDisplayNumber.userId,
      displayNumber: editingDisplayNumber.value.trim(),
    });
  };

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
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom, paddingHorizontal: 12, paddingTop: 8 }}
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
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text className="text-base font-bold text-foreground">{driver.name}</Text>
                            {(driver as any).displayNumber && (
                              <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>
                                  #{(driver as any).displayNumber}
                                </Text>
                              </View>
                            )}
                          </View>
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
                            {driver.rating ? parseFloat(driver.rating).toFixed(1) : "5.0"}/5.0
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

                        {/* Display Number Assignment */}
                        <View className="mt-3 pt-3 border-t border-border">
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 8 }}>DISPLAY NUMBER</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ flex: 1, backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10 }}>
                              <TextInput
                                value={editingDisplayNumber?.userId === driver.userId ? editingDisplayNumber.value : ((driver as any).displayNumber || "")}
                                onChangeText={(text) => setEditingDisplayNumber({ userId: driver.userId, value: text })}
                                onFocus={() => {
                                  if (!editingDisplayNumber || editingDisplayNumber.userId !== driver.userId) {
                                    setEditingDisplayNumber({ userId: driver.userId, value: (driver as any).displayNumber || "" });
                                  }
                                }}
                                placeholder="e.g. 01, 02"
                                placeholderTextColor="#687076"
                                style={{ fontSize: 15, color: "#ECEDEE" }}
                                returnKeyType="done"
                                onSubmitEditing={handleSaveDisplayNumber}
                              />
                            </View>
                            {editingDisplayNumber?.userId === driver.userId && (
                              <TouchableOpacity
                                onPress={handleSaveDisplayNumber}
                                style={{ backgroundColor: "#00E5FF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
                              >
                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#151718" }}>Save</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={{ fontSize: 11, color: "#687076", marginTop: 4 }}>
                            Customers will see "Driver {editingDisplayNumber?.userId === driver.userId ? editingDisplayNumber.value || "??" : ((driver as any).displayNumber || "??")}"
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
