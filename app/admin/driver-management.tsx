import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, TextInput, Platform, Pressable } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { formatIrishDate } from "@/lib/timezone";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

function AdminDriverManagementContent() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingDisplayNumber, setEditingDisplayNumber] = useState<{ userId: number; value: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: drivers, isLoading, refetch } = trpc.admin.getAllDrivers.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const deleteDriverMutation = trpc.admin.deleteDriver.useMutation({
    onSuccess: (result) => {
      refetch();
      setDeleteConfirm(null);
      setExpandedId(null);
      setSuccessMsg(result.message);
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err) => {
      setDeleteConfirm(null);
      setErrorMsg(err.message);
      setSuccessMsg("");
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });

  const setDisplayNumberMutation = trpc.admin.setDriverDisplayNumber.useMutation({
    onSuccess: () => {
      refetch();
      setEditingDisplayNumber(null);
      setSuccessMsg("Display number updated");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setSuccessMsg("");
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });
  const forceOfflineMutation = trpc.admin.forceDriverOffline.useMutation({
    onSuccess: () => {
      refetch();
      setSuccessMsg("Driver forced offline");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(""), 5000);
    },
  });
const sendWakeUpMutation = trpc.admin.sendDriverWakeUp.useMutation({
    onSuccess: () => {
      setSuccessMsg("Wake-up push sent to driver's phone");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setSuccessMsg("");
      setTimeout(() => setErrorMsg(""), 8000);
    },
  });
  const markAllSettledMutation = trpc.admin.markAllSettled.useMutation({
    onSuccess: () => {
      refetch();
      setSuccessMsg("Cash settled successfully");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(""), 5000);
    },
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

  // Sort: online (or on job) first, then by deliveries
  const sortedDrivers = [...(drivers || [])].sort((a, b) => {
    const aOnline = a.isOnline || (a as any).hasActiveJob;
    const bOnline = b.isOnline || (b as any).hasActiveJob;
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (b.totalDeliveries || 0) - (a.totalDeliveries || 0);
  });

  const onlineCount = sortedDrivers.filter(d => d.isOnline || (d as any).hasActiveJob).length;
  const availableCount = sortedDrivers.filter(d => d.isOnline && d.isAvailable).length;

  const formatLastOnline = (dateValue: string | Date | null | undefined): string => {
    if (!dateValue) return "Never";
    const date = new Date(dateValue);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  };

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

      {/* Success/Error Messages */}
      {successMsg ? (
        <View style={{ backgroundColor: "#22C55E20", padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 8 }}>
          <Text style={{ color: "#22C55E", fontWeight: "600", textAlign: "center" }}>{successMsg}</Text>
        </View>
      ) : null}
      {errorMsg ? (
        <View style={{ backgroundColor: "#EF444420", padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 8 }}>
          <Text style={{ color: "#EF4444", fontWeight: "600", textAlign: "center" }}>{errorMsg}</Text>
        </View>
      ) : null}

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
              const onJob = (driver as any).hasActiveJob;
              const statusColor = onJob
                ? "#F59E0B"
                : driver.isOnline
                  ? (driver.isAvailable ? "#22C55E" : "#F59E0B")
                  : "#9BA1A6";
              const statusText = onJob
                ? "On Job"
                : driver.isOnline
                  ? (driver.isAvailable ? "Online - Available" : "Online - Busy")
                  : "Offline";

              return (
                <View
                  key={driver.id}
                  className="bg-surface rounded-xl border border-border overflow-hidden"
                >
                  {/* Header row — tappable to expand/collapse */}
                  <TouchableOpacity
                    onPress={() => setExpandedId(expanded ? null : driver.id)}
                    style={{ opacity: 1 }}
                    activeOpacity={0.7}
                  >
                    <View className="p-4">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-3">
                          {/* Status Indicator */}
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: statusColor }} />
                          <View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text className="text-base font-bold text-foreground">{driver.name}</Text>
                              {driver.displayNumber && (
                                <View style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>
                                    #{driver.displayNumber}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 12, color: statusColor, fontWeight: "600" }}>{statusText}</Text>
                            {!onJob && !driver.isOnline && (
                              <Text style={{ fontSize: 11, color: colors.muted }}>
                                Last online: {formatLastOnline((driver as any).lastLocationUpdate)}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-sm text-muted">{driver.totalDeliveries || 0} total · {driver.todayDeliveries || 0} today</Text>
                          {driver.earningsToday > 0 && (
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#22C55E" }}>
                              €{driver.earningsToday.toFixed(2)} today
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Details — NOT inside the TouchableOpacity */}
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
                          <Text className="text-sm text-muted">Driver Number</Text>
                          <Text className="text-sm text-foreground font-semibold">
                            {driver.displayNumber ? `#${driver.displayNumber}` : "Not assigned"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Rating</Text>
                          <Text className="text-sm text-foreground">
                            {driver.rating ? parseFloat(driver.rating).toFixed(1) : "5.0"}/5.0
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
  <Text className="text-sm text-muted">Today's Deliveries</Text>
  <Text className="text-sm text-foreground font-medium">{(driver as any).todayDeliveries || 0}</Text>
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
                            {driver.createdAt ? formatIrishDate(driver.createdAt) : "—"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted">Last Online</Text>
                          <Text className="text-sm text-foreground">
                            {formatLastOnline((driver as any).lastLocationUpdate)}
                          </Text>
                        </View>
                        {/* Cash Settlement */}
                        {(driver as any).unsettledBalance > 0 && (
                          <View className="mt-3 pt-3 border-t border-border">
                            <View className="flex-row justify-between items-center mb-2">
                              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>UNSETTLED CASH</Text>
                              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.warning }}>
                                €{(driver as any).unsettledBalance.toFixed(2)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => markAllSettledMutation.mutate({ driverId: driver.userId, adminUserId: 1 })}
                              disabled={markAllSettledMutation.isPending}
                              style={{
                                backgroundColor: '#22C55E15',
                                borderWidth: 1,
                                borderColor: '#22C55E',
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                alignItems: 'center',
                                opacity: markAllSettledMutation.isPending ? 0.5 : 1,
                              }}
                            >
                              <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 14 }}>
                                {markAllSettledMutation.isPending ? 'Settling...' : '✓ Mark All Settled'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {/* Send Wake-Up Push — only show when driver is online */}
                        {driver.isOnline && (
                          <View className="mt-3 pt-3 border-t border-border">
                            <TouchableOpacity
                              onPress={() => sendWakeUpMutation.mutate({ driverUserId: driver.userId })}
                              disabled={sendWakeUpMutation.isPending}
                              style={{
                                backgroundColor: '#0EA5E915',
                                borderWidth: 1,
                                borderColor: '#0EA5E9',
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>
                                {sendWakeUpMutation.isPending ? 'Sending...' : '📣 Send Wake-Up Push'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Force Offline — only show when driver is online */}
                        {driver.isOnline && (
                          <View className="mt-3 pt-3 border-t border-border">
                            <TouchableOpacity
                              onPress={() => forceOfflineMutation.mutate({ driverUserId: driver.userId })}
                              disabled={forceOfflineMutation.isPending}
                              style={{
                                backgroundColor: '#F59E0B15',
                                borderWidth: 1,
                                borderColor: '#F59E0B',
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14 }}>
                                {forceOfflineMutation.isPending ? 'Forcing Offline...' : '⚡ Force Driver Offline'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Delete Driver */}
                        <View className="mt-3 pt-3 border-t border-border">
                          <TouchableOpacity
                            onPress={() => setDeleteConfirm({ id: driver.id, name: driver.name })}
                            style={{
                              backgroundColor: colors.error + '15',
                              borderWidth: 1,
                              borderColor: colors.error,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              borderRadius: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 14 }}>Delete Driver Account</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Display Number Assignment */}
                        <View className="mt-3 pt-3 border-t border-border">
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8, letterSpacing: 0.5 }}>DISPLAY NUMBER</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
                              <TextInput
                                value={editingDisplayNumber?.userId === driver.userId ? editingDisplayNumber.value : (driver.displayNumber || "")}
                                onChangeText={(text) => setEditingDisplayNumber({ userId: driver.userId, value: text })}
                                onFocus={() => {
                                  if (!editingDisplayNumber || editingDisplayNumber.userId !== driver.userId) {
                                    setEditingDisplayNumber({ userId: driver.userId, value: driver.displayNumber || "" });
                                  }
                                }}
                                placeholder="e.g. 01, 02"
                                placeholderTextColor={colors.muted}
                                style={{ fontSize: 15, color: colors.foreground }}
                                returnKeyType="done"
                                onSubmitEditing={handleSaveDisplayNumber}
                              />
                            </View>
                            <TouchableOpacity
                              onPress={handleSaveDisplayNumber}
                              disabled={!editingDisplayNumber || editingDisplayNumber.userId !== driver.userId}
                              style={{
                                backgroundColor: editingDisplayNumber?.userId === driver.userId ? "#00E5FF" : colors.border,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 10,
                                opacity: editingDisplayNumber?.userId === driver.userId ? 1 : 0.5,
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#151718" }}>Save</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                            Customers will see "Driver {editingDisplayNumber?.userId === driver.userId ? editingDisplayNumber.value || "??" : (driver.displayNumber || "??")}"
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-muted text-center text-base">No drivers registered yet</Text>
          </View>
        )}
      </ScrollView>
      {/* Delete Confirmation Overlay */}
      {deleteConfirm && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 24, zIndex: 100,
        }}>
          <View style={{
            backgroundColor: colors.background, borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground, marginBottom: 8 }}>Delete Driver?</Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>
              Are you sure you want to delete <Text style={{ fontWeight: '700', color: colors.foreground }}>{deleteConfirm.name}</Text>?
            </Text>
            <Text style={{ fontSize: 13, color: colors.error, marginBottom: 20 }}>
              This will permanently remove their account and free their display number. This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, backgroundColor: colors.surface, paddingVertical: 12,
                  borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteDriverMutation.mutate({ driverId: deleteConfirm.id })}
                disabled={deleteDriverMutation.isPending}
                style={{
                  flex: 1, backgroundColor: colors.error, paddingVertical: 12,
                  borderRadius: 10, alignItems: 'center',
                  opacity: deleteDriverMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {deleteDriverMutation.isPending ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

export default function AdminDriverManagement() {
  return (
    <AdminDesktopLayout title="Driver Management">
      <AdminDriverManagementContent />
    </AdminDesktopLayout>
  );
}
