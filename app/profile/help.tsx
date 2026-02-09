import { View, Text, TouchableOpacity, ScrollView, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function HelpScreen() {
  const router = useRouter();

  const handleCall = () => {
    Linking.openURL("tel:0894626262");
  };

  const handleEmail = () => {
    Linking.openURL("mailto:Weshop4u247@gmail.com");
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
        <Text className="text-xl font-bold text-foreground">Help & Support</Text>
      </View>

      <ScrollView className="flex-1">
        <View className="p-6 gap-6">
          {/* Contact Us Section */}
          <View>
            <Text className="text-foreground font-bold text-lg mb-3">Contact Us</Text>
            <Text className="text-muted mb-4 leading-relaxed">
              Need help with your order or have questions? Our support team is here to assist you 24/7.
            </Text>

            {/* Phone */}
            <TouchableOpacity
              onPress={handleCall}
              className="bg-surface rounded-xl border border-border p-4 mb-3 active:opacity-70"
            >
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
                  <Text className="text-2xl">📞</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Call Us</Text>
                  <Text className="text-primary font-bold text-lg mt-1">0894 626262</Text>
                  <Text className="text-muted text-sm mt-1">Available 24/7</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              onPress={handleEmail}
              className="bg-surface rounded-xl border border-border p-4 active:opacity-70"
            >
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
                  <Text className="text-2xl">✉️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Email Us</Text>
                  <Text className="text-primary font-bold text-base mt-1">Weshop4u247@gmail.com</Text>
                  <Text className="text-muted text-sm mt-1">We'll respond within 24 hours</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* FAQ Section */}
          <View>
            <Text className="text-foreground font-bold text-lg mb-3">Frequently Asked Questions</Text>
            
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <View className="p-4 border-b border-border">
                <Text className="text-foreground font-semibold mb-2">How do I track my order?</Text>
                <Text className="text-muted text-sm leading-relaxed">
                  Go to the Orders tab to view all your orders and track their real-time status.
                </Text>
              </View>

              <View className="p-4 border-b border-border">
                <Text className="text-foreground font-semibold mb-2">What's the delivery fee?</Text>
                <Text className="text-muted text-sm leading-relaxed">
                  €3.50 base fee covers up to 2.8km, then €1.00 per additional km.
                </Text>
              </View>

              <View className="p-4 border-b border-border">
                <Text className="text-foreground font-semibold mb-2">Can I cancel my order?</Text>
                <Text className="text-muted text-sm leading-relaxed">
                  Contact us immediately if you need to cancel. Orders can only be cancelled before the store accepts them.
                </Text>
              </View>

              <View className="p-4">
                <Text className="text-foreground font-semibold mb-2">What payment methods do you accept?</Text>
                <Text className="text-muted text-sm leading-relaxed">
                  Currently we accept Cash on Delivery. Card payments via Elavon coming soon!
                </Text>
              </View>
            </View>
          </View>

          {/* Info Note */}
          <View className="bg-primary/10 p-4 rounded-xl">
            <Text className="text-primary text-sm leading-relaxed">
              💡 For urgent issues with active orders, calling is the fastest way to reach us!
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
