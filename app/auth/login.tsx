import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation();

  const handleLogin = async () => {
    setError("");
    
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate credentials via tRPC
      const result = await loginMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        password,
      });

      // Step 2: Store user data in AsyncStorage for quick access
      await AsyncStorage.setItem("user", JSON.stringify(result.user));
      await AsyncStorage.setItem("userId", String(result.user.id));
      if (result.profile) {
        await AsyncStorage.setItem("profile", JSON.stringify(result.profile));
      }

      // Step 3: Create session via REST API (sets cookie for web, returns token for native)
      const apiUrl = getApiBaseUrl();
      const sessionResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: result.user.email }),
        credentials: "include",
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        console.log("[Login] Session response data:", {
          hasSessionToken: !!sessionData.sessionToken,
          hasUser: !!sessionData.user,
          platform: Platform.OS,
          sessionToken: sessionData.sessionToken ? `${sessionData.sessionToken.substring(0, 30)}...` : null,
        });
        
        // Step 4: Store session token in SecureStore for native persistence
        if (Platform.OS !== "web") {
          if (sessionData.sessionToken) {
            console.log("[Login] Storing session token on native...");
            await Auth.setSessionToken(sessionData.sessionToken);
            console.log("[Login] Session token stored in SecureStore successfully");
            
            // Verify it was stored
            const storedToken = await Auth.getSessionToken();
            console.log("[Login] Verification - token retrieved:", storedToken ? `${storedToken.substring(0, 30)}...` : "FAILED TO RETRIEVE");
          } else {
            console.error("[Login] ERROR: No sessionToken in response for native platform!");
          }
        }

        // Step 5: Cache user info for quick session restore
        await Auth.setUserInfo({
          id: result.user.id,
          openId: "",
          name: result.user.name,
          email: result.user.email,
          loginMethod: "password",
          lastSignedIn: new Date(),
          role: result.user.role || null,
        });
      }

      // Step 6: Refresh useAuth to sync user state across all components
      console.log("[Login] Refreshing auth state...");
      await refreshAuth();
      console.log("[Login] Auth state refreshed, navigating...");

      // Step 7: Navigate based on role
      if (Platform.OS === "web") {
        if (result.user.role === "driver") {
          window.location.href = "/driver";
        } else if (result.user.role === "store_staff") {
          window.location.href = "/store";
        } else {
          window.location.href = "/";
        }
      } else {
        if (result.user.role === "driver") {
          router.replace("/driver");
        } else if (result.user.role === "store_staff") {
          router.replace("/store");
        } else {
          router.replace("/");
        }
      }
    } catch (error: any) {
      setError(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 p-6 justify-center">
          {/* Header */}
          <View className="items-center mb-8">
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 12 }}
              resizeMode="cover"
            />
            <Text className="text-primary text-5xl font-bold mb-2">WESHOP4U</Text>
            <Text className="text-muted text-lg">Welcome Back!</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Login Form */}
          <View className="gap-4">
            <View>
              <Text className="text-foreground font-semibold mb-2">Email</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="your@email.com"
                placeholderTextColor="#9BA1A6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Enter your password"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
            >
              <Text className="text-background font-bold text-lg">
                {loading ? "Logging in..." : "Login"}
              </Text>
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <View className="flex-row justify-center items-center mt-3">
              <TouchableOpacity
                onPress={() => router.push("/auth/forgot-password" as any)}
                className="active:opacity-70"
              >
                <Text className="text-primary font-semibold">Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Register Link */}
            <View className="flex-row justify-center items-center mt-4">
              <Text className="text-muted">Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push("/auth/register" as any)}
                className="active:opacity-70"
              >
                <Text className="text-primary font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
