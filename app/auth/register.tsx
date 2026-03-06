import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { WebLayout } from "@/components/web-layout";
import { useColors } from "@/hooks/use-colors";
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-strength";

type Step = "details" | "otp" | "success";

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordStrength = calculatePasswordStrength(password);

  // OTP fields
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  // Flow state
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mutations
  const registerMutation = trpc.auth.registerCustomer.useMutation();
  const sendOtpMutation = trpc.otp.sendCode.useMutation();
  const verifyOtpMutation = trpc.otp.verifyCode.useMutation();

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Validate details and send OTP
  const handleSendOTP = async () => {
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.trim().replace(/[\s\-]/g, "").length < 7) { setError("Please enter a valid phone number"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

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
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, "");
    if (digit.length > 1) {
      // Handle paste — fill all boxes
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

    // Auto-advance to next box
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace on empty OTP box
  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otpCode[index] && index > 0) {
      const newCode = [...otpCode];
      newCode[index - 1] = "";
      setOtpCode(newCode);
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP and create account
  const handleVerifyAndRegister = async () => {
    setError("");
    const code = otpCode.join("");
    if (code.length !== 6) { setError("Please enter the full 6-digit code"); return; }

    setLoading(true);
    try {
      // Verify the OTP first
      await verifyOtpMutation.mutateAsync({
        phoneNumber: phone.trim(),
        code,
      });

      // OTP verified — now create the account
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password,
      });

      setStep("success");
      // Navigate to login after 2 seconds
      setTimeout(() => {
        router.replace("/auth/login" as any);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Verification failed");
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

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <Wrapper>
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View className="items-center mb-6 mt-8">
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }}
              resizeMode="cover"
            />
            <Text className="text-primary text-5xl font-bold mb-2">WESHOP4U</Text>
            <Text className="text-muted text-lg">
              {step === "details" ? "Create Your Account" : step === "otp" ? "Verify Your Phone" : "Account Created!"}
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Step 1: Registration Details */}
          {step === "details" && (
            <View className="gap-4">
              <View>
                <Text className="text-foreground font-semibold mb-2">Full Name *</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                  placeholder="John Doe"
                  placeholderTextColor="#9BA1A6"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text className="text-foreground font-semibold mb-2">Email *</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
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
                <Text className="text-foreground font-semibold mb-2">Phone Number *</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                  placeholder="087 123 4567"
                  placeholderTextColor="#9BA1A6"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <Text className="text-muted text-xs mt-1">We'll send a verification code to this number</Text>
              </View>

              <View>
                <Text className="text-foreground font-semibold mb-2">Password *</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#9BA1A6"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {password && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
                      {[1, 2, 3, 4].map((index) => (
                        <View
                          key={index}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor:
                              index <= passwordStrength.score
                                ? getPasswordStrengthColor(passwordStrength.strength)
                                : colors.border,
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: getPasswordStrengthColor(passwordStrength.strength),
                        }}
                      >
                        {getPasswordStrengthLabel(passwordStrength.strength)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.muted,
                        }}
                      >
                        {passwordStrength.feedback}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-foreground font-semibold mb-2">Confirm Password *</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                  placeholder="Re-enter password"
                  placeholderTextColor="#9BA1A6"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOTP}
                />
              </View>

              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={loading}
                className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Verify Phone & Create Account</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center items-center mt-4">
                <Text className="text-muted">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
                  <Text className="text-primary font-semibold">Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: OTP Verification */}
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
                    style={{ width: 48, height: 56, fontSize: 24, lineHeight: 28, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, color: '#11181C', textAlign: 'center', fontWeight: 'bold' }}
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

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerifyAndRegister}
                disabled={loading || otpCode.join("").length !== 6}
                className={`bg-primary p-4 rounded-lg items-center ${loading || otpCode.join("").length !== 6 ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Verify & Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Resend / Change Number */}
              <View className="items-center gap-3">
                <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                  <Text className={resendTimer > 0 ? "text-muted" : "text-primary font-semibold"}>
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStep("details"); setError(""); }}>
                  <Text className="text-muted">Change phone number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Success */}
          {step === "success" && (
            <View className="items-center gap-4 mt-8">
              <View className="bg-success/10 border border-success rounded-2xl p-6 items-center">
                <Text style={{ fontSize: 48 }}>✓</Text>
                <Text className="text-success font-bold text-xl mt-2">Phone Verified!</Text>
                <Text className="text-success text-center mt-1">
                  Your account has been created successfully.
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
