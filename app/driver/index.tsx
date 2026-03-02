import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { startWebAlarm, stopWebAlarm } from "@/lib/notification-sound";

const isExpoGo = Constants.appOwnership === "expo";

export default function DriverHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // Register push token for driver
  usePushNotifications(user?.id);

  // Audio player for alarm sound (native)
  const alarmPlayer = useAudioPlayer(require("@/assets/sounds/order-alert.mp3"));
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enable audio in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

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
  const isAutoTogglingOffRef = useRef(false);
  const lastExpiredOfferId = useRef<number | null>(null);

  // Load driver profile to get actual online status from DB
  // Only fetch once on mount - don't refetch automatically to avoid overriding local state
  const hasSyncedProfile = useRef(false);
  const { data: driverProfile } = trpc.drivers.getProfile.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id, refetchOnWindowFocus: false, refetchOnMount: true, staleTime: Infinity }
  );

  // Force driver offline on login - they must manually toggle online when ready
  useEffect(() => {
    if (hasSyncedProfile.current) return; // Only run once
    if (driverProfile && user?.id) {
      hasSyncedProfile.current = true;
      // Always start offline regardless of DB state
      setIsOnline(false);
      // Ensure server also knows we're offline
      if (driverProfile.isOnline) {
        toggleOnlineMutation.mutate(
          { driverId: user.id, isOnline: false },
          { onSuccess: () => console.log('[Driver] Forced offline on login') }
        );
      }
    }
  }, [driverProfile, user?.id]);

  // Trigger offer check when isOnline becomes true (separate effect to ensure state is updated)
  useEffect(() => {
    if (isOnline && user?.id) {
      console.log('[Driver] isOnline is true, triggering offer check');
      // Wait for query to be enabled, then refetch
      setTimeout(() => refetchOffer(), 500);
    }
  }, [isOnline, user?.id]);

  // Check for active delivery
  const { data: activeDelivery, isLoading: activeDeliveryLoading } = trpc.drivers.getActiveDelivery.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id, refetchInterval: 5000 }
  );
  const [hasAutoRedirected, setHasAutoRedirected] = useState(false);

  // Auto-redirect to active delivery on login/open
  useEffect(() => {
    if (activeDelivery && activeDelivery.id && !hasAutoRedirected && !activeDeliveryLoading) {
      setHasAutoRedirected(true);
      router.push(`/driver/active-delivery?orderId=${activeDelivery.id}`);
    }
  }, [activeDelivery, hasAutoRedirected, activeDeliveryLoading]);

  // tRPC mutations
  const toggleOnlineMutation = trpc.drivers.toggleOnlineStatus.useMutation();
  const acceptOfferMutation = trpc.drivers.acceptOffer.useMutation();
  const declineOfferMutation = trpc.drivers.declineOffer.useMutation();
  const updateLocationMutation = trpc.drivers.updateLocation.useMutation();

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
  // Use isOnlineRef to immediately cut off polling when auto-toggling offline
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const { data: offerData, refetch: refetchOffer } = trpc.drivers.getCurrentOffer.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id && isOnline, refetchInterval: isOnline ? 3000 : false }
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
    if (Platform.OS !== "web" && !isExpoGo) {
      try {
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
      } catch (e) {
        console.log("[Push] Could not set up notifications in Expo Go");
      }
    }
  }, []);

  // Helper to stop all alarms and vibrations
  const stopAllAlarms = useCallback(() => {
    console.log('[Driver] Stopping all alarms');
    if (Platform.OS === "web") {
      stopWebAlarm();
    } else {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      try {
        alarmPlayer.pause();
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Notify driver when a NEW offer appears (haptics + alarm + push notification)
  useEffect(() => {
    if (offerData?.hasOffer && offerData.offer) {
      const offerId = offerData.offer.offerId;
      if (lastNotifiedOfferId.current !== offerId) {
        lastNotifiedOfferId.current = offerId;
        console.log('[Driver] NEW OFFER detected, offerId:', offerId, '- triggering alarm');

        // --- Start persistent alarm sound ---
        if (Platform.OS === "web") {
          startWebAlarm(6000); // Repeat every 6 seconds on web
        } else {
          // Native: ensure audio mode allows playback, then play alarm
          (async () => {
            try {
              await setAudioModeAsync({ playsInSilentMode: true });
            } catch (e) { console.log('[Driver] Audio mode error:', e); }
            
            try {
              alarmPlayer.seekTo(0);
              alarmPlayer.play();
              console.log('[Driver] Alarm sound started playing');
            } catch (e) {
              console.log('[Driver] Alarm play error:', e);
            }
          })();

          if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
          alarmIntervalRef.current = setInterval(() => {
            try {
              alarmPlayer.seekTo(0);
              alarmPlayer.play();
              console.log('[Driver] Alarm loop playing');
            } catch (e) { console.log('[Driver] Alarm repeat error:', e); }
          }, 4000); // Loop every 4 seconds

          // --- Start persistent vibration pattern ---
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setTimeout(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }, 300);
            setTimeout(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }, 600);
          } catch (e) { console.log('[Driver] Haptics error:', e); }

          if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = setInterval(() => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setTimeout(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }, 300);
            } catch (e) { /* ignore */ }
          }, 3000); // Vibrate every 3 seconds

          // Fire local push notification (works in Expo Go too with scheduleNotificationAsync)
          try {
            Notifications.scheduleNotificationAsync({
              content: {
                title: "New Delivery Offer!",
                body: `${offerData.offer.storeName} - EUR${parseFloat(offerData.offer.deliveryFee).toFixed(2)} fee. Respond within 15 seconds!`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
              },
              trigger: null,
            });
          } catch (e) {
            console.log("[Push] Could not schedule notification:", e);
          }
        }
      }
    }
  }, [offerData?.offer?.offerId]);

  // NOTE: Alarm is now stopped ONLY by explicit user actions (accept/decline)
  // or by autoToggleOffline (countdown expired). No reactive stop on data refetch.

  // Auto-toggle offline: use a ref-based approach to avoid stale closures
  // Store user.id in a ref so the callback always has the latest value
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  
  const autoToggleOffline = useCallback(() => {
    if (isAutoTogglingOffRef.current) return; // Prevent double-fire
    isAutoTogglingOffRef.current = true;
    console.log('[Driver] Auto-toggling offline due to expired offer');
    
    // 0. Stop all alarms immediately
    stopAllAlarms();
    
    // 1. Clear countdown immediately
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(0);
    
    // 2. Set offline locally to stop all polling
    setIsOnline(false);
    
    // 3. Persist to server (fire and forget - don't await to avoid closure issues)
    const driverId = userIdRef.current;
    if (driverId) {
      toggleOnlineMutation.mutate(
        { driverId, isOnline: false },
        {
          onSuccess: () => console.log('[Driver] Successfully auto-toggled offline on server'),
          onError: (err) => console.error('[Driver] Failed to auto-toggle offline:', err),
        }
      );
    }
    
    // Reset flag after a delay
    setTimeout(() => { isAutoTogglingOffRef.current = false; }, 3000);
  }, []);

  // Countdown timer for offers - uses a self-contained interval that doesn't depend on React state
  const countdownOfferIdRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Clean up previous countdown
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    
    if (!offerData?.hasOffer || !offerData.offer) {
      // No offer available
      // If we were tracking an offer (had a countdown running), it was removed server-side
      if (countdownOfferIdRef.current !== null) {
        console.log('[Driver] Offer disappeared server-side, auto-toggling offline');
        countdownOfferIdRef.current = null;
        setCountdown(0);
        autoToggleOffline();
      } else {
        setCountdown(0);
      }
      return;
    }
    
    const offerId = offerData.offer.offerId;
    const expiresAt = new Date(offerData.offer.expiresAt).getTime();
    
    // Calculate initial remaining time
    const initialRemaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    
    // If already expired on arrival
    if (initialRemaining <= 0) {
      if (lastExpiredOfferId.current !== offerId) {
        lastExpiredOfferId.current = offerId;
        countdownOfferIdRef.current = null;
        setCountdown(0);
        autoToggleOffline();
      }
      return;
    }
    
    // Track this offer
    countdownOfferIdRef.current = offerId;
    setCountdown(initialRemaining);
    
    // Start countdown interval
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      
      if (remaining <= 0) {
        // Timer expired!
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        lastExpiredOfferId.current = offerId;
        countdownOfferIdRef.current = null;
        console.log('[Driver] Countdown reached 0, auto-toggling offline');
        autoToggleOffline();
      }
    }, 1000);
    
    return () => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [offerData?.offer?.offerId, offerData?.hasOffer]);

  // GPS location reporting when driver is online (every 10 seconds)
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<any>(null);

  useEffect(() => {
    // Clean up previous location tracking
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }

    if (!isOnline || !user?.id) return;

    console.log('[Driver] Starting GPS location reporting (online)');

    if (Platform.OS === "web") {
      if (!navigator.geolocation) return;
      const sendLocation = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateLocationMutation.mutate({
              driverId: user!.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (err) => console.log("[Driver] Geolocation error:", err.message),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };
      sendLocation(); // Send immediately
      locationIntervalRef.current = setInterval(sendLocation, 10000);
    } else {
      // Native: use expo-location
      (async () => {
        try {
          const Location = await import("expo-location");
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            console.log("[Driver] Location permission denied");
            return;
          }
          locationSubRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 10000,
              distanceInterval: 10,
            },
            (loc) => {
              updateLocationMutation.mutate({
                driverId: user!.id,
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
            }
          );
        } catch (e) {
          console.log("[Driver] Location tracking not available:", e);
        }
      })();
    }

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [isOnline, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
      stopWebAlarm();
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
    // Stop alarm immediately on accept
    stopAllAlarms();
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
    // Stop alarm immediately on decline
    stopAllAlarms();
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

  // Show pending approval screen if driver is not yet approved
  if (stats?.approvalStatus === "pending") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 36 }}>⏳</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground mb-3 text-center">Application Under Review</Text>
          <Text className="text-base text-muted text-center mb-6" style={{ lineHeight: 22 }}>
            Thanks for signing up to drive with WESHOP4U! Your application is being reviewed by our team. We'll notify you once you've been approved.
          </Text>
          <View style={{ backgroundColor: '#F0F9FF', borderRadius: 12, padding: 16, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#BAE6FD' }}>
            <Text style={{ fontWeight: '600', color: '#0369A1', marginBottom: 8, fontSize: 15 }}>What happens next?</Text>
            <Text style={{ color: '#0C4A6E', fontSize: 14, lineHeight: 20 }}>1. Our team reviews your details</Text>
            <Text style={{ color: '#0C4A6E', fontSize: 14, lineHeight: 20 }}>2. You'll receive a notification when approved</Text>
            <Text style={{ color: '#0C4A6E', fontSize: 14, lineHeight: 20 }}>3. Once approved, you can go online and start accepting deliveries</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Show rejected screen
  if (stats?.approvalStatus === "rejected") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 36 }}>❌</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground mb-3 text-center">Application Not Approved</Text>
          <Text className="text-base text-muted text-center" style={{ lineHeight: 22 }}>
            Unfortunately your driver application was not approved at this time. If you believe this is an error, please contact us.
          </Text>
        </View>
      </ScreenContainer>
    );
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
                  : "Go online to start receiving jobs"}
              </Text>
              {!isOnline && (waitingData?.count ?? 0) > 0 && (
                <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#92400E', fontWeight: '600' }}>
                    🔔 {waitingData!.count} job{waitingData!.count !== 1 ? 's' : ''} waiting
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
              {offerData.offer.allowSubstitution && (
                <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 6, marginTop: 8, flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "600" }}>
                    🔄 Substitutions allowed if items out of stock
                  </Text>
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
          className="bg-surface border border-border p-4 rounded-lg active:opacity-70"
          style={{ marginBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <Text className="text-foreground font-semibold text-center">🛒 Switch to Customer Mode</Text>
          <Text className="text-muted text-sm text-center mt-1">Browse stores and place orders</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
