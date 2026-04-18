import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

// Toast notification component
function Toast({ message, visible, onHide }: { message: string; visible: boolean; onHide: () => void }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <View className="absolute bottom-8 left-4 right-4 bg-success px-6 py-4 rounded-xl z-50">
      <Text className="text-white font-semibold text-center">{message}</Text>
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { data: profileData } = trpc.users.getProfile.useQuery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingPictureBase64, setPendingPictureBase64] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Pre-fill form with existing user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setProfilePictureUrl(user.profilePicture || "");
      if (user.profilePicture) {
        setPreviewUrl(user.profilePicture);
      }
    }
  }, [user]);

  // Load existing profile picture from database on page open
  useEffect(() => {
    if (profileData?.profilePicture && !previewUrl) {
      setPreviewUrl(profileData.profilePicture);
      setProfilePictureUrl(profileData.profilePicture);
    }
  }, [profileData]);

  // Upload profile picture mutation
  const uploadProfilePictureMutation = trpc.users.uploadProfilePicture.useMutation({
    onSuccess: (data) => {
      setProfilePictureUrl(data.url);
      setPendingPictureBase64(null);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to upload profile picture");
      setPendingPictureBase64(null);
    },
  });

  // Update profile mutation
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      console.log("[updateProfile] Success");
      setShowSuccessToast(true);
      // Refresh auth state to get updated profile
      await refresh();
      setTimeout(() => {
        router.back();
      }, 1000);
    },
    onError: (error: any) => {
      console.error("[updateProfile] Error:", error);
      const errorMsg = error?.message || error?.data?.message || "Failed to update profile";
      Alert.alert("Error", errorMsg);
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
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            // Only preview locally, don't upload yet
            setPreviewUrl(base64);
            setPendingPictureBase64(base64);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }

    // If there's a pending picture, upload it first
    if (pendingPictureBase64) {
      uploadProfilePictureMutation.mutate(
        {
          base64: pendingPictureBase64,
          mimeType: "image/jpeg",
        },
        {
          onSuccess: (data) => {
            // After upload succeeds, save the profile with the new URL
            updateProfileMutation.mutate({
              name: name.trim(),
              phone: phone.trim() || undefined,
              profilePicture: data.url,
            });
          },
        }
      );
    } else {
      // No pending picture, just save the profile
      updateProfileMutation.mutate({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
    }
  };

  const isSaving = updateProfileMutation.isPending || uploadProfilePictureMutation.isPending;

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
              disabled={isSaving}
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
            disabled={isSaving}
            className="bg-primary py-4 rounded-xl active:opacity-70 mt-4"
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-semibold text-base">
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Toast */}
      <Toast
        message="Profile updated successfully!"
        visible={showSuccessToast}
        onHide={() => setShowSuccessToast(false)}
      />
    </ScreenContainer>
  );
}
