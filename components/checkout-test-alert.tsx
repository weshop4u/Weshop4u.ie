import { View, Text, Pressable } from "react-native";
import { cn } from "@/lib/utils";

interface CheckoutTestAlertProps {
  visible: boolean;
  onUnderstand: () => void;
  className?: string;
}

/**
 * Checkout Test Alert - Shows before payment in test mode
 * Informs customer that only €0.01 will be charged
 */
export function CheckoutTestAlert({ visible, onUnderstand, className }: CheckoutTestAlertProps) {
  if (!visible) return null;

  return (
    <View className={cn(
      "bg-orange-50 border border-orange-300 rounded-lg p-4 gap-3",
      className
    )}>
      <View className="gap-2">
        <Text className="text-base font-bold text-orange-900">
          ⚠️ Testing Mode Active
        </Text>
        <Text className="text-sm text-orange-800">
          Your card will be charged <Text className="font-bold">€0.01</Text> for this test order. This is a minimal charge to verify your payment method works.
        </Text>
      </View>
      
      <Pressable
        onPress={onUnderstand}
        className="bg-orange-600 px-4 py-2 rounded-lg active:opacity-80"
      >
        <Text className="text-white font-semibold text-center">
          I Understand, Continue
        </Text>
      </Pressable>
    </View>
  );
}
