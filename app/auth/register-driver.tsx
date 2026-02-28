import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { WebLayout } from "@/components/web-layout";

type Step = "form" | "pending";

export default function RegisterDriverScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [town, setTown] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [driverNumber, setDriverNumber] = useState("");

  const registerMutation = trpc.auth.registerDriver.useMutation();

  const handleRegister = async () => {
    setError("");

    if (!name || !email || !phone || !password || !vehicleType || !vehicleNumber) {
      setError("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        town: town.trim() || undefined,
        address: address.trim() || undefined,
        password,
        vehicleType: vehicleType.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim() || undefined,
      });

      setDriverNumber(result.displayNumber || "");
      setStep("pending");
    } catch (err: any) {
      setError(err.message || "Could not create driver account");
    } finally {
      setLoading(false);
    }
  };

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  if (step === "pending") {
    return (
      <Wrapper>
      <ScreenContainer>
        <View className="flex-1 p-6 justify-center items-center">
          <View className="items-center mb-8">
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 }}
              resizeMode="cover"
            />
          </View>

          <View className="bg-warning/10 border-2 border-warning rounded-2xl p-6 w-full max-w-sm items-center">
            <Text style={{ fontSize: 48 }}>⏳</Text>
            <Text className="text-warning font-bold text-2xl mt-3">Application Submitted!</Text>
            <Text className="text-foreground text-center mt-3 text-base leading-relaxed">
              Thank you for applying to drive with WESHOP4U.
            </Text>
            {driverNumber ? (
              <Text className="text-primary font-bold text-lg mt-2">
                Your driver number: #{driverNumber}
              </Text>
            ) : null}
            <Text className="text-muted text-center mt-3 text-sm leading-relaxed">
              Your application is now under review. We'll notify you once you've been approved and you can start accepting deliveries.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/auth/login" as any)}
            className="bg-primary px-8 py-4 rounded-lg mt-8 active:opacity-70"
          >
            <Text className="text-background font-bold text-lg">Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
      </Wrapper>
    );
  }

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
            <Text className="text-primary text-4xl font-bold mb-2">DRIVER SIGN UP</Text>
            <Text className="text-muted text-lg">Join Our Delivery Team</Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          ) : null}

          {/* Registration Form */}
          <View className="gap-4">
            <Text className="text-foreground font-bold text-xl">Personal Information</Text>

            <View>
              <Text className="text-foreground font-semibold mb-2">Full Name *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
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
              <Text className="text-foreground font-semibold mb-2">Phone *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="087 123 4567"
                placeholderTextColor="#9BA1A6"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Town / Area</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="e.g., Balbriggan, Swords, Drogheda"
                placeholderTextColor="#9BA1A6"
                value={town}
                onChangeText={setTown}
                autoCapitalize="words"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Address</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Your home address"
                placeholderTextColor="#9BA1A6"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
              />
            </View>

            <Text className="text-foreground font-bold text-xl mt-4">Vehicle Information</Text>

            <View>
              <Text className="text-foreground font-semibold mb-2">Vehicle Type *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Car, Bike, Scooter, etc."
                placeholderTextColor="#9BA1A6"
                value={vehicleType}
                onChangeText={setVehicleType}
                autoCapitalize="words"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Vehicle Registration *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="e.g., 231-D-12345"
                placeholderTextColor="#9BA1A6"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                autoCapitalize="characters"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Driver License Number (Optional)</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="License number"
                placeholderTextColor="#9BA1A6"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
              />
            </View>

            <Text className="text-foreground font-bold text-xl mt-4">Account Security</Text>

            <View>
              <Text className="text-foreground font-semibold mb-2">Password *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="At least 6 characters"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Confirm Password *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Re-enter password"
                placeholderTextColor="#9BA1A6"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Info Note */}
            <View className="bg-surface border border-border rounded-lg p-4 mt-2">
              <Text className="text-muted text-sm leading-relaxed">
                <Text className="font-semibold">Note:</Text> Your application will be reviewed by our team. You'll be notified once approved and can then start accepting deliveries.
              </Text>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              className={`bg-primary p-4 rounded-lg items-center mt-2 ${loading ? "opacity-50" : "active:opacity-70"}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-bold text-lg">Submit Application</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View className="flex-row justify-center items-center mt-4">
              <Text className="text-muted">Already have an account? </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="active:opacity-70"
              >
                <Text className="text-primary font-semibold">Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
    </Wrapper>
  );
}
