import { ScrollView, Text, View, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale
  });
  const utils = trpc.useUtils();
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
    console.log("[Logout] Starting logout process...");
    try {
      // Call REST API logout endpoint directly to ensure cookie is cleared
      const { getApiBaseUrl } = require("@/constants/oauth");
      const apiBaseUrl = getApiBaseUrl();
      const apiUrl = `${apiBaseUrl}/api/auth/logout`;
      
      console.log("[Logout] Calling API:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "include", // Important: send cookies
      });
      console.log("[Logout] API response:", response.status);
      
      // Clear ALL local storage data
      console.log("[Logout] Clearing AsyncStorage...");
      await AsyncStorage.multiRemove(["authToken", "userRole", "userId", "appMode", "user", "profile"]);
      
      // Client-side cookie deletion as backup (for web)
      if (Platform.OS === "web" && typeof document !== "undefined") {
        console.log("[Logout] Deleting cookies client-side...");
        // Delete app_session_id cookie on all possible domains
        const domains = [
          "", // current domain
          window.location.hostname,
          "." + window.location.hostname.split(".").slice(-2).join("."), // parent domain
        ];
        
        domains.forEach(domain => {
          const domainStr = domain ? `; domain=${domain}` : "";
          document.cookie = `app_session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainStr}; SameSite=None; Secure`;
          console.log("[Logout] Deleted cookie for domain:", domain || "(current)");
        });
        
        // Check if cookies are actually deleted
        console.log("[Logout] Remaining cookies:", document.cookie);
      }
      
      // Clear tRPC query cache to remove user data
      console.log("[Logout] Invalidating tRPC cache...");
      utils.invalidate();
      
      // Force page reload on web to clear all cached state
      if (Platform.OS === "web") {
        console.log("[Logout] Reloading page...");
        // Use location.href to force full page reload and clear everything
        window.location.href = "/";
      } else {
        console.log("[Logout] Navigating to home (native)...");
        // On native, just navigate
        router.replace("/" as any);
      }
    } catch (error) {
      console.error("[Logout] Failed to log out:", error);
      // Even if logout fails, clear local data and reload
      await AsyncStorage.multiRemove(["authToken", "userRole", "userId", "appMode", "user", "profile"]);
      if (Platform.OS === "web") {
        window.location.href = "/";
      } else {
        router.replace("/" as any);
      }
    }
  };

  // Show login required screen if user is not logged in
  if (!user) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6 px-6">
          {/* Logo/Icon */}
          <View className="w-32 h-32 bg-primary rounded-full items-center justify-center mb-4">
            <Text className="text-6xl">🛒</Text>
          </View>
          
          {/* Heading */}
          <Text className="text-3xl font-bold text-foreground text-center">
            Log In to Continue
          </Text>
          
          {/* Description */}
          <Text className="text-base text-muted text-center max-w-sm">
            Create an account or log in to track orders, save addresses, and enjoy faster checkout
          </Text>
          
          {/* Benefits */}
          <View className="gap-3 w-full max-w-sm mt-4">
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">📦</Text>
              <Text className="text-foreground">Track your orders in real-time</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">📍</Text>
              <Text className="text-foreground">Save delivery addresses</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">⚡</Text>
              <Text className="text-foreground">Faster checkout experience</Text>
            </View>
          </View>
          
          {/* Buttons */}
          <View className="gap-3 w-full max-w-sm mt-6">
            <TouchableOpacity
              onPress={() => router.push("/auth/login" as any)}
              className="bg-primary py-4 rounded-xl items-center active:opacity-70"
            >
              <Text className="text-background font-bold text-lg">Log In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push("/auth/register" as any)}
              className="bg-surface border border-border py-4 rounded-xl items-center active:opacity-70"
            >
              <Text className="text-foreground font-semibold text-lg">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    );
  }

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
