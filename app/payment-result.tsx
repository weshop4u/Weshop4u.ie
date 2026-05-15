import { Text, View, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useColors } from "@/hooks/use-colors";
import { ScreenWrapper } from "@/components/native-wrapper";

type ResultState = "checking" | "success" | "failed" | "pending" | "error";

export default function PaymentResultScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const colors = useColors();
  const [state, setState] = useState<ResultState>("checking");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const hasChecked = useRef(false);
  const pollCount = useRef(0);

  const orderIdNum = params.orderId ? parseInt(params.orderId) : 0;
  const checkStatusMutation = trpc.payments.checkPaymentStatus.useMutation();

  useEffect(() => {
    if (hasChecked.current || !orderIdNum) return;
    hasChecked.current = true;
    checkPayment();
  }, [orderIdNum]);

  const checkPayment = async () => {
    try {
      const result = await checkStatusMutation.mutateAsync({ orderId: orderIdNum });

      if (result.status === "completed") {
        setState("success");
        setTransactionId(result.transactionId || null);
      } else if (result.status === "expired" || result.status === "error") {
        setState("failed");
        setErrorMsg("Payment was not completed. Please try again or choose a different payment method.");
      } else if (result.status === "pending") {
        // Payment might still be processing - poll a few times
        pollCount.current += 1;
        if (pollCount.current < 5) {
          setTimeout(() => checkPayment(), 3000);
        } else {
          setState("pending");
        }
      } else if (result.status === "no_session") {
        setState("failed");
        setErrorMsg("No payment session found for this order.");
      }
    } catch (error: any) {
      console.error("[PaymentResult] Error checking status:", error);
      setState("error");
      setErrorMsg(error.message || "Failed to verify payment status.");
    }
  };

  const handleViewOrder = () => {
    router.replace(`/order-confirmation/${orderIdNum}`);
  };

  const handleGoHome = () => {
    router.replace("/");
  };

  const handleRetryCheck = () => {
    setState("checking");
    pollCount.current = 0;
    hasChecked.current = false;
    checkPayment();
  };

  const isWeb = Platform.OS === "web";


  if (!orderIdNum) {
    return (
      <ScreenWrapper>
        <ScreenContainer className="items-center justify-center p-6">
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16 }}>
            Invalid Order
          </Text>
          <TouchableOpacity
            onPress={handleGoHome}
            style={{
              backgroundColor: "#00E5FF",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 24,
            }}
          >
            <Text style={{ color: "#000", fontWeight: "600" }}>Back to Home</Text>
          </TouchableOpacity>
        </ScreenContainer>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScreenContainer className="items-center justify-center p-6">
        {state === "checking" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Verifying payment...
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
              Please wait while we confirm your payment
            </Text>
          </View>
        )}

        {state === "success" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#22C55E20",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 40 }}>✅</Text>
            </View>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
              Payment Successful!
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              Your payment has been processed successfully. Your order is now being prepared.
            </Text>
            {transactionId && (
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                Transaction ID: {transactionId}
              </Text>
            )}
            <TouchableOpacity
              onPress={handleViewOrder}
              style={{
                backgroundColor: "#00E5FF",
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 10,
                marginTop: 16,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>View Order</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === "failed" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#EF444420",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 40 }}>❌</Text>
            </View>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
              Payment Failed
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              {errorMsg}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={handleGoHome}
                style={{
                  backgroundColor: "#00E5FF",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "600" }}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state === "pending" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 40 }}>⏳</Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Payment Processing
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              Your payment is still being processed. This may take a moment.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={handleRetryCheck}
                style={{
                  backgroundColor: "#00E5FF",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "600" }}>Check Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleViewOrder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>View Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state === "error" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Verification Error
            </Text>
            <Text style={{ color: colors.error, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              {errorMsg}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={handleRetryCheck}
                style={{
                  backgroundColor: "#00E5FF",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "600" }}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGoHome}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScreenContainer>
    </ScreenWrapper>
  );
}
