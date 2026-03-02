import { Text, View, ActivityIndicator, TouchableOpacity, Platform, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useColors } from "@/hooks/use-colors";
import { WebLayout } from "@/components/web-layout";
import { getApiBaseUrl } from "@/constants/oauth";

type PaymentState = "loading" | "redirecting" | "error" | "cancelled";

export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useColors();
  const orderIdNum = parseInt(orderId);
  const [state, setState] = useState<PaymentState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const hasInitiated = useRef(false);

  const createSessionMutation = trpc.payments.createPaymentSession.useMutation();
  const cancelPaymentMutation = trpc.payments.cancelPayment.useMutation();

  // Get the base URL for return/cancel URLs
  const getAppBaseUrl = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.host}`;
    }
    // For native, use the API server URL as a web fallback
    return getApiBaseUrl();
  };

  useEffect(() => {
    if (hasInitiated.current || !orderIdNum) return;
    hasInitiated.current = true;

    const initPayment = async () => {
      try {
        const baseUrl = getAppBaseUrl();
        const returnUrl = `${baseUrl}/payment-result`;
        const cancelUrl = `${baseUrl}/payment-cancel`;

        const result = await createSessionMutation.mutateAsync({
          orderId: orderIdNum,
          returnUrl,
          cancelUrl,
        });

        if (result.paymentUrl) {
          setState("redirecting");
          // On web, redirect the current window
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.location.href = result.paymentUrl;
          } else {
            // On native, open in browser
            await Linking.openURL(result.paymentUrl);
            // After opening, show a "waiting" state
            setState("redirecting");
          }
        } else {
          setState("error");
          setErrorMsg("Failed to create payment session. No payment URL returned.");
        }
      } catch (error: any) {
        console.error("[Payment] Error creating session:", error);
        setState("error");
        setErrorMsg(error.message || "Failed to initiate payment. Please try again.");
      }
    };

    initPayment();
  }, [orderIdNum]);

  const handleCancel = async () => {
    try {
      await cancelPaymentMutation.mutateAsync({ orderId: orderIdNum });
      router.replace("/");
    } catch (error) {
      router.replace("/");
    }
  };

  const handleRetry = () => {
    hasInitiated.current = false;
    setState("loading");
    setErrorMsg("");
    // Re-trigger
    const initPayment = async () => {
      try {
        const baseUrl = getAppBaseUrl();
        const returnUrl = `${baseUrl}/payment-result`;
        const cancelUrl = `${baseUrl}/payment-cancel`;

        const result = await createSessionMutation.mutateAsync({
          orderId: orderIdNum,
          returnUrl,
          cancelUrl,
        });

        if (result.paymentUrl) {
          setState("redirecting");
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.location.href = result.paymentUrl;
          } else {
            await Linking.openURL(result.paymentUrl);
          }
        } else {
          setState("error");
          setErrorMsg("Failed to create payment session.");
        }
      } catch (error: any) {
        setState("error");
        setErrorMsg(error.message || "Failed to initiate payment.");
      }
    };
    initPayment();
  };

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <Wrapper>
      <ScreenContainer className="items-center justify-center p-6">
        {state === "loading" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Setting up secure payment...
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
              You'll be redirected to Elavon's secure payment page
            </Text>
          </View>
        )}

        {state === "redirecting" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Redirecting to payment...
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              You're being redirected to Elavon's secure payment page. Please complete your payment there.
            </Text>
            <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 8 }} />

            {Platform.OS !== "web" && (
              <View style={{ marginTop: 24, gap: 12, alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                  After completing payment, return to this app to view your order.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/payment-result?orderId=${orderIdNum}`)}
                  style={{
                    backgroundColor: "#00E5FF",
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#000", fontWeight: "600" }}>I've Completed Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={{ color: colors.error, fontSize: 14 }}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {state === "error" && (
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              Payment Error
            </Text>
            <Text style={{ color: colors.error, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              {errorMsg}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={handleRetry}
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
                onPress={handleCancel}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScreenContainer>
    </Wrapper>
  );
}
