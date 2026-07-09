import { View, Text, ScrollView, TouchableOpacity, Platform, Alert, Image, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import * as Auth from "@/lib/_core/auth";
import { ScreenWrapper } from "@/components/native-wrapper";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout: authLogout } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();
  const [currentMode, setCurrentMode] = useState<"customer" | "driver">("customer");
  
  // Age verification state
  const [showAgeUpdateModal, setShowAgeUpdateModal] = useState(false);
  const [ageVerificationDOB, setAgeVerificationDOB] = useState("");
  const [ageVerificationError, setAgeVerificationError] = useState("");
  const [updateDOB, setUpdateDOB] = useState("");
  const [updateDOBError, setUpdateDOBError] = useState("");
  
  // Fetch fresh profile data from server to ensure we have latest profilePicture
  const { data: profileData } = trpc.users.getProfile.useQuery();
  const updateProfileMutation = trpc.users.updateProfile.useMutation();
  const toggleOnlineMutation = trpc.drivers.toggleOnlineStatus.useMutation();

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

  // Format DOB input to DD-MM-YYYY format
  const formatDOBInput = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
  };

  // Format YYYY-MM-DD to DD-MM-YYYY for display
  const formatDOBForDisplay = (isoDate: string | Date) => {
    if (!isoDate) return "";
    const dateStr = typeof isoDate === "string" ? isoDate : isoDate.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  // Validate DOB and check if user is 18+
  const validateAndCheckAge = (dobString: string) => {
    if (!dobString || dobString.length !== 10) {
      return { valid: false, message: "Please enter date in DD-MM-YYYY format" };
    }

    const [day, month, year] = dobString.split("-").map(Number);
    if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
      return { valid: false, message: "Invalid date of birth" };
    }

    const dob = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const hasHadBirthday =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

    const actualAge = hasHadBirthday ? age : age - 1;
    if (actualAge < 18) {
      return { valid: false, message: "You must be at least 18 years old" };
    }

    return { valid: true, message: "", day, month, year };
  };

  const handleVerifyAge = async () => {
    setAgeVerificationError("");
    const validation = validateAndCheckAge(ageVerificationDOB);

    if (!validation.valid) {
      setAgeVerificationError(validation.message);
      return;
    }

    try {
      const { day, month, year } = validation;
      const isoDateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      await updateProfileMutation.mutateAsync({
        name: profileData?.name || "",
        dateOfBirth: isoDateString,
        ageVerified: true,
      });
      setAgeVerificationDOB("");
      setShowAgeUpdateModal(false);
      // Invalidate profile query to refresh
      utils.users.getProfile.invalidate();
    } catch (error) {
      setAgeVerificationError("Failed to verify age. Please try again.");
      console.error(error);
    }
  };

  const handleUpdateDOB = async () => {
    setUpdateDOBError("");
    const validation = validateAndCheckAge(updateDOB);

    if (!validation.valid) {
      setUpdateDOBError(validation.message);
      return;
    }

    try {
      const { day, month, year } = validation;
      const isoDateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      await updateProfileMutation.mutateAsync({
        name: profileData?.name || "",
        dateOfBirth: isoDateString,
      });
      setUpdateDOB("");
      setShowAgeUpdateModal(false);
      // Invalidate profile query to refresh
      utils.users.getProfile.invalidate();
    } catch (error) {
      setUpdateDOBError("Failed to update date of birth. Please try again.");
      console.error(error);
    }
  };

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
      // 0. If this is a driver, take them offline on the server first — otherwise
      // they stay "phantom online" indefinitely after logging out, since nothing
      // else clears isOnline when the session ends.
      if (user && (user as any).role === "driver") {
        try {
          await toggleOnlineMutation.mutateAsync({ driverId: user.id, isOnline: false });
          console.log("[Logout] Driver set offline on server");
        } catch (e) {
          console.error("[Logout] Failed to set driver offline:", e);
          // Don't block logout if this fails
        }
      }

      // 1. Call the useAuth logout which clears API session + SecureStore + sets user to null
      await authLogout();

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

          {/* Age Verification Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <View className="p-4 border-b border-border">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-foreground font-semibold">Age Verification</Text>
                {profileData?.ageVerified ? (
                  <View className="bg-green-100 px-3 py-1 rounded-full">
                    <Text className="text-green-700 text-xs font-semibold">✓ Verified</Text>
                  </View>
                ) : (
                  <View className="bg-yellow-100 px-3 py-1 rounded-full">
                    <Text className="text-yellow-700 text-xs font-semibold">⚠ Not Verified</Text>
                  </View>
                )}
              </View>
              <Text className="text-muted text-sm">
                {profileData?.ageVerified
                  ? "Your age has been verified. You can purchase age-restricted items."
                  : "Verify your age to purchase age restricted products."}
              </Text>
            </View>
            
            <TouchableOpacity
              className="p-4 active:opacity-70"
              onPress={() => setShowAgeUpdateModal(true)}
            >
              <Text className="text-foreground font-semibold">
                {profileData?.ageVerified ? "Update Date of Birth" : "Verify Your Age"}
              </Text>
              {profileData?.dateOfBirth && (
                <Text className="text-muted text-sm mt-1">
                  Current DOB: {formatDOBForDisplay(profileData.dateOfBirth)}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Age Verification Modal */}
          {showAgeUpdateModal && (
            <View className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
              <View className="bg-background rounded-2xl p-6 w-11/12 max-w-sm">
                <Text className="text-foreground font-bold text-lg mb-4">
                  {profileData?.ageVerified ? "Update Date of Birth" : "Verify Your Age"}
                </Text>
                
                <Text className="text-muted text-sm mb-4">
                  Please enter your date of birth in DD-MM-YYYY format. You must be at least 18 years old.
                </Text>
                
                <TextInput
                  placeholder="DD-MM-YYYY"
                  value={profileData?.ageVerified ? updateDOB : ageVerificationDOB}
                  onChangeText={(text) => {
                    const formatted = formatDOBInput(text);
                    if (profileData?.ageVerified) {
                      setUpdateDOB(formatted);
                    } else {
                      setAgeVerificationDOB(formatted);
                    }
                  }}
                  maxLength={10}
                  keyboardType="numeric"
                  className="border border-border rounded-lg px-4 py-3 text-foreground mb-4"
                  placeholderTextColor={colors.muted}
                />
                
                {(profileData?.ageVerified ? updateDOBError : ageVerificationError) && (
                  <Text className="text-error text-sm mb-4">
                    {profileData?.ageVerified ? updateDOBError : ageVerificationError}
                  </Text>
                )}
                
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border rounded-lg py-3 active:opacity-70"
                    onPress={() => {
                      setShowAgeUpdateModal(false);
                      setAgeVerificationDOB("");
                      setUpdateDOB("");
                      setAgeVerificationError("");
                      setUpdateDOBError("");
                    }}
                  >
                    <Text className="text-foreground font-semibold text-center">Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    className="flex-1 bg-primary rounded-lg py-3 active:opacity-70"
                    onPress={profileData?.ageVerified ? handleUpdateDOB : handleVerifyAge}
                  >
                    <Text className="text-background font-semibold text-center">
                      {updateProfileMutation.isPending ? "Saving..." : "Confirm"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

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
