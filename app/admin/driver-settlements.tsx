import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useAuth } from "@/lib/auth";

function DriverSettlementsContent() {
  const { user } = useAuth();
  const { data: drivers, isLoading, error, refetch } = trpc.drivers.getUnsettledBalances.useQuery();

  const markAllSettled = trpc.drivers.markAllSettled.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => Alert.alert("Error", e.message),
  });

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

  const handleSettleAll = (driverId: number, driverName: string, totalOwed: number) => {
    const amount = Math.abs(totalOwed).toFixed(2);
    const direction = totalOwed > 0 ? `Collect €${amount} from` : `Pay €${amount} to`;
    Alert.alert(
      "Confirm Settlement",
      `${direction} ${driverName} and mark all shifts settled?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Settle",
          onPress: () => markAllSettled.mutate({ driverId, adminId: user?.id || 0 }),
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-6">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-1">Driver Settlements</Text>
          <Text className="text-muted">
            {drivers && drivers.length > 0
              ? `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} with unsettled balance`
              : "All drivers settled up"}
          </Text>
        </View>

        {!drivers || drivers.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-4xl mb-4">✅</Text>
            <Text className="text-foreground font-semibold text-lg">All Clear</Text>
            <Text className="text-muted text-center mt-2">No outstanding balances</Text>
          </View>
        ) : (
          <View className="gap-4">
            {drivers.map((driver) => (
              <View key={driver.driverId} className="bg-surface rounded-lg border border-border p-4">
                {/* Driver name + shift count */}
                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <Text className="text-foreground font-bold text-lg">{driver.driverName}</Text>
                    <Text className="text-muted text-sm">
                      {driver.shiftCount} unsettled shift{driver.shiftCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  {/* Amount owed */}
                  <View className="items-end">
                    <Text className={`text-xl font-bold ${driver.totalOwed > 0 ? "text-error" : "text-success"}`}>
                      €{Math.abs(driver.totalOwed).toFixed(2)}
                    </Text>
                    <Text className="text-muted text-xs">
                      {driver.totalOwed > 0 ? "driver owes you" : "you owe driver"}
                    </Text>
                  </View>
                </View>

                {/* Shift breakdown */}
                <View className="bg-background rounded-lg p-3 mb-3 gap-2">
                  {driver.shifts.map((shift) => (
                    <View key={shift.shiftId} className="flex-row justify-between items-center">
                      <Text className="text-muted text-sm">
                        {shift.endedAt
                          ? new Date(shift.endedAt).toLocaleDateString("en-IE", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Unknown date"}{" "}
                        · {shift.totalJobs} job{shift.totalJobs !== 1 ? "s" : ""}
                      </Text>
                      <Text className={`text-sm font-semibold ${shift.netOwed > 0 ? "text-error" : "text-success"}`}>
                        €{Math.abs(shift.netOwed).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Settle All button */}
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
            ))}
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
