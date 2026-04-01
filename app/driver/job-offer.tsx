import { View, Text, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";

export default function JobOfferScreen() {
  const router = useRouter();
  const colors = useColors();
  const [timeLeft, setTimeLeft] = useState(15);
  const [isAccepting, setIsAccepting] = useState(false);
  const [status, setStatus] = useState<"pending" | "accepted" | "declined" | "expired">("pending");

  // Mock job data - will be replaced with real data from backend
  const jobOffer = {
    orderId: 1,
    orderNumber: "WS4U-123456",
    storeName: "Spar Balbriggan",
    storeAddress: "Main Street, Balbriggan, K32 Y621",
    customerAddress: "123 High Street, Balbriggan, K32 Y622",
    deliveryFee: 3.90,
    distance: 3.2,
    items: 5,
  };

  useEffect(() => {
    if (status !== "pending") return;
    // Countdown timer
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Time expired - auto decline
      setStatus("expired");
    }
  }, [timeLeft, status]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      // TODO: Call backend API to accept job
      setStatus("accepted");
    } catch (error) {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    setStatus("declined");
  };

  const getTimerColor = () => {
    if (timeLeft > 10) return colors.success;
    if (timeLeft > 5) return colors.warning;
    return colors.error;
  };

  const getTimerBgColor = () => {
    if (timeLeft > 10) return colors.success + "15";
    if (timeLeft > 5) return colors.warning + "15";
    return colors.error + "15";
  };

  // Show result screen for accepted/declined/expired
  if (status !== "pending") {
    const isAcceptedStatus = status === "accepted";
    const title = isAcceptedStatus ? "Job Accepted!" : status === "declined" ? "Job Declined" : "Time Expired";
    const subtitle = isAcceptedStatus
      ? "Navigate to the store to pick up the order."
      : "The job will be offered to another driver.";
    const emoji = isAcceptedStatus ? "✅" : status === "declined" ? "✕" : "⏰";

    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</Text>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: isAcceptedStatus ? colors.success : colors.muted, marginBottom: 8 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 24 }}>
            {subtitle}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (isAcceptedStatus) {
                router.push(`/driver/active-delivery?orderId=${jobOffer.orderId}`);
              } else {
                router.back();
              }
            }}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 16 }}>
              {isAcceptedStatus ? "Start Navigation" : "Back to Dashboard"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Timer */}
        <View style={{ backgroundColor: getTimerBgColor(), borderWidth: 2, borderColor: getTimerColor(), padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ textAlign: "center", color: colors.muted, marginBottom: 8 }}>Time to Accept</Text>
          <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 56, color: getTimerColor() }}>
            {timeLeft}
          </Text>
          <Text style={{ textAlign: "center", color: colors.muted, marginTop: 8 }}>seconds remaining</Text>
        </View>

        {/* Job Details */}
        <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 20, marginBottom: 16 }}>New Delivery Request</Text>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>Order Number</Text>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 18 }}>{jobOffer.orderNumber}</Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>📍 Pick Up From</Text>
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{jobOffer.storeName}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{jobOffer.storeAddress}</Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>🏠 Deliver To</Text>
            <Text style={{ color: colors.foreground }}>{jobOffer.customerAddress}</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Distance</Text>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>{jobOffer.distance} km</Text>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Items</Text>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>{jobOffer.items}</Text>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 13 }}>You Earn</Text>
              <Text style={{ color: colors.primary, fontWeight: "bold", fontSize: 18 }}>€{jobOffer.deliveryFee.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={handleAccept}
            disabled={isAccepting || timeLeft === 0}
            style={{
              backgroundColor: isAccepting || timeLeft === 0 ? colors.surface : colors.success,
              padding: 20,
              borderRadius: 12,
              alignItems: "center",
              opacity: isAccepting || timeLeft === 0 ? 0.5 : 1,
            }}
          >
            <Text style={{
              fontWeight: "bold",
              fontSize: 20,
              color: isAccepting || timeLeft === 0 ? colors.muted : "#FFFFFF",
            }}>
              {isAccepting ? "Accepting..." : "✓ Accept Job"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDecline}
            disabled={isAccepting || timeLeft === 0}
            style={{
              backgroundColor: colors.surface,
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>✕ Decline</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={{ marginTop: 24, backgroundColor: colors.primary + "15", padding: 16, borderRadius: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 13, textAlign: "center" }}>
            💡 If you decline or time expires, this job will be offered to the next available driver
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
