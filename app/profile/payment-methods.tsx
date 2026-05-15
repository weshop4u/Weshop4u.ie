import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function PaymentMethodsScreen() {
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
        <Text className="text-xl font-bold text-foreground">Payment Methods</Text>
      </View>

      {/* Content */}
      <View className="flex-1 p-6">
        <View className="gap-6">
          {/* Section Title */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">How Payments Work</Text>
            <Text className="text-muted text-sm">Choose your preferred payment method at checkout</Text>
          </View>

          {/* Cash on Delivery */}
          <View className="bg-surface rounded-xl border border-border p-4">
            <View className="flex-row items-start gap-3">
              <Text className="text-3xl mt-1">💵</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">Cash on Delivery</Text>
                <Text className="text-muted text-sm mt-2 leading-relaxed">
                  Pay the driver when your order arrives. No upfront payment required.
                </Text>
              </View>
            </View>
          </View>

          {/* Card Payment */}
          <View className="bg-surface rounded-xl border border-border p-4">
            <View className="flex-row items-start gap-3">
              <Text className="text-3xl mt-1">💳</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">Card Payment</Text>
                <Text className="text-muted text-sm mt-2 leading-relaxed">
                  Visa, Mastercard, Apple Pay, and Google Pay. Processed securely by Elavon.
                </Text>
              </View>
            </View>
          </View>

          {/* Security Info */}
          <View className="bg-primary bg-opacity-10 rounded-xl border border-primary border-opacity-20 p-4">
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl mt-0.5">🔒</Text>
              <View className="flex-1">
                <Text className="text-primary font-semibold text-sm">Secure Payments</Text>
                <Text className="text-muted text-xs mt-1 leading-relaxed">
                  All card payments are encrypted and processed securely through Elavon's payment gateway.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
