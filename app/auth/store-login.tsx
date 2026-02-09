import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

      // Store user data
      await AsyncStorage.setItem("user", JSON.stringify(result.user));
      if (result.profile) {
        await AsyncStorage.setItem("profile", JSON.stringify(result.profile));
      }

      Alert.alert("Success", "Logged in successfully!");
      router.replace("/store");
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
            <Text className="text-primary text-5xl font-bold mb-2">🏪 STORE</Text>
            <Text className="text-muted text-lg">Staff Login</Text>
          </View>

          {/* Login Form */}
          <View className="gap-4">
            <View>
              <Text className="text-foreground font-semibold mb-2">Email</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="staff@store.com"
                placeholderTextColor="#9BA1A6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
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
