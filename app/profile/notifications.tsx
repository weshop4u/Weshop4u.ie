import { View, Text, TouchableOpacity, Switch, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";

export default function NotificationsScreen() {
  const router = useRouter();
  
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [newStores, setNewStores] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

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
        <Text className="text-xl font-bold text-foreground">Notifications</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-6 gap-6">
          {/* Notification Types */}
          <View>
            <Text className="text-foreground font-bold text-lg mb-3">Notification Types</Text>
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Order Updates</Text>
                  <Text className="text-muted text-sm mt-1">Get notified about your order status</Text>
                </View>
                <Switch
                  value={orderUpdates}
                  onValueChange={setOrderUpdates}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={orderUpdates ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Promotions & Offers</Text>
                  <Text className="text-muted text-sm mt-1">Receive special deals and discounts</Text>
                </View>
                <Switch
                  value={promotions}
                  onValueChange={setPromotions}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={promotions ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View className="flex-row items-center justify-between p-4">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">New Stores</Text>
                  <Text className="text-muted text-sm mt-1">Know when new stores join WESHOP4U</Text>
                </View>
                <Switch
                  value={newStores}
                  onValueChange={setNewStores}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={newStores ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>
          </View>

          {/* Delivery Methods */}
          <View>
            <Text className="text-foreground font-bold text-lg mb-3">Delivery Methods</Text>
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Push Notifications</Text>
                  <Text className="text-muted text-sm mt-1">Instant alerts on your device</Text>
                </View>
                <Switch
                  value={pushNotifications}
                  onValueChange={setPushNotifications}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={pushNotifications ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">Email</Text>
                  <Text className="text-muted text-sm mt-1">Receive updates via email</Text>
                </View>
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={emailNotifications ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View className="flex-row items-center justify-between p-4">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">SMS</Text>
                  <Text className="text-muted text-sm mt-1">Get text message updates</Text>
                </View>
                <Switch
                  value={smsNotifications}
                  onValueChange={setSmsNotifications}
                  trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
                  thumbColor={smsNotifications ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>
          </View>

          {/* Info Note */}
          <View className="bg-primary/10 p-4 rounded-xl">
            <Text className="text-primary text-sm leading-relaxed">
              💡 You can change these preferences anytime. Order updates are highly recommended to track your deliveries.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
