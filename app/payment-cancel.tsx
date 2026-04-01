import { Text, View, TouchableOpacity, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useColors } from "@/hooks/use-colors";
import { ScreenWrapper } from "@/components/native-wrapper";

export default function PaymentCancelScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const colors = useColors();
  const orderIdNum = params.orderId ? parseInt(params.orderId) : 0;
  const hasCancelled = useRef(false);

  const cancelPaymentMutation = trpc.payments.cancelPayment.useMutation();

  useEffect(() => {
    if (hasCancelled.current || !orderIdNum) return;
    hasCancelled.current = true;

    // Cancel the payment/order on the backend
    cancelPaymentMutation.mutateAsync({ orderId: orderIdNum }).catch(() => {
      // Ignore errors - order might already be cancelled
    });
  }, [orderIdNum]);

  const handleGoHome = () => {
    router.replace("/");
  };

  const handleRetryPayment = () => {
    if (orderIdNum) {
      router.replace(`/payment/${orderIdNum}`);
    }
  };

  const isWeb = Platform.OS === "web";


  return (
    <ScreenWrapper>
      <ScreenContainer className="items-center justify-center p-6">
        <View style={{ alignItems: "center", gap: 16 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#F59E0B20",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Text style={{ fontSize: 40 }}>🚫</Text>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
            Payment Cancelled
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
            Your payment was cancelled. Your order has been removed. You can try again or return to the home page.
          </Text>
          <View style={{ gap: 12, marginTop: 16, alignItems: "center" }}>
            <TouchableOpacity
              onPress={handleGoHome}
              style={{
                backgroundColor: "#00E5FF",
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    </ScreenWrapper>
  );
}
