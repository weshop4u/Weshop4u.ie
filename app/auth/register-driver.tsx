import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function RegisterDriverScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const registerMutation = trpc.auth.registerDriver.useMutation();

  const handleRegister = async () => {
    // Validation
    if (!name || !email || !phone || !password || !vehicleType || !vehicleNumber) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password,
        vehicleType: vehicleType.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim() || undefined,
      });

      Alert.alert(
        "Success",
        "Driver account created! Please log in to start accepting deliveries.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/auth/login" as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message || "Could not create driver account");
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
        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View className="items-center mb-6 mt-8">
            <Text className="text-primary text-5xl font-bold mb-2">🚗 DRIVER</Text>
            <Text className="text-muted text-lg">Join Our Delivery Team</Text>
          </View>

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

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
            >
              <Text className="text-background font-bold text-lg">
                {loading ? "Creating Account..." : "Register as Driver"}
              </Text>
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
  );
}
