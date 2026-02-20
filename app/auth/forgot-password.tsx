import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();

  const handleResetPassword = async () => {
    setError("");
    setSuccess(false);

    if (!email || !newPassword) {
      setError("Please enter your email and new password");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await resetPasswordMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        newPassword,
      });

      setSuccess(true);

      // Navigate to login after 2 seconds
      setTimeout(() => {
        router.replace("/auth/login" as any);
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Could not reset password");
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
            <Text className="text-primary text-5xl font-bold mb-2">WESHOP4U</Text>
            <Text className="text-muted text-lg">Reset Your Password</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Success Message */}
          {success ? (
            <View className="bg-success/10 border border-success rounded-lg p-4 mb-4">
              <Text className="text-success font-semibold">Password reset successfully! Redirecting to login...</Text>
            </View>
          ) : null}

          {/* Reset Form */}
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
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">New Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="At least 6 characters"
                placeholderTextColor="#9BA1A6"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Confirm New Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Re-enter new password"
                placeholderTextColor="#9BA1A6"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
            >
              <Text className="text-background font-bold text-lg">
                {loading ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>

            {/* Back to Login Link */}
            <View className="flex-row justify-center items-center mt-4">
              <Text className="text-muted">Remember your password? </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="active:opacity-70"
              >
                <Text className="text-primary font-semibold">Login</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Note */}
          <View className="mt-6 bg-surface border border-border rounded-lg p-4">
            <Text className="text-muted text-sm">
              <Text className="font-semibold">Note:</Text> This is a simplified password reset. In production, you would receive a secure reset link via email.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
