import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";

export default function AdminPanel() {
  const router = useRouter();

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1 p-6">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Admin Panel</Text>
          <Text className="text-muted">Manage drivers and system settings</Text>
        </View>

        {/* Driver Management Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Driver Management</Text>
          
          <TouchableOpacity
            onPress={() => router.push("/admin/create-driver" as any)}
            className="bg-primary p-4 rounded-lg active:opacity-70 mb-3"
          >
            <Text className="text-background font-bold text-center">➕ Create New Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/admin/drivers" as any)}
            className="bg-surface border border-border p-4 rounded-lg active:opacity-70"
          >
            <Text className="text-foreground font-semibold text-center">📋 View All Drivers</Text>
          </TouchableOpacity>
        </View>

        {/* Product Management Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Product Management</Text>
          
          <TouchableOpacity
            onPress={() => router.push("/admin/import-products" as any)}
            className="bg-primary p-4 rounded-lg active:opacity-70 mb-3"
          >
            <Text className="text-background font-bold text-center">📦 Import Products (CSV)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/admin/categories" as any)}
            className="bg-surface border border-border p-4 rounded-lg active:opacity-70 mb-3"
          >
            <Text className="text-foreground font-semibold text-center">🖼️ Manage Category Images</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/admin/batch-category-images" as any)}
            className="bg-surface border border-border p-4 rounded-lg active:opacity-70"
          >
            <Text className="text-foreground font-semibold text-center">📤 Batch Upload Category Images</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="bg-surface rounded-lg p-4 border border-border">
          <Text className="text-lg font-bold text-foreground mb-3">Quick Stats</Text>
          <View className="gap-2">
            <Text className="text-muted">• Total Drivers: Coming soon</Text>
            <Text className="text-muted">• Active Orders: Coming soon</Text>
            <Text className="text-muted">• Total Stores: 2</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
