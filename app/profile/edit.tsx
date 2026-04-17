import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Pre-fill form with existing user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setProfilePicture(user.profilePicture || "");
      if (user.profilePicture) {
        setPreviewUrl(user.profilePicture);
      }
    }
  }, [user]);

  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Profile updated successfully");
      refetch();
      router.back();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update profile");
    },
  });

  const handleImageUpload = () => {
    // For web, use file input
    if (typeof window !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setPreviewUrl(base64);
            setProfilePicture(base64);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      profilePicture: profilePicture || undefined,
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
          {/* Profile Picture Section */}
          <View className="items-center gap-4 mb-6">
            {previewUrl ? (
              <Image
                source={{ uri: previewUrl }}
                style={{ width: 120, height: 120, borderRadius: 60 }}
              />
            ) : (
              <View className="w-30 h-30 bg-primary rounded-full items-center justify-center">
                <Text className="text-white text-4xl font-bold">
                  {name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleImageUpload}
              className="bg-primary px-6 py-2 rounded-full active:opacity-70"
            >
              <Text className="text-white font-semibold">Change Picture</Text>
            </TouchableOpacity>
          </View>

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
            <Text className="text-foreground font-semibold mb-2">Email</Text>
            <TextInput
              style={{ backgroundColor: '#f5f5f5', color: '#11181C', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 }}
              placeholder="Enter your email"
              placeholderTextColor="#9BA1A6"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />
            <Text className="text-muted text-sm mt-1">Email cannot be changed</Text>
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
