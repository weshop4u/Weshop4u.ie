import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function PrivacyScreen() {
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
        <Text className="text-xl font-bold text-foreground">Privacy Policy</Text>
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="gap-6">
          <Text className="text-muted text-sm">Last updated: February 9, 2026</Text>

          <Text className="text-muted leading-relaxed">
            WESHOP4U ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">1. Information We Collect</Text>
            <Text className="text-muted leading-relaxed mb-3">
              <Text className="font-semibold">Personal Information:</Text> Name, email address, phone number, delivery addresses, and payment information.
            </Text>
            <Text className="text-muted leading-relaxed mb-3">
              <Text className="font-semibold">Order Information:</Text> Purchase history, order details, delivery preferences, and feedback.
            </Text>
            <Text className="text-muted leading-relaxed">
              <Text className="font-semibold">Device Information:</Text> IP address, device type, operating system, and app usage data.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">2. How We Use Your Information</Text>
            <Text className="text-muted leading-relaxed">
              We use your information to process orders, facilitate deliveries, communicate with you about your orders, improve our services, send promotional offers (with your consent), and ensure platform security.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">3. Information Sharing</Text>
            <Text className="text-muted leading-relaxed">
              We share your information with stores to fulfill orders, delivery drivers to complete deliveries, payment processors to handle transactions, and service providers who assist our operations. We never sell your personal information to third parties.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">4. Data Security</Text>
            <Text className="text-muted leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">5. Your Rights</Text>
            <Text className="text-muted leading-relaxed">
              You have the right to access, correct, or delete your personal information. You can update your profile information in the app or contact us to exercise these rights.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">6. Location Data</Text>
            <Text className="text-muted leading-relaxed">
              We collect location data (via Eircode) to calculate delivery fees and facilitate order delivery. This information is only used for service delivery and is not shared for marketing purposes.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">7. Cookies and Tracking</Text>
            <Text className="text-muted leading-relaxed">
              We use cookies and similar tracking technologies to improve user experience and analyze app performance.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">8. Children's Privacy</Text>
            <Text className="text-muted leading-relaxed">
              Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">9. Changes to Privacy Policy</Text>
            <Text className="text-muted leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </Text>
          </View>

          <View>
            <Text className="text-foreground font-bold text-lg mb-2">10. Contact Us</Text>
            <Text className="text-muted leading-relaxed">
              If you have questions about this Privacy Policy, please contact us:
            </Text>
            <Text className="text-primary font-semibold mt-2">Phone: 0894 626262</Text>
            <Text className="text-primary font-semibold">Email: Weshop4u247@gmail.com</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
