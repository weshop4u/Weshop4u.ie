import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { ScreenWrapper } from "@/components/native-wrapper";
import { useColors } from "@/hooks/use-colors";
import { calculatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-strength";

type Step = "details" | "success";

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

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Age verification (optional)
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageError, setAgeError] = useState("");

  // Flow state
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mutations
  const registerMutation = trpc.auth.registerCustomer.useMutation();

  const handleRegister = async () => {
    setError("");
    setAgeError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (!phone.trim()) { setError("Please enter your phone number"); return; }
    if (phone.trim().replace(/[\s\-]/g, "").length < 7) { setError("Please enter a valid phone number"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least 1 uppercase letter"); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least 1 number"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    if (dateOfBirth.trim()) {
      const parts = dateOfBirth.trim().split("-");
      if (parts.length !== 3) { setAgeError("Please enter date in DD-MM-YYYY format"); return; }
      const [day, month, year] = parts.map(p => parseInt(p, 10));
      if (isNaN(day) || isNaN(month) || isNaN(year)) { setAgeError("Please enter a valid date"); return; }
      const dob = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) { age--; }
      if (age < 18) { setAgeError("You must be 18 or over to verify your age"); return; }
    }

    setLoading(true);
    try {
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password,
        dateOfBirth: dateOfBirth.trim() || null,
        ageVerified: dateOfBirth.trim() ? true : false,
      });
      setStep("success");
      setTimeout(() => {
        router.replace("/auth/login" as any);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
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
              {step === "details" ? "Create Your Account" : "Account Created!"}
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
                <Text className="text-muted text-xs mt-1">Used for delivery updates</Text>
              </View>

              <View>
                <Text className="text-foreground font-semibold mb-2">Password *</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      paddingRight: 48,
                      color: colors.foreground,
                      fontSize: 16,
                    }}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#9BA1A6"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: 14, padding: 8 }}
                  >
                    <Text style={{ fontSize: 18 }}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                  </TouchableOpacity>
                </View>
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
                      <Text style={{ fontSize: 13, fontWeight: "600", color: getPasswordStrengthColor(passwordStrength.strength) }}>
                        {getPasswordStrengthLabel(passwordStrength.strength)}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        {passwordStrength.feedback}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
                  Min 8 characters, 1 uppercase letter and 1 number
                </Text>
              </View>

              <View>
                <Text className="text-foreground font-semibold mb-2">Confirm Password *</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      paddingRight: 48,
                      color: colors.foreground,
                      fontSize: 16,
                    }}
                    placeholder="Re-enter password"
                    placeholderTextColor="#9BA1A6"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: "absolute", right: 12, top: 14, padding: 8 }}
                  >
                    <Text style={{ fontSize: 18 }}>{showConfirmPassword ? "👁️" : "👁️‍🗨️"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Optional Age Verification Section */}
              <View className="bg-surface border border-border rounded-lg p-4 mt-2">
                <Text className="text-foreground font-semibold mb-3">
                  🔞 Planning to order age restricted products?
                </Text>
                <Text className="text-muted text-sm mb-4">
                  Verify your age now — it only takes a second
                </Text>

                {!showAgeVerification ? (
                  <TouchableOpacity
                    onPress={() => setShowAgeVerification(true)}
                    className="bg-primary/10 border border-primary rounded-lg p-3 items-center"
                  >
                    <Text className="text-primary font-semibold">Verify Age Now</Text>
                  </TouchableOpacity>
                ) : (
                  <View className="gap-3">
                    <View>
                      <Text className="text-foreground text-sm font-semibold mb-2">Date of Birth</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: ageError ? colors.error : colors.border,
                          borderRadius: 8,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          color: colors.foreground,
                          fontSize: 16,
                        }}
                        placeholder="DD-MM-YYYY"
                        placeholderTextColor="#9BA1A6"
                        value={dateOfBirth}
                        onChangeText={(text) => {
                          const digitsOnly = text.replace(/\D/g, "");
                          const limited = digitsOnly.slice(0, 8);
                          let formatted = limited;
                          if (limited.length >= 2) {
                            formatted = limited.slice(0, 2) + "-" + limited.slice(2);
                          }
                          if (limited.length >= 4) {
                            formatted = limited.slice(0, 2) + "-" + limited.slice(2, 4) + "-" + limited.slice(4);
                          }
                          setDateOfBirth(formatted);
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                      {ageError && (
                        <Text className="text-error text-xs mt-1">{ageError}</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setShowAgeVerification(false);
                        setDateOfBirth("");
                        setAgeError("");
                      }}
                      className="bg-muted/10 rounded-lg p-3 items-center"
                    >
                      <Text className="text-muted font-semibold">Skip for now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-background font-bold text-lg">Create Account</Text>
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

          {/* Success */}
          {step === "success" && (
            <View className="items-center gap-4 mt-8">
              <View className="bg-success/10 border border-success rounded-2xl p-6 items-center">
                <Text style={{ fontSize: 48 }}>✓</Text>
                <Text className="text-success font-bold text-xl mt-2">Account Created!</Text>
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
    </ScreenWrapper>
  );
}
