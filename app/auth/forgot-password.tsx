import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { WebLayout } from "@/components/web-layout";

type Step = "phone" | "otp" | "newPassword" | "success";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // Form fields
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP fields
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  // Flow state
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mutations
  const sendOtpMutation = trpc.otp.sendCode.useMutation();
  const verifyOtpMutation = trpc.otp.verifyCode.useMutation();
  const resetPasswordMutation = trpc.auth.resetPasswordByPhone.useMutation();

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Send OTP to phone
  const handleSendOTP = async () => {
    setError("");
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.trim().replace(/[\s\-]/g, "").length < 7) { setError("Please enter a valid phone number"); return; }

    setLoading(true);
    try {
      await sendOtpMutation.mutateAsync({ phoneNumber: phone.trim() });
      setStep("otp");
      setResendTimer(60);
      setOtpCode(["", "", "", "", "", ""]);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "");
    if (digit.length > 1) {
      // Handle paste
      const digits = digit.slice(0, 6).split("");
      const newCode = [...otpCode];
      digits.forEach((d, i) => {
        if (i + index < 6) newCode[i + index] = d;
      });
      setOtpCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otpCode[index] && index > 0) {
      const newCode = [...otpCode];
      newCode[index - 1] = "";
      setOtpCode(newCode);
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setError("");
    const code = otpCode.join("");
    if (code.length !== 6) { setError("Please enter the full 6-digit code"); return; }

    setLoading(true);
    try {
      await verifyOtpMutation.mutateAsync({
        phoneNumber: phone.trim(),
        code,
      });
      // OTP verified — move to new password step
      setStep("newPassword");
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async () => {
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      await resetPasswordMutation.mutateAsync({
        phone: phone.trim(),
        newPassword,
      });
      setStep("success");
      setTimeout(() => {
        router.replace("/auth/login" as any);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError("");
    setLoading(true);
    try {
      await sendOtpMutation.mutateAsync({ phoneNumber: phone.trim() });
      setResendTimer(60);
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    phone: "Reset Your Password",
    otp: "Verify Your Phone",
    newPassword: "Set New Password",
    success: "Password Reset!",
  };

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <Wrapper>
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-6" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 40 }}>
          {/* Header */}
          <View className="items-center mb-8">
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }}
              resizeMode="cover"
            />
            <Text className="text-primary text-5xl font-bold mb-2">WESHOP4U</Text>
            <Text className="text-muted text-lg">{stepTitle[step]}</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Step 1: Enter Phone Number */}
          {step === "phone" && (
            <View className="gap-4">
              <View>
                <Text className="text-foreground font-semibold mb-2">Phone Number</Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg p-4 text-foreground"
                  placeholder="087 123 4567"
                  placeholderTextColor="#9BA1A6"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSendOTP}
                />
                <Text className="text-muted text-xs mt-1">Enter the phone number linked to your account</Text>
              </View>

              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={loading}
                className={`bg-primary p-4 rounded-lg items-center mt-2 ${loading ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Send Verification Code</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center items-center mt-4">
                <Text className="text-muted">Remember your password? </Text>
                <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
                  <Text className="text-primary font-semibold">Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Enter OTP Code */}
          {step === "otp" && (
            <View className="gap-6">
              <View className="items-center">
                <Text className="text-foreground text-base text-center">
                  We've sent a 6-digit code to
                </Text>
                <Text className="text-primary font-bold text-lg mt-1">{phone}</Text>
              </View>

              {/* OTP Input Boxes */}
              <View className="flex-row justify-center gap-3">
                {otpCode.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { otpRefs.current[index] = ref; }}
                    className="bg-surface border-2 border-border rounded-xl text-foreground text-center font-bold"
                    style={{ width: 48, height: 56, fontSize: 24, lineHeight: 28 }}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleVerifyOTP}
                disabled={loading || otpCode.join("").length !== 6}
                className={`bg-primary p-4 rounded-lg items-center ${loading || otpCode.join("").length !== 6 ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Verify Code</Text>
                )}
              </TouchableOpacity>

              <View className="items-center gap-3">
                <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                  <Text className={resendTimer > 0 ? "text-muted" : "text-primary font-semibold"}>
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStep("phone"); setError(""); }}>
                  <Text className="text-muted">Change phone number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Set New Password */}
          {step === "newPassword" && (
            <View className="gap-4">
              <View className="items-center mb-2">
                <View className="bg-success/10 rounded-full p-3 mb-2">
                  <Text style={{ fontSize: 28 }}>✓</Text>
                </View>
                <Text className="text-success font-semibold">Phone verified!</Text>
                <Text className="text-muted text-sm mt-1">Now set your new password</Text>
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
                  autoFocus
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
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                />
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={loading}
                className={`bg-primary p-4 rounded-lg items-center mt-2 ${loading ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <View className="items-center gap-4">
              <View className="bg-success/10 border border-success rounded-2xl p-6 items-center">
                <Text style={{ fontSize: 48 }}>✓</Text>
                <Text className="text-success font-bold text-xl mt-2">Password Reset!</Text>
                <Text className="text-success text-center mt-1">
                  Your password has been changed successfully.
                </Text>
                <Text className="text-muted text-center mt-2">Redirecting to login...</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
    </Wrapper>
  );
}
