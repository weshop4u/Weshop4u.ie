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
      <View className="flex-1 items-center justify-center p-6">
        <View className="bg-surface rounded-xl border border-border p-6 max-w-md">
          <Text className="text-foreground font-bold text-xl text-center mb-3">
            Coming Soon
          </Text>
          <Text className="text-muted text-center leading-relaxed">
            Payment methods management will be available once Elavon payment gateway integration is complete.
          </Text>
          <Text className="text-muted text-center leading-relaxed mt-4">
            For now, you can pay with:
          </Text>
          <View className="mt-4 gap-2">
            <View className="flex-row items-center gap-3 bg-background p-3 rounded-lg">
              <Text className="text-2xl">💵</Text>
              <Text className="text-foreground font-semibold">Cash on Delivery</Text>
            </View>
            <View className="flex-row items-center gap-3 bg-background p-3 rounded-lg opacity-50">
              <Text className="text-2xl">💳</Text>
              <View>
                <Text className="text-foreground font-semibold">Card Payment (Elavon)</Text>
                <Text className="text-muted text-xs">Coming soon</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
