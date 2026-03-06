import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Profile updated successfully");
      router.back();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update profile");
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Email is required");
      return;
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    });
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mr-4"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Edit Profile</Text>
      </View>

      <View className="flex-1 p-6">
        <View className="gap-4">
          {/* Name */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Full Name *</Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', color: '#11181C', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 }}
              placeholder="Enter your full name"
              placeholderTextColor="#9BA1A6"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Email *</Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', color: '#11181C', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 }}
              placeholder="Enter your email"
              placeholderTextColor="#9BA1A6"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Phone Number</Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', color: '#11181C', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 }}
              placeholder="Enter your phone number"
              placeholderTextColor="#9BA1A6"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={updateProfileMutation.isPending}
            className="bg-primary py-4 rounded-xl active:opacity-70 mt-4"
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-semibold text-base">
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
