import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

function DriversListScreenContent() {
  const router = useRouter();
  const { data: drivers, isLoading, error } = trpc.auth.getAllDrivers.useQuery();

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading drivers...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <Text className="text-error font-semibold text-center">Failed to load drivers</Text>
        <Text className="text-muted text-center mt-2">{error.message}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-6">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">All Drivers</Text>
          <Text className="text-muted">Total: {drivers?.length || 0} drivers</Text>
        </View>

        {drivers && drivers.length > 0 ? (
          <View className="gap-4">
            {drivers.map((driver) => (
              <View
                key={driver.id}
                className="bg-surface rounded-lg border border-border p-4"
              >
                {/* Driver Info */}
                <View className="mb-3">
                  <Text className="text-foreground font-bold text-lg mb-1">{driver.name}</Text>
                  <Text className="text-muted text-sm">{driver.email}</Text>
                  <Text className="text-muted text-sm">{driver.phone}</Text>
                </View>

                {/* Vehicle Info */}
                {driver.profile ? (
                  <View className="bg-background rounded-lg p-3 mb-3">
                    <Text className="text-foreground font-semibold mb-2">Vehicle Information</Text>
                    <View className="gap-1">
                      <Text className="text-muted text-sm">
                        <Text className="font-semibold">Type:</Text> {driver.profile.vehicleType}
                      </Text>
                      <Text className="text-muted text-sm">
                        <Text className="font-semibold">Number:</Text> {driver.profile.vehicleNumber}
                      </Text>
                      {driver.profile.licenseNumber && (
                        <Text className="text-muted text-sm">
                          <Text className="font-semibold">License:</Text> {driver.profile.licenseNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View className="bg-warning/10 rounded-lg p-3 mb-3">
                    <Text className="text-warning text-sm">No vehicle information</Text>
                  </View>
                )}

                {/* Status */}
                <View className="flex-row items-center gap-2">
                  <View
                    className={`w-3 h-3 rounded-full ${
                      driver.profile?.isOnline ? "bg-success" : "bg-muted"
                    }`}
                  />
                  <Text className="text-muted text-sm">
                    {driver.profile?.isOnline ? "Online" : "Offline"}
                    {driver.profile?.isAvailable ? " • Available" : " • Busy"}
                  </Text>
                </View>

                {/* Actions */}
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    className="flex-1 bg-primary/10 border border-primary py-2 rounded-lg active:opacity-70"
                    onPress={() => {
                      // TODO: Navigate to driver detail/edit page
                    }}
                  >
                    <Text className="text-primary font-semibold text-center text-sm">View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-12">
            <Text className="text-muted text-center mb-4">No drivers registered yet</Text>
            <TouchableOpacity
              onPress={() => router.push("/admin/create-driver" as any)}
              className="bg-primary px-6 py-3 rounded-lg active:opacity-70"
            >
              <Text className="text-background font-semibold">Create First Driver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default function DriversListScreen() {
  return (
    <AdminDesktopLayout title="All Drivers">
      <DriversListScreenContent />
    </AdminDesktopLayout>
  );
}
