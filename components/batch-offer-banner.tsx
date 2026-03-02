import { View, Text, TouchableOpacity, Platform, Vibration } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { startWebAlarm, stopWebAlarm } from "@/lib/notification-sound";

interface BatchOfferBannerProps {
  driverId: number;
}

export function BatchOfferBanner({ driverId }: BatchOfferBannerProps) {
  const colors = useColors();
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifiedOfferId = useRef<number | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio player for batch offer alert sound (native)
  const alarmPlayer = useAudioPlayer(require("@/assets/sounds/order-alert.mp3"));

  // Enable audio in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

  // Poll for batch offers every 3 seconds
  const { data: batchOffer, refetch: refetchBatchOffer } = trpc.drivers.getBatchOffer.useQuery(
    { driverId },
    { refetchInterval: 3000 }
  );

  const acceptOfferMutation = trpc.drivers.acceptOffer.useMutation();
  const declineOfferMutation = trpc.drivers.declineOffer.useMutation();
  const utils = trpc.useUtils();

  // Stop all alarms
  const stopAlarms = useCallback(() => {
    console.log("[BatchOffer] Stopping all alarms");
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
      Vibration.cancel();
    }
  }, [alarmPlayer]);

  // Start alarms when new batch offer arrives
  useEffect(() => {
    if (batchOffer?.offerId && lastNotifiedOfferId.current !== batchOffer.offerId) {
      lastNotifiedOfferId.current = batchOffer.offerId;
      console.log("[BatchOffer] New batch offer, starting alarm:", batchOffer.offerId);

      if (Platform.OS === "web") {
        // Web: use web alarm with 4-second repeat (slightly faster than regular offers)
        startWebAlarm(4000);
      } else {
        // Native: play alarm sound immediately + vibrate
        try {
          alarmPlayer.seekTo(0);
          alarmPlayer.play();
          console.log("[BatchOffer] Alarm sound started");
        } catch (e) {
          console.log("[BatchOffer] Alarm play error:", e);
        }

        // Repeat alarm every 4 seconds
        alarmIntervalRef.current = setInterval(() => {
          try {
            alarmPlayer.seekTo(0);
            alarmPlayer.play();
          } catch (e) { /* ignore */ }
        }, 4000);

        // Strong vibration pattern: 3 short bursts repeated every 3 seconds
        // Pattern: vibrate 200ms, pause 150ms, vibrate 200ms, pause 150ms, vibrate 200ms
        Vibration.vibrate([200, 150, 200, 150, 200], false);
        vibrationIntervalRef.current = setInterval(() => {
          Vibration.vibrate([200, 150, 200, 150, 200], false);
        }, 3000);

        // Also fire haptic feedback for extra attention
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 400);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 800);
      }
    }

    // Stop alarms when offer disappears (expired/accepted/declined)
    if (!batchOffer?.offerId && lastNotifiedOfferId.current) {
      stopAlarms();
    }
  }, [batchOffer?.offerId, alarmPlayer, stopAlarms]);

  // Cleanup alarms on unmount
  useEffect(() => {
    return () => {
      stopAlarms();
    };
  }, [stopAlarms]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!batchOffer?.expiresAt) {
      setCountdown(0);
      return;
    }

    const expiresAt = new Date(batchOffer.expiresAt).getTime();
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);

      // Intensify vibration in last 5 seconds
      if (remaining <= 5 && remaining > 0 && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        stopAlarms();
        refetchBatchOffer();
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [batchOffer?.offerId, stopAlarms]);

  const handleAcceptBatch = useCallback(async () => {
    if (!batchOffer) return;
    stopAlarms(); // Stop alarm immediately on accept
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      await acceptOfferMutation.mutateAsync({
        offerId: batchOffer.offerId,
        driverId,
      });
      // Invalidate batch queries to refresh the delivery list
      utils.drivers.getActiveBatch.invalidate();
      utils.drivers.getActiveDelivery.invalidate();
      refetchBatchOffer();
    } catch (error) {
      console.error("[BatchOffer] Failed to accept:", error);
      refetchBatchOffer();
    }
  }, [batchOffer, driverId, stopAlarms]);

  const handleDeclineBatch = useCallback(async () => {
    if (!batchOffer) return;
    stopAlarms(); // Stop alarm immediately on decline
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    try {
      await declineOfferMutation.mutateAsync({
        offerId: batchOffer.offerId,
        driverId,
      });
      refetchBatchOffer();
    } catch (error) {
      console.error("[BatchOffer] Failed to decline:", error);
      refetchBatchOffer();
    }
  }, [batchOffer, driverId, stopAlarms]);

  // Don't render if no batch offer
  if (!batchOffer || countdown <= 0) return null;

  return (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        borderWidth: 2,
        borderColor: countdown <= 5 ? "#EF4444" : "#F59E0B",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header with countdown */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: "#92400E", marginBottom: 2 }}>
            🔔 EXTRA ORDER AVAILABLE
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#78350F" }}>
            {batchOffer.newBatchSize} jobs now waiting in {batchOffer.storeName}
          </Text>
        </View>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: countdown <= 5 ? "#EF4444" : "#F59E0B",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>{countdown}</Text>
        </View>
      </View>

      {/* Order details */}
      <View style={{ backgroundColor: "#FFFBEB", padding: 10, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: "#92400E", marginBottom: 4 }}>
          Order: {batchOffer.orderNumber}
        </Text>
        <Text style={{ fontSize: 13, color: "#92400E" }}>
          🏠 {batchOffer.deliveryAddress}
        </Text>
      </View>

      {/* Sound indicator */}
      <Text style={{ fontSize: 11, color: "#B45309", textAlign: "center", marginBottom: 8 }}>
        🔊 Alert sound active — tap Accept or Decline to stop
      </Text>

      {/* Accept / Decline */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          onPress={handleDeclineBatch}
          disabled={declineOfferMutation.isPending}
          style={{
            flex: 1,
            backgroundColor: "#EF4444",
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            opacity: declineOfferMutation.isPending ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAcceptBatch}
          disabled={acceptOfferMutation.isPending}
          style={{
            flex: 2,
            backgroundColor: "#22C55E",
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            opacity: acceptOfferMutation.isPending ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>
            ✓ Accept New Order
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
