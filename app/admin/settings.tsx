"use client";

import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTestMode } from "@/hooks/use-test-mode";
import { cn } from "@/lib/utils";

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { testingModeEnabled, toggleTestingMode, isToggling } = useTestMode();

  const handleToggleTestMode = () => {
    toggleTestingMode(!testingModeEnabled);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6 p-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin Settings</Text>
            <Text className="text-base text-muted">Manage application settings and features</Text>
          </View>

          {/* Testing Mode Section */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">🧪</Text>
                <Text className="text-lg font-semibold text-foreground">Testing Mode</Text>
              </View>
              <Text className="text-sm text-muted">
                When enabled, all orders will be charged €0.01 instead of the full amount. Perfect for testing the complete order workflow.
              </Text>
            </View>

            {/* Status Display */}
            <View className="gap-3 mt-2">
              <View className="flex-row items-center gap-2">
                <View
                  className={cn(
                    "w-3 h-3 rounded-full",
                    testingModeEnabled ? "bg-yellow-500" : "bg-green-500"
                  )}
                />
                <Text className="text-base font-semibold text-foreground">
                  Status: {testingModeEnabled ? "🟡 ACTIVE" : "🟢 OFF"}
                </Text>
              </View>

              {/* Toggle Button */}
              <Pressable
                onPress={handleToggleTestMode}
                disabled={isToggling}
                className={cn(
                  "px-4 py-3 rounded-lg active:opacity-80",
                  testingModeEnabled ? "bg-yellow-500" : "bg-primary"
                )}
              >
                <Text
                  className={cn(
                    "font-bold text-center text-base",
                    testingModeEnabled ? "text-yellow-900" : "text-foreground"
                  )}
                >
                  {isToggling
                    ? "Updating..."
                    : testingModeEnabled
                      ? "Turn Off Testing Mode"
                      : "Turn On Testing Mode"}
                </Text>
              </Pressable>

              {/* Info Box */}
              {testingModeEnabled && (
                <View className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 gap-2">
                  <Text className="text-sm font-semibold text-yellow-900">
                    ⚠️ Testing Mode Active
                  </Text>
                  <Text className="text-sm text-yellow-800">
                    • Orders will be charged €0.01 only{"\n"}• Drivers will receive notifications{"\n"}• Full workflow is tested{"\n"}• Easy to refund test charges
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Other Settings Section */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <Text className="text-lg font-semibold text-foreground">Other Settings</Text>
            <Text className="text-sm text-muted">More settings coming soon...</Text>
          </View>

          {/* Dashboard Button */}
          <Pressable
            onPress={() => router.push("/admin")}
            className="px-4 py-3 rounded-lg bg-primary active:opacity-80"
          >
            <Text className="font-bold text-center text-base text-foreground">
              ← Back to Dashboard
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
