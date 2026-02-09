import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [currentMode, setCurrentMode] = useState<"customer" | "driver">("customer");

  useEffect(() => {
    // Load current mode from storage
    AsyncStorage.getItem("appMode").then((mode) => {
      if (mode === "driver") {
        setCurrentMode("driver");
      } else {
        // Explicitly set to customer if not driver
        setCurrentMode("customer");
      }
    });
  }, []);

  const handleSwitchToDriverMode = async () => {
    try {
      // Button only visible to drivers, so no role check needed
      await AsyncStorage.setItem("appMode", "driver");
      setCurrentMode("driver");
      router.push("/driver");
    } catch (error) {
      console.error("Failed to switch mode:", error);
    }
  };

  const handleLogout = async () => {
    try {
      // Call backend to clear session cookie
      await logoutMutation.mutateAsync();
      // Clear local storage including app mode
      await AsyncStorage.multiRemove(["authToken", "userRole", "userId", "appMode"]);
      // Clear tRPC query cache to remove user data
      utils.invalidate();
      // Navigate to home screen (not login, so guests can browse)
      router.replace("/" as any);
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <View className="gap-6">
          {/* Header */}
          <View className="items-center mb-4">
            <View className="w-24 h-24 bg-primary rounded-full items-center justify-center mb-3">
              <Text className="text-background text-4xl font-bold">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <Text className="text-foreground font-bold text-2xl">{user?.name || "User Profile"}</Text>
            <Text className="text-muted text-sm">{user?.email || "user@example.com"}</Text>
          </View>

          {/* Account Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity 
              className="p-4 border-b border-border active:opacity-70"
              onPress={() => router.push("/profile/edit" as any)}
            >
              <Text className="text-foreground font-semibold">Edit Profile</Text>
              <Text className="text-muted text-sm mt-1">Update your name, email, and phone</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-4 border-b border-border active:opacity-70"
              onPress={() => router.push("/profile/addresses" as any)}
            >
              <Text className="text-foreground font-semibold">Saved Addresses</Text>
              <Text className="text-muted text-sm mt-1">Manage your delivery addresses</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-4 active:opacity-70"
              onPress={() => router.push("/profile/payment-methods" as any)}
            >
              <Text className="text-foreground font-semibold">Payment Methods</Text>
              <Text className="text-muted text-sm mt-1">Manage your saved cards</Text>
            </TouchableOpacity>
          </View>

          {/* Admin Panel Section - Only visible to admin users */}
          {user && user.role === "admin" && (
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <TouchableOpacity 
                className="p-4 active:opacity-70"
                onPress={() => router.push("/admin" as any)}
              >
                <Text className="text-foreground font-semibold">⚙️ Admin Panel</Text>
                <Text className="text-muted text-sm mt-1">Manage drivers and system settings</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Driver Mode Section - Only visible to users with driver role */}
          {user && user.role === "driver" && (
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <TouchableOpacity 
                className="p-4 active:opacity-70"
                onPress={handleSwitchToDriverMode}
              >
                <Text className="text-foreground font-semibold">🚗 Switch to Driver Mode</Text>
                <Text className="text-muted text-sm mt-1">Start accepting delivery jobs</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Preferences Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity 
              className="p-4 active:opacity-70"
              onPress={() => router.push("/profile/notifications" as any)}
            >
              <Text className="text-foreground font-semibold">Notifications</Text>
              <Text className="text-muted text-sm mt-1">Manage notification preferences</Text>
            </TouchableOpacity>
          </View>

          {/* Support Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity 
              className="p-4 border-b border-border active:opacity-70"
              onPress={() => router.push("/profile/help" as any)}
            >
              <Text className="text-foreground font-semibold">Help & Support</Text>
              <Text className="text-muted text-sm mt-1">Get help with your orders</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-4 border-b border-border active:opacity-70"
              onPress={() => router.push("/profile/terms" as any)}
            >
              <Text className="text-foreground font-semibold">Terms & Conditions</Text>
              <Text className="text-muted text-sm mt-1">Read our terms of service</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="p-4 active:opacity-70"
              onPress={() => router.push("/profile/privacy" as any)}
            >
              <Text className="text-foreground font-semibold">Privacy Policy</Text>
              <Text className="text-muted text-sm mt-1">How we handle your data</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            className="bg-red-500 py-4 rounded-xl active:opacity-70 mt-4"
            onPress={handleLogout}
          >
            <Text className="text-white text-center font-semibold text-base">
              Log Out
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text className="text-muted text-center text-sm mt-4">
            WESHOP4U v1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
