import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function DriverHomeScreen() {
  const router = useRouter();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // Register push token for driver
  usePushNotifications(user?.id);

  const { data: stats, refetch: refetchStats } = trpc.drivers.getStats.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id }
  );
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifiedOfferId = useRef<number | null>(null);

  // Check for active delivery
  const { data: activeDelivery } = trpc.drivers.getActiveDelivery.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id, refetchInterval: 5000 }
  );

  // tRPC mutations
  const toggleOnlineMutation = trpc.drivers.toggleOnlineStatus.useMutation();
  const acceptOfferMutation = trpc.drivers.acceptOffer.useMutation();
  const declineOfferMutation = trpc.drivers.declineOffer.useMutation();

  // Queue position query
  const { data: queueData, refetch: refetchQueue } = trpc.drivers.getQueuePosition.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id && isOnline, refetchInterval: 5000 }
  );

  // Waiting orders count (shows when offline to encourage going online)
  const { data: waitingData } = trpc.drivers.waitingOrdersCount.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );

  // Current offer query (polls every 3 seconds when online)
  const { data: offerData, refetch: refetchOffer } = trpc.drivers.getCurrentOffer.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id && isOnline, refetchInterval: 3000 }
  );

  // Check if user is authorized to access driver dashboard
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        AsyncStorage.setItem("appMode", "customer");
        router.replace("/");
        return;
      }
      if (user.role !== "driver") {
        AsyncStorage.setItem("appMode", "customer");
        router.replace("/");
      }
    }
  }, [user, isLoading]);

  // Request notification permissions on mount
  useEffect(() => {
    if (Platform.OS !== "web") {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      Notifications.requestPermissionsAsync();
    }
  }, []);

  // Notify driver when a NEW offer appears (haptics + local push notification)
  useEffect(() => {
    if (offerData?.hasOffer && offerData.offer) {
      const offerId = offerData.offer.offerId;
      if (lastNotifiedOfferId.current !== offerId) {
        lastNotifiedOfferId.current = offerId;
        // Trigger haptic vibration
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }, 300);
          // Fire local push notification (shows even when app is backgrounded)
          Notifications.scheduleNotificationAsync({
            content: {
              title: "🚗 New Delivery Offer!",
              body: `${offerData.offer.storeName} — €${parseFloat(offerData.offer.deliveryFee).toFixed(2)} fee. Respond within 15 seconds!`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // Fire immediately
          });
        }
      }
    }
  }, [offerData?.offer?.offerId]);

  // Countdown timer for offers
  useEffect(() => {
    if (offerData?.hasOffer && offerData.offer) {
      const expiresAt = new Date(offerData.offer.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setCountdown(remaining);

      // Clear any existing countdown
      if (countdownRef.current) clearInterval(countdownRef.current);

      countdownRef.current = setInterval(() => {
        const newRemaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setCountdown(newRemaining);
        if (newRemaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          // Refetch to get next offer or clear
          refetchOffer();
        }
      }, 1000);
    } else {
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [offerData?.offer?.offerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Real stats from database
  const todayEarnings = stats?.todayEarnings || 0;
  const todayTips = stats?.todayTips || 0;
  const todayDeliveries = stats?.todayDeliveries || 0;
  const totalDeliveries = stats?.totalDeliveries || 0;
  const weekEarnings = stats?.weekEarnings || 0;
  const weekTips = stats?.weekTips || 0;

  const handleToggleOnline = async () => {
    if (!user) return;
    setIsTogglingOnline(true);
    try {
      const newStatus = !isOnline;
      await toggleOnlineMutation.mutateAsync({
        driverId: user.id,
        isOnline: newStatus,
      });
      setIsOnline(newStatus);
      if (newStatus) {
        refetchQueue();
      }
    } catch (error) {
      console.error("Failed to toggle online status:", error);
    } finally {
      setIsTogglingOnline(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!offerData?.offer || !user) return;
    try {
      const result = await acceptOfferMutation.mutateAsync({
        offerId: offerData.offer.offerId,
        driverId: user.id,
      });
      // Navigate to active delivery
      if (countdownRef.current) clearInterval(countdownRef.current);
      router.push(`/driver/active-delivery?orderId=${result.orderId}`);
    } catch (error) {
      console.error("Failed to accept offer:", error);
      refetchOffer();
    }
  };

  const handleDeclineOffer = async () => {
    if (!offerData?.offer || !user) return;
    try {
      // Clear countdown immediately so the card disappears
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);

      await declineOfferMutation.mutateAsync({
        offerId: offerData.offer.offerId,
        driverId: user.id,
      });

      // Backend auto-toggles driver offline on decline.
      // Update local state to reflect this.
      setIsOnline(false);
    } catch (error) {
      console.error("Failed to decline offer:", error);
      // Still set offline on error since backend may have already toggled
      setIsOnline(false);
    }
  };

  const handleSwitchToCustomerMode = async () => {
    try {
      await AsyncStorage.setItem("appMode", "customer");
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to switch mode:", error);
    }
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-muted mt-4">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Don't render content if user is not a driver (will be redirected)
  if (!user || user.role !== "driver") {
    return null;
  }

  const hasOffer = offerData?.hasOffer && offerData.offer && countdown > 0;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Driver Dashboard</Text>
          <Text className="text-muted">Welcome back, {user.name}!</Text>
        </View>

        {/* Active Delivery Banner */}
        {activeDelivery && activeDelivery.id && (
          <TouchableOpacity
            onPress={() => router.push(`/driver/active-delivery?orderId=${activeDelivery.id}`)}
            style={{
              backgroundColor: '#FEF3C7',
              borderWidth: 2,
              borderColor: '#F59E0B',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#92400E', marginBottom: 4 }}>
                🚗 Active Delivery in Progress
              </Text>
              <Text style={{ fontSize: 13, color: '#92400E' }}>
                {activeDelivery.orderNumber || `Order #${activeDelivery.id}`} • {activeDelivery.store?.name || 'Store'}
              </Text>
            </View>
            <Text style={{ fontSize: 24, color: '#F59E0B' }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Online/Offline Toggle */}
        <View className="bg-surface p-6 rounded-lg mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-foreground font-bold text-xl mb-1">
                {isOnline ? "You're Online" : "You're Offline"}
              </Text>
              <Text className="text-muted text-sm">
                {isOnline 
                  ? "Ready to receive delivery requests" 
                  : "Toggle on to start receiving jobs"}
              </Text>
              {!isOnline && (waitingData?.count ?? 0) > 0 && (
                <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#92400E', fontWeight: '600' }}>
                    📦 {waitingData!.count} order{waitingData!.count !== 1 ? 's' : ''} waiting for delivery
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={handleToggleOnline}
              disabled={isTogglingOnline}
              style={{
                width: 80,
                height: 40,
                borderRadius: 20,
                backgroundColor: isOnline ? "#22C55E" : "#9BA1A6",
                justifyContent: "center",
                paddingHorizontal: 4,
                opacity: isTogglingOnline ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  alignSelf: isOnline ? "flex-end" : "flex-start",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                }}
              />
            </TouchableOpacity>
          </View>

          {isOnline && (
            <View>
              {/* Queue Position */}
              {queueData?.inQueue && (
                <View className="bg-primary/10 p-3 rounded-lg border border-primary mb-3">
                  <Text className="text-primary text-center font-bold text-lg">
                    #{queueData.position} of {queueData.totalOnline} drivers online
                  </Text>
                  <Text className="text-primary/70 text-center text-sm mt-1">
                    {queueData.position === 1 
                      ? "You're next in line for a delivery!" 
                      : `${queueData.position - 1} driver${queueData.position - 1 > 1 ? "s" : ""} ahead of you`}
                  </Text>
                </View>
              )}

              {!hasOffer && (
                <View className="bg-success/10 p-3 rounded-lg border border-success mb-3">
                  <Text className="text-success text-center font-semibold">
                    🟢 Waiting for delivery requests...
                  </Text>
                  <Text className="text-success/70 text-center text-xs mt-1">
                    Checking every 3 seconds
                  </Text>
                </View>
              )}


            </View>
          )}
        </View>

        {/* INCOMING ORDER OFFER - Full-width prominent card */}
        {hasOffer && offerData.offer && (
          <View className="bg-warning/10 border-2 border-warning p-4 rounded-lg mb-6">
            {/* Countdown Timer */}
            <View className="items-center mb-4">
              <Text className="text-warning font-bold text-sm mb-1">INCOMING ORDER</Text>
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: countdown <= 5 ? "#EF4444" : "#F59E0B",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold" }}>
                  {countdown}
                </Text>
              </View>
              <Text className="text-muted text-xs mt-1">seconds to respond</Text>
            </View>

            {/* Order Details */}
            <View className="bg-background p-3 rounded-lg mb-3">
              <Text className="text-foreground font-bold text-lg mb-1">
                {offerData.offer.storeName}
              </Text>
              <Text className="text-muted text-sm mb-2">
                📍 {offerData.offer.storeAddress}
              </Text>
              <View className="border-t border-border pt-2 mt-1">
                <Text className="text-muted text-sm">
                  🏠 Deliver to: {offerData.offer.deliveryAddress}
                </Text>
                {offerData.offer.estimatedDistanceKm != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 13, color: '#1D4ED8', fontWeight: '600' }}>
                      📏 Est. distance: {offerData.offer.estimatedDistanceKm} km
                    </Text>
                  </View>
                )}
              </View>
              {offerData.offer.customerNotes && (
                <View className="bg-warning/10 p-2 rounded mt-2">
                  <Text className="text-warning text-xs font-semibold">📝 Customer Notes:</Text>
                  <Text className="text-foreground text-sm">{offerData.offer.customerNotes}</Text>
                </View>
              )}
              <View className="flex-row justify-between mt-2 pt-2 border-t border-border">
                <Text className="text-muted text-sm">
                  {offerData.offer.itemCount} item{offerData.offer.itemCount !== 1 ? "s" : ""}
                </Text>
                <Text className="text-muted text-sm">
                  {offerData.offer.paymentMethod === "cash_on_delivery" ? "💵 Cash" : "💳 Card"}
                </Text>
                <Text className="text-primary font-bold">
                  €{parseFloat(offerData.offer.deliveryFee).toFixed(2)} fee
                  {offerData.offer.tipAmount && parseFloat(offerData.offer.tipAmount) > 0 ? ` + €${parseFloat(offerData.offer.tipAmount).toFixed(2)} tip` : ''}
                </Text>
              </View>
            </View>

            {/* Accept / Decline Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleDeclineOffer}
                disabled={declineOfferMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: "#EF4444",
                  padding: 14,
                  borderRadius: 10,
                  alignItems: "center",
                  opacity: declineOfferMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                  ✕ Decline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAcceptOffer}
                disabled={acceptOfferMutation.isPending}
                style={{
                  flex: 2,
                  backgroundColor: "#22C55E",
                  padding: 14,
                  borderRadius: 10,
                  alignItems: "center",
                  opacity: acceptOfferMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                  ✓ Accept Order
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Earnings Summary */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Earnings</Text>
          
          {/* Today */}
          <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">Today</Text>
              <Text className="text-primary font-bold text-2xl">€{todayEarnings.toFixed(2)}</Text>
              {todayTips > 0 && (
                <Text style={{ color: '#0a7ea4', fontSize: 12, marginTop: 2 }}>Incl. €{todayTips.toFixed(2)} tips</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">Deliveries</Text>
              <Text className="text-foreground font-bold text-2xl">{todayDeliveries}</Text>
            </View>
          </View>

          {/* This Week */}
          <View className="flex-row justify-between mb-4">
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">This Week</Text>
              <Text style={{ color: '#0a7ea4' }} className="font-bold text-xl">€{weekEarnings.toFixed(2)}</Text>
              {weekTips > 0 && (
                <Text style={{ color: '#0a7ea4', fontSize: 12, marginTop: 2 }}>Incl. €{weekTips.toFixed(2)} tips</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/driver/earnings")}
            className="bg-primary/10 p-3 rounded-lg items-center active:opacity-70"
          >
            <Text className="text-primary font-semibold">View Full Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-4">Your Stats</Text>
          
          <View className="space-y-3">
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Total Deliveries</Text>
              <Text className="text-foreground font-semibold">{totalDeliveries}</Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-muted">Rating</Text>
              <Text className="text-foreground font-semibold">⭐ 4.9</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        {!isOnline && (
          <View className="bg-warning/10 border border-warning p-4 rounded-lg mb-6">
            <Text className="text-warning font-bold mb-2">💡 How It Works</Text>
            <Text className="text-foreground text-sm leading-relaxed">
              1. Toggle "Online" to start receiving delivery offers{"\n"}
              2. Orders are offered one at a time, oldest first{"\n"}
              3. You have 15 seconds to accept or decline each offer{"\n"}
              4. If you decline, the next oldest order will be offered{"\n"}
              5. After completing a delivery, you'll get the next available order
            </Text>
          </View>
        )}

        {/* Switch to Customer Mode */}
        <TouchableOpacity
          onPress={handleSwitchToCustomerMode}
          className="bg-surface border border-border p-4 rounded-lg mb-6 active:opacity-70"
        >
          <Text className="text-foreground font-semibold text-center">🛒 Switch to Customer Mode</Text>
          <Text className="text-muted text-sm text-center mt-1">Browse stores and place orders</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
