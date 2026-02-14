import { View, Text, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function JobOfferScreen() {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(15);
  const [isAccepting, setIsAccepting] = useState(false);

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
    // Countdown timer
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Time expired - auto decline
      handleDecline(true);
    }
  }, [timeLeft]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      // TODO: Call backend API to accept job
      Alert.alert(
        "Job Accepted!",
        "Navigate to the store to pick up the order.",
        [
          {
            text: "Start Navigation",
            onPress: () => router.push(`/driver/active-delivery?orderId=${jobOffer.orderId}`),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to accept job. Please try again.");
      setIsAccepting(false);
    }
  };

  const handleDecline = (autoDecline = false) => {
    // TODO: Call backend API to decline job (will be offered to next driver)
    if (!autoDecline) {
      Alert.alert(
        "Job Declined",
        "The job will be offered to another driver.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      Alert.alert(
        "Time Expired",
        "The job has been offered to another driver.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const getTimerColor = () => {
    if (timeLeft > 10) return "text-success";
    if (timeLeft > 5) return "text-warning";
    return "text-error";
  };

  const getTimerBgColor = () => {
    if (timeLeft > 10) return "bg-success/10 border-success";
    if (timeLeft > 5) return "bg-warning/10 border-warning";
    return "bg-error/10 border-error";
  };

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Timer */}
        <View className={`p-6 rounded-lg border-2 mb-6 ${getTimerBgColor()}`}>
          <Text className="text-center text-muted mb-2">Time to Accept</Text>
          <Text className={`text-center font-bold text-6xl ${getTimerColor()}`}>
            {timeLeft}
          </Text>
          <Text className="text-center text-muted mt-2">seconds remaining</Text>
        </View>

        {/* Job Details */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-xl mb-4">New Delivery Request</Text>
          
          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">Order Number</Text>
            <Text className="text-foreground font-semibold text-lg">{jobOffer.orderNumber}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">📍 Pick Up From</Text>
            <Text className="text-foreground font-semibold">{jobOffer.storeName}</Text>
            <Text className="text-muted text-sm">{jobOffer.storeAddress}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-1">🏠 Deliver To</Text>
            <Text className="text-foreground">{jobOffer.customerAddress}</Text>
          </View>

          <View className="flex-row justify-between pt-4 border-t border-border">
            <View>
              <Text className="text-muted text-sm">Distance</Text>
              <Text className="text-foreground font-semibold">{jobOffer.distance} km</Text>
            </View>
            <View>
              <Text className="text-muted text-sm">Items</Text>
              <Text className="text-foreground font-semibold">{jobOffer.items}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm">You Earn</Text>
              <Text className="text-primary font-bold text-lg">€{jobOffer.deliveryFee.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            onPress={handleAccept}
            disabled={isAccepting || timeLeft === 0}
            className={`p-5 rounded-lg items-center ${
              isAccepting || timeLeft === 0 ? "bg-surface" : "bg-success active:opacity-70"
            }`}
          >
            <Text className={`font-bold text-xl ${
              isAccepting || timeLeft === 0 ? "text-muted" : "text-background"
            }`}>
              {isAccepting ? "Accepting..." : "✓ Accept Job"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDecline(false)}
            disabled={isAccepting || timeLeft === 0}
            className="bg-surface p-4 rounded-lg items-center active:opacity-70 border border-border"
          >
            <Text className="text-foreground font-semibold">✕ Decline</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View className="mt-6 bg-primary/10 p-4 rounded-lg">
          <Text className="text-primary text-sm text-center">
            💡 If you decline or time expires, this job will be offered to the next available driver
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
