import { View, Text, Pressable, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useTestMode } from "@/hooks/use-test-mode";
import { cn } from "@/lib/utils";

export default function AdminSettingsScreen() {
  const { testingModeEnabled, toggleTestingMode, isToggling } = useTestMode();

  const handleToggleTestMode = () => {
    toggleTestingMode(!testingModeEnabled);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin Settings</Text>
            <Text className="text-base text-muted">Manage application settings and features</Text>
          </View>

          {/* Testing Mode Section */}
          <View className="bg-surface rounded-lg p-4 gap-4 border border-border">
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">🧪 Testing Mode</Text>
              <Text className="text-sm text-muted">
                When enabled, all orders will be charged €0.01 instead of the full amount. Perfect for testing the complete order workflow.
              </Text>
            </View>

            {/* Status Display */}
            <View className="flex-row items-center justify-between py-3 px-3 bg-background rounded-lg">
              <Text className="text-base font-medium text-foreground">
                Status: <Text className={cn(
                  "font-bold",
                  testingModeEnabled ? "text-yellow-600" : "text-green-600"
                )}>
                  {testingModeEnabled ? "🟡 ACTIVE" : "🟢 OFF"}
                </Text>
              </Text>
            </View>

            {/* Toggle Button */}
            <Pressable
              onPress={handleToggleTestMode}
              disabled={isToggling}
              className={cn(
                "px-4 py-3 rounded-lg active:opacity-80",
                testingModeEnabled
                  ? "bg-yellow-500"
                  : "bg-primary"
              )}
            >
              <Text className="text-white font-semibold text-center">
                {isToggling ? "Updating..." : testingModeEnabled ? "Turn Off Testing Mode" : "Turn On Testing Mode"}
              </Text>
            </Pressable>

            {/* Info Box */}
            {testingModeEnabled && (
              <View className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 gap-2">
                <Text className="text-sm font-semibold text-yellow-900">
                  ⚠️ Testing Mode Active
                </Text>
                <Text className="text-xs text-yellow-800">
                  • Customers will see a test mode banner on all screens{"\n"}
                  • Orders will be charged €0.01{"\n"}
                  • Full order workflow will execute normally{"\n"}
                  • Drivers will receive notifications
                </Text>
              </View>
            )}
          </View>

          {/* Additional Settings */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <Text className="text-lg font-semibold text-foreground">Other Settings</Text>
            <Text className="text-sm text-muted">More settings coming soon...</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
