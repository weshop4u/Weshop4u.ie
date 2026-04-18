import { View, Text, ScrollView, TouchableOpacity, Platform, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import { ScreenWrapper } from "@/components/native-wrapper";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout: authLogout } = useAuth();
  const utils = trpc.useUtils();
  const [currentMode, setCurrentMode] = useState<"customer" | "driver">("customer");
  
  // Fetch fresh profile data from server to ensure we have latest profilePicture
  const { data: profileData } = trpc.users.getProfile.useQuery();

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
      // 1. Call the useAuth logout which clears API session + SecureStore + sets user to null
      await authLogout();
      console.log("[Logout] Auth logout completed");

      // 2. Clear ALL local storage data (appMode, etc.)
      console.log("[Logout] Clearing AsyncStorage...");
      await AsyncStorage.multiRemove(["authToken", "userRole", "userId", "appMode", "user", "profile"]);

      // Clear localStorage on web (session token)
      if (Platform.OS === "web") {
        try {
          window.localStorage.clear();
        } catch (e) {}
      }

      // 3. Client-side cookie deletion as backup (for web)
      if (Platform.OS === "web" && typeof document !== "undefined") {
        console.log("[Logout] Deleting cookies client-side...");
        const domains = [
          "", // current domain
          window.location.hostname,
          "." + window.location.hostname.split(".").slice(-2).join("."), // parent domain
        ];
        
        domains.forEach(domain => {
          const domainStr = domain ? `; domain=${domain}` : "";
          document.cookie = `app_session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainStr}; SameSite=None; Secure`;
        });
      }

      // 4. Clear tRPC query cache to remove all user data
      console.log("[Logout] Clearing tRPC cache...");
      utils.invalidate();
      // Also reset the query client to clear stale data completely
      utils.auth.me.reset();

      // 5. Navigate
      if (Platform.OS === "web") {
        console.log("[Logout] Reloading page...");
        // Redirect to /api/web/ since the deployment platform only serves the web app there
        const baseUrl = window.location.pathname.startsWith("/api/web") ? "/api/web/" : "/";
        window.location.href = baseUrl;
      } else {
        console.log("[Logout] Navigating to home (native)...");
        // On native, navigate to home - useAuth state is already cleared
        router.replace("/(tabs)" as any);
      }
    } catch (error) {
      console.error("[Logout] Failed to log out:", error);
      // Even if logout fails, force clear everything
      try {
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
      } catch (e) {
        // ignore
      }
      await AsyncStorage.multiRemove(["authToken", "userRole", "userId", "appMode", "user", "profile"]);
      utils.auth.me.reset();
      if (Platform.OS === "web") {
        // Redirect to /api/web/ since the deployment platform only serves the web app there
        const baseUrl = window.location.pathname.startsWith("/api/web") ? "/api/web/" : "/";
        window.location.href = baseUrl;
      } else {
        router.replace("/(tabs)" as any);
      }
    }
  };

  // Show login required screen if user is not logged in


  if (!user) {
    return (
      <ScreenWrapper>
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center gap-6 px-6">
          {/* Logo */}
          <View className="w-36 h-36 rounded-full items-center justify-center mb-4 overflow-hidden">
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 144, height: 144, borderRadius: 72 }}
              resizeMode="cover"
            />
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
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
    <ScreenContainer className="p-6">
      <ScrollView>
        <View className="gap-6">
          {/* Header */}
          <View className="items-center mb-4">
            {profileData?.profilePicture ? (
              <Image
                source={{ uri: profileData.profilePicture }}
                style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12 }}
              />
            ) : (
              <View className="w-24 h-24 bg-primary rounded-full items-center justify-center mb-3">
                <Text className="text-background text-4xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
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
          {user && (user as any).role === "admin" && (
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
          {user && (user as any).role === "driver" && (
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

          {/* Store Dashboard Section - Only visible to store staff */}
          {user && (user as any).role === "store_staff" && (
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <TouchableOpacity 
                className="p-4 active:opacity-70"
                onPress={() => router.push("/store" as any)}
              >
                <Text className="text-foreground font-semibold">🏪 Store Dashboard</Text>
                <Text className="text-muted text-sm mt-1">Manage your store orders</Text>
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
    </ScreenWrapper>
  );
}
