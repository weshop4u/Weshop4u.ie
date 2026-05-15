import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

/**
 * Available Jobs screen is disabled.
 * Orders are now force-offered to drivers one at a time (FIFO) via the offer system.
 * Drivers cannot browse or cherry-pick orders.
 */
export default function AvailableJobsScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect back to driver dashboard
    router.replace("/driver");
  }, []);

  return (
    <ScreenContainer className="items-center justify-center p-6">
      <Text className="text-foreground text-lg font-bold text-center mb-2">
        Orders are now offered automatically
      </Text>
      <Text className="text-muted text-center">
        Go online on the dashboard to receive delivery offers one at a time.
      </Text>
    </ScreenContainer>
  );
}
