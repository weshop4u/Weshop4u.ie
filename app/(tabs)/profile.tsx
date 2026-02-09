import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <View className="gap-6">
          {/* Header */}
          <View className="items-center mb-4">
            <View className="w-24 h-24 bg-primary rounded-full items-center justify-center mb-3">
              <Text className="text-background text-4xl font-bold">U</Text>
            </View>
            <Text className="text-foreground font-bold text-2xl">User Profile</Text>
            <Text className="text-muted text-sm">user@example.com</Text>
          </View>

          {/* Account Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity className="p-4 border-b border-border active:opacity-70">
              <Text className="text-foreground font-semibold">Edit Profile</Text>
              <Text className="text-muted text-sm mt-1">Update your name, email, and phone</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="p-4 border-b border-border active:opacity-70">
              <Text className="text-foreground font-semibold">Saved Addresses</Text>
              <Text className="text-muted text-sm mt-1">Manage your delivery addresses</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="p-4 active:opacity-70">
              <Text className="text-foreground font-semibold">Payment Methods</Text>
              <Text className="text-muted text-sm mt-1">Manage your saved cards</Text>
            </TouchableOpacity>
          </View>

          {/* Preferences Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity className="p-4 border-b border-border active:opacity-70">
              <Text className="text-foreground font-semibold">Notifications</Text>
              <Text className="text-muted text-sm mt-1">Manage notification preferences</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="p-4 active:opacity-70">
              <Text className="text-foreground font-semibold">Language & Region</Text>
              <Text className="text-muted text-sm mt-1">English (Ireland)</Text>
            </TouchableOpacity>
          </View>

          {/* Support Section */}
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <TouchableOpacity className="p-4 border-b border-border active:opacity-70">
              <Text className="text-foreground font-semibold">Help & Support</Text>
              <Text className="text-muted text-sm mt-1">Get help with your orders</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="p-4 border-b border-border active:opacity-70">
              <Text className="text-foreground font-semibold">Terms & Conditions</Text>
              <Text className="text-muted text-sm mt-1">Read our terms of service</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="p-4 active:opacity-70">
              <Text className="text-foreground font-semibold">Privacy Policy</Text>
              <Text className="text-muted text-sm mt-1">How we handle your data</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity className="bg-red-500 py-4 rounded-xl active:opacity-70 mt-4">
            <Text className="text-white text-center font-semibold text-base">
              Log Out
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text className="text-muted text-center text-sm mt-4">
            WESHOP4U v1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
