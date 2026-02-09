import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function TermsScreen() {
  const router = useRouter();

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
        <Text className="text-xl font-bold text-foreground">Terms & Conditions</Text>
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="gap-6">
          <Text className="text-muted text-sm">Last updated: February 9, 2026</Text>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">1. Acceptance of Terms</Text>
            <Text className="text-muted leading-relaxed">
              By accessing and using WESHOP4U, you accept and agree to be bound by the terms and provision of this agreement.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">2. Use of Service</Text>
            <Text className="text-muted leading-relaxed">
              WESHOP4U provides a platform connecting customers with local stores for 24/7 delivery services. You agree to use the service only for lawful purposes and in accordance with these Terms.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">3. Orders and Payments</Text>
            <Text className="text-muted leading-relaxed">
              All orders are subject to availability and confirmation of the order price. Delivery charges will be added to the total order value. Payment methods include Cash on Delivery and Card Payment (via Elavon).
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">4. Delivery</Text>
            <Text className="text-muted leading-relaxed">
              Delivery fees are calculated based on distance: €3.50 base fee (up to 2.8km) + €1.00 per additional km. Estimated delivery times are approximate and may vary based on traffic and weather conditions.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">5. Cancellations and Refunds</Text>
            <Text className="text-muted leading-relaxed">
              Orders can only be cancelled before the store accepts them. Contact support immediately if you need to cancel. Refunds will be processed within 5-7 business days for eligible cancellations.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">6. User Accounts</Text>
            <Text className="text-muted leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">7. Prohibited Activities</Text>
            <Text className="text-muted leading-relaxed">
              You may not use the service for any illegal or unauthorized purpose. You must not, in the use of the service, violate any laws in your jurisdiction.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">8. Limitation of Liability</Text>
            <Text className="text-muted leading-relaxed">
              WESHOP4U shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of or inability to use the service.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">9. Changes to Terms</Text>
            <Text className="text-muted leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of any material changes via email or app notification.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">10. Contact Information</Text>
            <Text className="text-muted leading-relaxed">
              For questions about these Terms, please contact us at:
            </Text>
            <Text className="text-primary font-semibold mt-2">Phone: 0894 626262</Text>
            <Text className="text-primary font-semibold">Email: Weshop4u247@gmail.com</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
