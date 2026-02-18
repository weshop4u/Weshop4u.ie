import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, FlatList, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getApiBaseUrl } from "@/constants/oauth";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

type FeeInfo = {
  distance: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  deliveryLatitude: number;
  deliveryLongitude: number;
  formattedAddress: string;
} | null;

export default function PhoneOrderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Step tracking
  const [step, setStep] = useState<"store" | "products" | "details" | "confirm">("store");

  // Store selection
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState("");

  // Product search and cart
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryEircode, setDeliveryEircode] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("cash_on_delivery");
  const [allowSubstitution, setAllowSubstitution] = useState(false);

  // Fee calculation
  const [feeInfo, setFeeInfo] = useState<FeeInfo>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState("");

  // Customer lookup
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tRPC query for customer lookup (enabled when lookupPhone is set)
  const { data: lookupData, isFetching: lookupFetching } = trpc.admin.lookupCustomerByPhone.useQuery(
    { phone: lookupPhone },
    { enabled: lookupPhone.length >= 7 }
  );

  // Process lookup results
  useEffect(() => {
    if (!lookupPhone || lookupPhone.length < 7) return;
    if (lookupFetching) {
      setLookupLoading(true);
      return;
    }
    setLookupLoading(false);
    if (lookupData) {
      if (lookupData.found) {
        if (lookupData.name) setCustomerName(lookupData.name);
        if (lookupData.address) setDeliveryAddress(lookupData.address);
        if (lookupData.eircode) setDeliveryEircode(lookupData.eircode);
        setLookupMessage(`\u2705 Found: ${lookupData.name || "Customer"} — details auto-filled`);
        setLookupDone(true);
      } else {
        setLookupMessage("No previous orders found for this number");
        setLookupDone(true);
      }
    }
  }, [lookupData, lookupFetching, lookupPhone]);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; total: number; distance: number; serviceFee: number; deliveryFee: number; subtotal: number } | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Queries
  const { data: storesList, isLoading: storesLoading } = trpc.admin.getStores.useQuery();
  const { data: productsList, isLoading: productsLoading } = trpc.admin.getStoreProducts.useQuery(
    { storeId: selectedStoreId!, search: searchQuery || undefined },
    { enabled: selectedStoreId !== null }
  );

  const createPhoneOrderMutation = trpc.admin.createPhoneOrder.useMutation();
  const calculateFeesMutation = trpc.admin.calculatePhoneOrderFees.useMutation();

  // Cart calculations
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const addToCart = (product: { id: number; name: string; price: string }) => {
    const existing = cart.find(c => c.productId === product.id);
    if (existing) {
      setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: number) => {
    const existing = cart.find(c => c.productId === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c));
    } else {
      setCart(cart.filter(c => c.productId !== productId));
    }
  };

  // ===== CUSTOMER LOOKUP BY PHONE =====
  const handlePhoneChange = useCallback((text: string) => {
    setCustomerPhone(text);
    setLookupDone(false);
    setLookupMessage("");

    // Debounce: set lookupPhone after delay to trigger tRPC query
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    const cleaned = text.replace(/\s+/g, "");
    if (cleaned.length >= 7) {
      phoneDebounceRef.current = setTimeout(() => {
        setLookupPhone(cleaned);
      }, 800);
    } else {
      setLookupPhone("");
    }
  }, []);

  // ===== FEE CALCULATION =====
  const calculateFees = useCallback(async () => {
    if (!selectedStoreId || !deliveryEircode.trim() || cartSubtotal <= 0) return;

    setFeeLoading(true);
    setFeeError("");
    setFeeInfo(null);

    try {
      const result = await calculateFeesMutation.mutateAsync({
        storeId: selectedStoreId,
        eircode: deliveryEircode.trim(),
        subtotal: cartSubtotal,
      });
      setFeeInfo(result);
    } catch (e: any) {
      setFeeError(e.message || "Could not calculate fees");
    } finally {
      setFeeLoading(false);
    }
  }, [selectedStoreId, deliveryEircode, cartSubtotal]);

  // Auto-calculate fees when Eircode changes (debounced)
  const eircodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEircodeChange = useCallback((text: string) => {
    setDeliveryEircode(text);
    setFeeInfo(null);
    setFeeError("");

    if (eircodeDebounceRef.current) clearTimeout(eircodeDebounceRef.current);
    const cleaned = text.replace(/\s+/g, "");
    if (cleaned.length >= 5) {
      eircodeDebounceRef.current = setTimeout(() => {
        calculateFees();
      }, 1000);
    }
  }, [calculateFees]);

  // Recalculate when eircode debounce triggers (need latest values)
  useEffect(() => {
    // Cleanup debounce on unmount
    return () => {
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      if (eircodeDebounceRef.current) clearTimeout(eircodeDebounceRef.current);
    };
  }, []);

  // ===== ORDER SUBMISSION (no Alert.alert) =====
  const handleSubmit = useCallback(() => {
    if (!selectedStoreId || cart.length === 0 || !customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
      setSubmitError("Please fill in all required fields including Eircode.");
      return;
    }
    setSubmitError("");
    setShowConfirmModal(true);
  }, [selectedStoreId, cart, customerName, customerPhone, deliveryAddress, deliveryEircode]);

  const confirmAndCreate = useCallback(async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError("");

    try {
      const lat = feeInfo?.deliveryLatitude ?? 53.6109;
      const lng = feeInfo?.deliveryLongitude ?? -6.1811;

      const data = await createPhoneOrderMutation.mutateAsync({
        storeId: selectedStoreId!,
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryEircode: deliveryEircode.trim() || undefined,
        deliveryLatitude: lat,
        deliveryLongitude: lng,
        paymentMethod,
        customerNotes: customerNotes.trim() || undefined,
        allowSubstitution,
      });

      setOrderResult({
        orderNumber: data.orderNumber,
        total: data.total,
        distance: data.distance,
        serviceFee: data.serviceFee,
        deliveryFee: data.deliveryFee,
        subtotal: data.subtotal,
      });
    } catch (e: any) {
      setSubmitting(false);
      setSubmitError(e.message || "Failed to create order");
    }
  }, [selectedStoreId, cart, customerName, customerPhone, deliveryAddress, deliveryEircode, paymentMethod, customerNotes, allowSubstitution, feeInfo]);

  // Step indicator
  const steps = [
    { key: "store", label: "Store" },
    { key: "products", label: "Items" },
    { key: "details", label: "Details" },
    { key: "confirm", label: "Confirm" },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);

  // ===== ORDER SUCCESS SCREEN =====
  if (orderResult) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 + insets.bottom, alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#ECEDEE", marginBottom: 8, textAlign: "center" }}>Order Created!</Text>
          <Text style={{ fontSize: 16, color: "#9BA1A6", marginBottom: 24, textAlign: "center" }}>
            {orderResult.orderNumber}
          </Text>

          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#334155", width: "100%", maxWidth: 400, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{orderResult.subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Service Fee (10%)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{orderResult.serviceFee.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Delivery Fee ({orderResult.distance.toFixed(1)} km)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{orderResult.deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 8 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{orderResult.total.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: "#00E5FF", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#151718" }}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ===== CONFIRM MODAL (web-compatible, replaces Alert.alert) =====
  const ConfirmOverlay = showConfirmModal ? (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center", alignItems: "center",
      zIndex: 999,
      padding: 24,
    }}>
      <View style={{
        backgroundColor: "#1e2022",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 400,
        borderWidth: 1,
        borderColor: "#334155",
      }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#ECEDEE", marginBottom: 12 }}>Confirm Order</Text>
        <Text style={{ fontSize: 15, color: "#9BA1A6", marginBottom: 6 }}>
          Create order for {customerName}?
        </Text>
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
          {cartItemCount} items from {selectedStoreName}
        </Text>
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
          Subtotal: €{cartSubtotal.toFixed(2)}
        </Text>
        {feeInfo && (
          <>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
              Service Fee: €{feeInfo.serviceFee.toFixed(2)}
            </Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
              Delivery Fee: €{feeInfo.deliveryFee.toFixed(2)} ({feeInfo.distance.toFixed(1)} km)
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#00E5FF", marginBottom: 4 }}>
              Total: €{feeInfo.total.toFixed(2)}
            </Text>
          </>
        )}
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 16 }}>
          Payment: {paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Card"}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowConfirmModal(false)}
            style={{ flex: 1, backgroundColor: "#334155", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmAndCreate}
            style={{ flex: 2, backgroundColor: "#22C55E", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Create Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <ScreenContainer className="bg-background">
      {/* Step Indicator */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", gap: 4 }}>
        {steps.map((s, i) => (
          <View key={s.key} style={{ flex: 1, alignItems: "center" }}>
            <View style={{
              width: "100%", height: 3, borderRadius: 2,
              backgroundColor: i <= currentStepIndex ? "#00E5FF" : "#334155",
              marginBottom: 4,
            }} />
            <Text style={{ fontSize: 11, fontWeight: i === currentStepIndex ? "700" : "400", color: i <= currentStepIndex ? "#00E5FF" : "#687076" }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* STEP 1: Store Selection */}
      {step === "store" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 20 + insets.bottom }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 4 }}>Select Store</Text>
          <Text style={{ fontSize: 14, color: "#687076", marginBottom: 16 }}>Which store is the customer ordering from?</Text>

          {storesLoading ? (
            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 10 }}>
              {(storesList || []).map(store => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setSelectedStoreName(store.name);
                    setStep("products");
                  }}
                  style={{
                    backgroundColor: "#1e2022",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedStoreId === store.id ? "#00E5FF" : "#334155",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE" }}>{store.name}</Text>
                  <Text style={{ fontSize: 13, color: "#687076", marginTop: 2 }}>{store.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* STEP 2: Product Selection */}
      {step === "products" && (
        <View className="flex-1">
          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155" }}>
            <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search products..."
                placeholderTextColor="#687076"
                style={{ fontSize: 15, color: "#ECEDEE" }}
                returnKeyType="search"
                autoFocus
              />
            </View>
          </View>

          {/* Product List */}
          {productsLoading ? (
            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={productsList || []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 100 : 20 }}
              renderItem={({ item }) => {
                const inCart = cart.find(c => c.productId === item.id);
                return (
                  <View style={{
                    backgroundColor: "#1e2022",
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: inCart ? "#00E5FF" : "#334155",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }} numberOfLines={2}>{item.name}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#00E5FF", marginTop: 2 }}>€{parseFloat(item.price).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {inCart && (
                        <>
                          <TouchableOpacity
                            onPress={() => removeFromCart(item.id)}
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 18, fontWeight: "700", color: "#ECEDEE" }}>−</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE", minWidth: 24, textAlign: "center" }}>{inCart.quantity}</Text>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => addToCart(item)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#151718" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ color: "#687076" }}>{searchQuery ? "No products found" : "No products available"}</Text>
                </View>
              }
            />
          )}

          {/* Cart Summary Bar */}
          {cart.length > 0 && (
            <View style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1e2022",
              borderTopWidth: 1,
              borderTopColor: "#334155",
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12 + insets.bottom,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#ECEDEE" }}>{cartItemCount} items</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{cartSubtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { setStep("store"); setCart([]); setSelectedStoreId(null); }}
                  style={{ backgroundColor: "#334155", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep("details")}
                  style={{ backgroundColor: "#00E5FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#151718" }}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* STEP 3: Customer Details */}
      {step === "details" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 4 }}>Customer Details</Text>
          <Text style={{ fontSize: 14, color: "#687076", marginBottom: 16 }}>Enter the caller's delivery information</Text>

          {/* Phone Number (FIRST - for auto-fill) */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>PHONE NUMBER * (enter first to auto-fill)</Text>
          <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: lookupDone ? "#22C55E" : "#334155", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 }}>
            <TextInput
              value={customerPhone}
              onChangeText={handlePhoneChange}
              placeholder="e.g. 089 123 4567"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#ECEDEE" }}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
          {lookupLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={{ fontSize: 12, color: "#687076" }}>Looking up customer...</Text>
            </View>
          )}
          {lookupMessage ? (
            <Text style={{ fontSize: 12, color: lookupMessage.startsWith("✅") ? "#22C55E" : "#687076", marginBottom: 12 }}>
              {lookupMessage}
            </Text>
          ) : <View style={{ height: 12 }} />}

          {/* Customer Name */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>CUSTOMER NAME *</Text>
          <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="e.g. John Murphy"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#ECEDEE" }}
              returnKeyType="next"
            />
          </View>

          {/* Delivery Address */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>DELIVERY ADDRESS *</Text>
          <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="e.g. 12 Main Street, Balbriggan"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#ECEDEE" }}
              multiline
              returnKeyType="next"
            />
          </View>

          {/* Eircode */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>EIRCODE * (for delivery fee)</Text>
          <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: feeInfo ? "#22C55E" : "#334155", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 }}>
            <TextInput
              value={deliveryEircode}
              onChangeText={handleEircodeChange}
              placeholder="e.g. K32 AB12"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#ECEDEE" }}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>
          {feeLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={{ fontSize: 12, color: "#687076" }}>Calculating delivery fee...</Text>
            </View>
          )}
          {feeError ? (
            <Text style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{feeError}</Text>
          ) : null}
          {!feeLoading && !feeError && deliveryEircode.replace(/\s+/g, "").length >= 5 && !feeInfo && (
            <TouchableOpacity onPress={calculateFees} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#00E5FF", fontWeight: "600" }}>Tap to calculate delivery fee</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 4 }} />

          {/* Fee Preview Box */}
          {feeInfo && (
            <View style={{
              backgroundColor: "#0a2a1f",
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: "#22C55E",
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#22C55E", marginBottom: 8 }}>💰 COST BREAKDOWN (tell customer)</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Items subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{cartSubtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Service fee (10%)</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.serviceFee.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Delivery ({feeInfo.distance.toFixed(1)} km)</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 6 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#22C55E" }}>€{feeInfo.total.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Payment Method */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>PAYMENT METHOD</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setPaymentMethod("cash_on_delivery")}
              style={{
                flex: 1,
                backgroundColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#151718",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#334155",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: paymentMethod === "cash_on_delivery" ? "#151718" : "#ECEDEE" }}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPaymentMethod("card")}
              style={{
                flex: 1,
                backgroundColor: paymentMethod === "card" ? "#00E5FF" : "#151718",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: paymentMethod === "card" ? "#00E5FF" : "#334155",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: paymentMethod === "card" ? "#151718" : "#ECEDEE" }}>Card</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>NOTES (Optional)</Text>
          <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={customerNotes}
              onChangeText={setCustomerNotes}
              placeholder="e.g. Ring doorbell, leave at gate..."
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#ECEDEE", minHeight: 60 }}
              multiline
            />
          </View>

          {/* Substitution */}
          <TouchableOpacity
            onPress={() => setAllowSubstitution(!allowSubstitution)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#151718",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: allowSubstitution ? "#00E5FF" : "#334155",
              marginBottom: 24,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 4,
              backgroundColor: allowSubstitution ? "#00E5FF" : "transparent",
              borderWidth: 2, borderColor: allowSubstitution ? "#00E5FF" : "#687076",
              alignItems: "center", justifyContent: "center",
            }}>
              {allowSubstitution && <Text style={{ fontSize: 14, fontWeight: "800", color: "#151718" }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 14, color: "#ECEDEE" }}>Customer allows substitutions</Text>
          </TouchableOpacity>

          {/* Navigation */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setStep("products")}
              style={{ flex: 1, backgroundColor: "#334155", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
                  setSubmitError("Please fill in name, phone, address, and Eircode.");
                  return;
                }
                setSubmitError("");
                // Calculate fees if not done yet
                if (!feeInfo && deliveryEircode.trim().length >= 5) {
                  calculateFees();
                }
                setStep("confirm");
              }}
              style={{ flex: 1, backgroundColor: "#00E5FF", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#151718" }}>Review Order</Text>
            </TouchableOpacity>
          </View>

          {submitError ? (
            <Text style={{ fontSize: 13, color: "#EF4444", marginTop: 10, textAlign: "center" }}>{submitError}</Text>
          ) : null}
        </ScrollView>
      )}

      {/* STEP 4: Confirmation */}
      {step === "confirm" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 16 }}>Review Order</Text>

          {/* Store */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 4 }}>STORE</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE" }}>{selectedStoreName}</Text>
          </View>

          {/* Customer */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 4 }}>CUSTOMER</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>{customerName}</Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6" }}>{customerPhone}</Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginTop: 4 }}>{deliveryAddress}</Text>
            {deliveryEircode ? <Text style={{ fontSize: 14, color: "#9BA1A6" }}>{deliveryEircode}</Text> : null}
          </View>

          {/* Items */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 8 }}>ITEMS ({cartItemCount})</Text>
            {cart.map(item => (
              <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#334155" }}>
                <Text style={{ fontSize: 14, color: "#ECEDEE", flex: 1 }} numberOfLines={1}>{item.quantity}x {item.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Price Breakdown */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 8 }}>PRICE BREAKDOWN</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{cartSubtotal.toFixed(2)}</Text>
            </View>
            {feeInfo ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Service Fee (10%)</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.serviceFee.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Delivery Fee ({feeInfo.distance.toFixed(1)} km)</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.deliveryFee.toFixed(2)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 6 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{feeInfo.total.toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: "#F59E0B", marginTop: 4 }}>
                  ⚠️ Delivery fee not yet calculated. Fees will be calculated on submit.
                </Text>
                {!feeLoading && (
                  <TouchableOpacity onPress={calculateFees} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: "#00E5FF", fontWeight: "600" }}>Calculate Fees Now</Text>
                  </TouchableOpacity>
                )}
                {feeLoading && <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 8 }} />}
              </>
            )}
          </View>

          {/* Payment & Options */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Payment</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>{paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Card"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Substitutions</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: allowSubstitution ? "#22C55E" : "#9BA1A6" }}>
                {allowSubstitution ? "Allowed" : "Not allowed"}
              </Text>
            </View>
            {customerNotes ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 14, color: "#687076" }}>Notes</Text>
                <Text style={{ fontSize: 14, color: "#ECEDEE", fontStyle: "italic", marginTop: 2 }}>{customerNotes}</Text>
              </View>
            ) : null}
          </View>

          {/* Order Source Badge */}
          <View style={{ backgroundColor: "#DBEAFE", padding: 10, borderRadius: 10, marginBottom: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#2563EB" }}>📞 Phone Order — entered by staff</Text>
          </View>

          {/* Error message */}
          {submitError ? (
            <Text style={{ fontSize: 13, color: "#EF4444", marginBottom: 10, textAlign: "center" }}>{submitError}</Text>
          ) : null}

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setStep("details")}
              style={{ flex: 1, backgroundColor: "#334155", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                backgroundColor: submitting ? "#687076" : "#22C55E",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Create Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Confirm Modal Overlay */}
      {ConfirmOverlay}
    </ScreenContainer>
  );
}
