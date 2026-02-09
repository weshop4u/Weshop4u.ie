import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function CreateDriverScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const registerDriverMutation = trpc.auth.registerDriver.useMutation();

  const handleCreateDriver = async () => {
    setError("");
    setSuccess(false);

    // Validation
    if (!name || !email || !phone || !password || !vehicleType || !vehicleNumber) {
      setError("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      await registerDriverMutation.mutateAsync({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password,
        vehicleType: vehicleType.trim(),
        vehicleNumber: vehicleNumber.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
      });

      setSuccess(true);
      
      // Clear form
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setVehicleType("");
      setVehicleNumber("");
      setLicenseNumber("");

      // Navigate back after 2 seconds
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Could not create driver account");
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
          <View className="mb-4">
            <Text className="text-2xl font-bold text-foreground mb-2">Create Driver Account</Text>
            <Text className="text-muted">Password will be automatically hashed with bcrypt</Text>
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
              <Text className="text-success font-semibold">Driver account created successfully!</Text>
            </View>
          ) : null}

          {/* Form */}
          <View className="gap-4">
            {/* Personal Information */}
            <View>
              <Text className="text-foreground font-semibold mb-2">Full Name *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="John Driver"
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
                placeholder="driver@example.com"
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

            {/* Vehicle Information */}
            <View className="mt-4">
              <Text className="text-lg font-bold text-foreground mb-3">Vehicle Information</Text>
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Vehicle Type *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Car, Motorcycle, Van, etc."
                placeholderTextColor="#9BA1A6"
                value={vehicleType}
                onChangeText={setVehicleType}
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Vehicle Number *</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Registration number"
                placeholderTextColor="#9BA1A6"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                autoCapitalize="characters"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">License Number (Optional)</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg p-4 text-foreground"
                placeholder="Driver's license number"
                placeholderTextColor="#9BA1A6"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreateDriver}
              disabled={loading}
              className={`bg-primary p-4 rounded-lg items-center mt-4 ${loading ? "opacity-50" : "active:opacity-70"}`}
            >
              <Text className="text-background font-bold text-lg">
                {loading ? "Creating Account..." : "Create Driver Account"}
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={loading}
              className="bg-surface border border-border p-4 rounded-lg items-center active:opacity-70"
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
