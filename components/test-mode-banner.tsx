import { View, Text } from "react-native";
import { cn } from "@/lib/utils";

interface TestModeBannerProps {
  visible: boolean;
  className?: string;
}

/**
 * Test Mode Banner - Displays when testing mode is enabled
 * Shows on all screens to inform customers they're in test mode
 */
export function TestModeBanner({ visible, className }: TestModeBannerProps) {
  if (!visible) return null;

  return (
    <View className={cn(
      "bg-yellow-400 px-4 py-3 flex-row items-center justify-center gap-2",
      className
    )}>
      <Text className="text-lg">🧪</Text>
      <Text className="text-sm font-semibold text-yellow-900">
        TEST MODE - Orders charged €0.01
      </Text>
    </View>
  );
}
