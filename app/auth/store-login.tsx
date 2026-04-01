import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export default function StoreLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate credentials via tRPC
      const result = await loginMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        password,
      });

      // Verify user is store staff
      if (result.user.role !== "store_staff") {
        Alert.alert("Access Denied", "This login is for store staff only. Please use the customer or driver login.");
        setLoading(false);
        return;
      }

      // Step 2: Store user data in AsyncStorage
      await AsyncStorage.setItem("user", JSON.stringify(result.user));
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
        
        // Step 4: Store session token in SecureStore for native persistence
        if (Platform.OS !== "web" && sessionData.sessionToken) {
          await Auth.setSessionToken(sessionData.sessionToken);
          console.log("[StoreLogin] Session token stored in SecureStore");
        }

        // Step 5: Cache user info for quick session restore
        await Auth.setUserInfo({
          id: result.user.id,
          openId: "",
          name: result.user.name,
          email: result.user.email,
          loginMethod: "password",
          lastSignedIn: new Date(),
        });
      }

      // Step 6: Navigate to store dashboard
      if (Platform.OS === "web") {
        const base = window.location.pathname.startsWith("/api/web") ? "/api/web" : "";
        window.location.href = `${base}/store`;
      } else {
        Alert.alert("Success", "Logged in successfully!");
        router.replace("/store");
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Invalid email or password");
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
              style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }}
              resizeMode="cover"
            />
            <Text className="text-primary text-5xl font-bold mb-2">STORE</Text>
            <Text className="text-muted text-lg">Staff Login</Text>
          </View>

          {/* Login Form */}
          <View className="gap-4">
            <View>
              <Text className="text-foreground font-semibold mb-2">Email</Text>
              <TextInput
                style={{ backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 16, color: '#11181C', fontSize: 16 }}
                placeholder="staff@store.com"
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
                style={{ backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 16, color: '#11181C', fontSize: 16 }}
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
                {loading ? "Logging in..." : "Login to Store Dashboard"}
              </Text>
            </TouchableOpacity>

            {/* Back Link */}
            <View className="flex-row justify-center items-center mt-4">
              <Text className="text-muted">Not a store staff member? </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="active:opacity-70"
              >
                <Text className="text-primary font-semibold">Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Box */}
          <View className="bg-muted/10 p-4 rounded-lg mt-8">
            <Text className="text-muted text-sm text-center">
              Store staff accounts are created by administrators. Contact your store manager if you need access.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
