import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useState } from "react";

function DriverSettlementsContent() {
  const [tab, setTab] = useState<"outstanding" | "history">("outstanding");

  const { data: drivers, isLoading, error, refetch } = trpc.drivers.getUnsettledBalances.useQuery();
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = trpc.drivers.getSettlementHistory.useQuery();

  const markAllSettled = trpc.drivers.markAllSettled.useMutation({
    onSuccess: () => { refetch(); refetchHistory(); },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const handleSettleAll = (driverId: number, driverName: string, totalOwed: number) => {
    const amount = Math.abs(totalOwed).toFixed(2);
    const direction = totalOwed > 0 ? `Collect €${amount} from` : `Pay €${amount} to`;
    const message = `${direction} ${driverName} and mark all shifts settled?`;

    if (Platform.OS === "web") {
      if (window.confirm(message)) {
        markAllSettled.mutate({ driverId, adminId: 0 });
      }
    } else {
      Alert.alert(
        "Confirm Settlement",
        message,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Settle", onPress: () => markAllSettled.mutate({ driverId, adminId: 0 }) },
        ]
      );
    }
  };

  // Stats from history
  const totalSettledAllTime = history?.reduce((sum, s) => sum + Math.max(0, s.netOwed), 0) || 0;
  const thisMonth = history?.filter(s => {
    const d = new Date(s.settledAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }) || [];
  const totalSettledThisMonth = thisMonth.reduce((sum, s) => sum + Math.max(0, s.netOwed), 0);

  const today = history?.filter(s => {
    const d = new Date(s.settledAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }) || [];
  const totalSettledToday = today.reduce((sum, s) => sum + Math.max(0, s.netOwed), 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const thisWeek = history?.filter(s => new Date(s.settledAt) >= startOfWeek) || [];
  const totalSettledThisWeek = thisWeek.reduce((sum, s) => sum + Math.max(0, s.netOwed), 0);

  // Group history by settlement date (same settledAt within 1 min = same batch)
  const groupedHistory: { settledAt: string; driverName: string; shifts: typeof history }[] = [];
  if (history) {
    for (const s of history) {
      const last = groupedHistory[groupedHistory.length - 1];
      if (last && last.driverName === s.driverName &&
        Math.abs(new Date(last.settledAt).getTime() - new Date(s.settledAt).getTime()) < 60000) {
        last.shifts!.push(s);
      } else {
        groupedHistory.push({ settledAt: s.settledAt, driverName: s.driverName, shifts: [s] });
      }
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading settlements...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <Text className="text-error font-semibold text-center">Failed to load settlements</Text>
        <Text className="text-muted text-center mt-2">{error.message}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-6">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-1">Driver Settlements</Text>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-4 mb-4">
          <View className="flex-1 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-xs mb-1">Today</Text>
            <Text className="text-foreground font-bold text-xl">€{totalSettledToday.toFixed(2)}</Text>
            <Text className="text-muted text-xs">{today.length} shift{today.length !== 1 ? "s" : ""} settled</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-xs mb-1">This Week</Text>
            <Text className="text-foreground font-bold text-xl">€{totalSettledThisWeek.toFixed(2)}</Text>
            <Text className="text-muted text-xs">{thisWeek.length} shift{thisWeek.length !== 1 ? "s" : ""} settled</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-xs mb-1">This Month</Text>
            <Text className="text-foreground font-bold text-xl">€{totalSettledThisMonth.toFixed(2)}</Text>
            <Text className="text-muted text-xs">{thisMonth.length} shift{thisMonth.length !== 1 ? "s" : ""} settled</Text>
          </View>
        </View>

        <View className="flex-row gap-4 mb-6">
          <View className="flex-1 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-xs mb-1">All Time</Text>
            <Text className="text-foreground font-bold text-xl">€{totalSettledAllTime.toFixed(2)}</Text>
            <Text className="text-muted text-xs">{history?.length || 0} shifts settled</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-xs mb-1">Outstanding</Text>
            <Text className={`font-bold text-xl ${(drivers?.length || 0) > 0 ? "text-error" : "text-success"}`}>
              {drivers?.length || 0} driver{(drivers?.length || 0) !== 1 ? "s" : ""}
            </Text>
            <Text className="text-muted text-xs">unsettled balance</Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row mb-4 bg-surface border border-border rounded-lg overflow-hidden">
          <TouchableOpacity
            className={`flex-1 py-3 ${tab === "outstanding" ? "bg-primary" : ""}`}
            onPress={() => setTab("outstanding")}
          >
            <Text className={`text-center font-semibold ${tab === "outstanding" ? "text-background" : "text-muted"}`}>
              Outstanding {(drivers?.length || 0) > 0 ? `(${drivers!.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 ${tab === "history" ? "bg-primary" : ""}`}
            onPress={() => setTab("history")}
          >
            <Text className={`text-center font-semibold ${tab === "history" ? "text-background" : "text-muted"}`}>
              History {history ? `(${groupedHistory.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Outstanding tab */}
        {tab === "outstanding" && (
          <View className="gap-4">
            {!drivers || drivers.length === 0 ? (
              <View className="items-center justify-center py-16">
                <Text className="text-4xl mb-4">✅</Text>
                <Text className="text-foreground font-semibold text-lg">All Clear</Text>
                <Text className="text-muted text-center mt-2">No outstanding balances</Text>
              </View>
            ) : (
              drivers.map((driver) => (
                <View key={driver.driverId} className="bg-surface rounded-lg border border-border p-4">
                  <View className="flex-row justify-between items-start mb-3">
                    <View>
                      <Text className="text-foreground font-bold text-lg">{driver.driverName}</Text>
                      <Text className="text-muted text-sm">
                        {driver.shiftCount} unsettled shift{driver.shiftCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className={`text-xl font-bold ${driver.totalOwed > 0 ? "text-error" : "text-success"}`}>
                        €{Math.abs(driver.totalOwed).toFixed(2)}
                      </Text>
                      <Text className="text-muted text-xs">
                        {driver.totalOwed > 0 ? "driver owes you" : "you owe driver"}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-background rounded-lg p-3 mb-3 gap-3">
                    {driver.shifts.map((shift) => (
                      <View key={shift.shiftId} className="gap-1">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-muted text-sm">
                            {shift.endedAt
                              ? new Date(shift.endedAt).toLocaleDateString("en-IE", {
                                  day: "numeric", month: "short",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "Unknown"}{" "}
                            · {shift.totalJobs} job{shift.totalJobs !== 1 ? "s" : ""}
                          </Text>
                          <Text className={`text-sm font-semibold ${shift.netOwed > 0 ? "text-error" : "text-success"}`}>
                            €{Math.abs(shift.netOwed).toFixed(2)}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-muted text-xs">Cash: €{shift.cashCollected.toFixed(2)}</Text>
                          <Text className="text-muted text-xs">Fees: €{shift.deliveryFeesEarned.toFixed(2)}</Text>
                          <Text className="text-muted text-xs">Tips: €{shift.cardTipsEarned.toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    className="bg-primary py-3 rounded-lg active:opacity-70"
                    onPress={() => handleSettleAll(driver.driverId, driver.driverName, driver.totalOwed)}
                    disabled={markAllSettled.isPending}
                  >
                    <Text className="text-background font-bold text-center">
                      {markAllSettled.isPending ? "Settling..." : "✓ Mark All Settled"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* History tab */}
        {tab === "history" && (
          <View className="gap-3">
            {historyLoading ? (
              <ActivityIndicator size="small" color="#0a7ea4" />
            ) : groupedHistory.length === 0 ? (
              <View className="items-center justify-center py-16">
                <Text className="text-muted">No settlement history yet</Text>
              </View>
            ) : (
              groupedHistory.map((group, idx) => {
                const total = group.shifts!.reduce((sum, s) => sum + s.netOwed, 0);
                const totalJobs = group.shifts!.reduce((sum, s) => sum + s.totalJobs, 0);
                const totalCash = group.shifts!.reduce((sum, s) => sum + (s.cashCollected || 0), 0);
                const totalCardFees = group.shifts!.reduce((sum, s) => sum + (s.deliveryFeesEarned || 0), 0);
                const totalTips = group.shifts!.reduce((sum, s) => sum + (s.cardTipsEarned || 0), 0);
                return (
                  <View key={idx} className="bg-surface rounded-lg border border-border p-4">
                    <View className="flex-row justify-between items-start mb-3">
                      <View>
                        <Text className="text-foreground font-bold">{group.driverName}</Text>
                        <Text className="text-muted text-xs">
                          Settled {new Date(group.settledAt).toLocaleDateString("en-IE", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`font-bold ${total > 0 ? "text-error" : total < 0 ? "text-success" : "text-muted"}`}>
                          €{Math.abs(total).toFixed(2)}
                        </Text>
                        <Text className="text-muted text-xs">
                          {total > 0 ? "driver owed office" : total < 0 ? "office owed driver" : "settled even"}
                        </Text>
                      </View>
                    </View>

                    <View className="bg-background rounded-lg p-3 gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-muted text-sm">Cash collected</Text>
                        <Text className="text-foreground text-sm">€{totalCash.toFixed(2)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-muted text-sm">Delivery fees earned</Text>
                        <Text className="text-foreground text-sm">€{totalCardFees.toFixed(2)}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-muted text-sm">Card tips earned</Text>
                        <Text className="text-foreground text-sm">€{totalTips.toFixed(2)}</Text>
                      </View>
                      <View className="flex-row justify-between mt-1 pt-1 border-t border-border">
                        <Text className="text-muted text-xs">{group.shifts!.length} shift{group.shifts!.length !== 1 ? "s" : ""} · {totalJobs} jobs</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default function DriverSettlementsScreen() {
  return (
    <AdminDesktopLayout title="Driver Settlements">
      <DriverSettlementsContent />
    </AdminDesktopLayout>
  );
}
