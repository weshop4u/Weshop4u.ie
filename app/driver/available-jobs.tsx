import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function AvailableJobsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: jobs, isLoading, refetch } = trpc.orders.getAvailableJobs.useQuery();
  const { data: user } = trpc.auth.me.useQuery();
  const acceptJobMutation = trpc.orders.acceptJob.useMutation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAcceptJob = async (orderId: number) => {
    if (!user) return;

    try {
      await acceptJobMutation.mutateAsync({
        orderId,
        driverId: user.id,
      });

      // Navigate to active delivery
      router.push(`/driver/active-delivery?orderId=${orderId}`);
    } catch (error) {
      console.error("Failed to accept job:", error);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="active:opacity-70 mb-2"
          >
            <Text className="text-primary text-lg">‹ Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground mb-2">Available Jobs</Text>
          <Text className="text-muted">{jobs?.length || 0} jobs waiting for pickup</Text>
        </View>

        {/* Jobs List */}
        {!jobs || jobs.length === 0 ? (
          <View className="bg-surface p-8 rounded-lg items-center">
            <Text className="text-4xl mb-4">📦</Text>
            <Text className="text-xl font-bold text-foreground mb-2">No Jobs Available</Text>
            <Text className="text-muted text-center">
              Pull down to refresh or check back later for new delivery requests.
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {jobs.map((job) => (
              <View
                key={job.id}
                className="bg-surface border border-border rounded-xl p-4"
              >
                {/* Job Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">
                      Order #{job.orderNumber}
                    </Text>
                    <Text className="text-muted text-sm">{job.store?.name}</Text>
                  </View>
                  <View className="bg-primary/10 rounded-full px-3 py-1">
                    <Text className="text-primary font-bold">€{job.deliveryFee}</Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View className="mb-3">
                  {job.status === "pending" && (
                    <View className="bg-warning/10 border border-warning rounded-lg px-3 py-2 flex-row items-center">
                      <Text className="text-warning font-semibold">⏳ Waiting for Store to Accept</Text>
                    </View>
                  )}
                  {job.status === "accepted" && (
                    <View className="bg-primary/10 border border-primary rounded-lg px-3 py-2 flex-row items-center">
                      <Text className="text-primary font-semibold">🔄 Being Prepared</Text>
                    </View>
                  )}
                  {job.status === "ready_for_pickup" && (
                    <View className="bg-success/10 border border-success rounded-lg px-3 py-2 flex-row items-center">
                      <Text className="text-success font-semibold">✅ Ready to Pick Up</Text>
                    </View>
                  )}
                </View>

                {/* Pickup Location */}
                <View className="mb-3 pb-3 border-b border-border">
                  <Text className="text-xs text-muted mb-1">📍 PICKUP</Text>
                  <Text className="text-foreground">{job.store?.address}</Text>
                </View>

                {/* Delivery Location */}
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1">🏠 DELIVERY</Text>
                  <Text className="text-foreground">{job.deliveryAddress}</Text>
                </View>

                {/* Customer Notes */}
                {job.customerNotes && (
                  <View className="bg-warning/10 border border-warning rounded-lg px-3 py-2 mb-4">
                    <Text className="text-warning font-semibold text-xs mb-1">📝 Customer Notes:</Text>
                    <Text className="text-foreground text-sm">{job.customerNotes}</Text>
                  </View>
                )}

                {/* Order Details */}
                <View className="flex-row justify-between mb-4">
                  <View>
                    <Text className="text-xs text-muted">Order Total</Text>
                    <Text className="text-foreground font-semibold">€{job.total}</Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted">Your Earnings</Text>
                    <Text className="text-primary font-bold">€{job.deliveryFee}</Text>
                  </View>
                </View>

                {/* Accept Button */}
                <TouchableOpacity
                  onPress={() => handleAcceptJob(job.id)}
                  disabled={acceptJobMutation.isPending}
                  className="bg-primary p-4 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-background font-bold text-lg">
                    {acceptJobMutation.isPending ? "Accepting..." : "Accept Job"}
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
