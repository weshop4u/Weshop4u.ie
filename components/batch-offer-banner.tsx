import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface BatchOfferBannerProps {
  driverId: number;
}

export function BatchOfferBanner({ driverId }: BatchOfferBannerProps) {
  const colors = useColors();
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifiedOfferId = useRef<number | null>(null);

  // Poll for batch offers every 3 seconds
  const { data: batchOffer, refetch: refetchBatchOffer } = trpc.drivers.getBatchOffer.useQuery(
    { driverId },
    { refetchInterval: 3000 }
  );

  const acceptOfferMutation = trpc.drivers.acceptOffer.useMutation();
  const declineOfferMutation = trpc.drivers.declineOffer.useMutation();
  const utils = trpc.useUtils();

  // Haptic feedback when new batch offer arrives
  useEffect(() => {
    if (batchOffer?.offerId && lastNotifiedOfferId.current !== batchOffer.offerId) {
      lastNotifiedOfferId.current = batchOffer.offerId;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 300);
      }
    }
  }, [batchOffer?.offerId]);

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
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
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
  }, [batchOffer?.offerId]);

  const handleAcceptBatch = useCallback(async () => {
    if (!batchOffer) return;
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
  }, [batchOffer, driverId]);

  const handleDeclineBatch = useCallback(async () => {
    if (!batchOffer) return;
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
  }, [batchOffer, driverId]);

  // Don't render if no batch offer
  if (!batchOffer || countdown <= 0) return null;

  return (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        borderWidth: 2,
        borderColor: "#F59E0B",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header with countdown */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: "#92400E", marginBottom: 2 }}>
            📦 EXTRA ORDER AVAILABLE
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
