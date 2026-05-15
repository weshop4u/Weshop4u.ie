import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, FlatList, Platform, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getApiBaseUrl } from "@/constants/oauth";
import { useColors } from "@/hooks/use-colors";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  ageRestricted?: boolean;
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

function PhoneOrderScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Store selection
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState("");

  // Product search, categories, and cart
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryEircode, setDeliveryEircode] = useState("");
  const [customerDOB, setCustomerDOB] = useState("");
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
  const [orderResult, setOrderResult] = useState<{ orderId: number; orderNumber: string; total: number; distance: number; serviceFee: number; deliveryFee: number; subtotal: number; paymentMethod: string } | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Queries
  const { data: storesList, isLoading: storesLoading } = trpc.admin.getStores.useQuery();
  
  // Debounce search query for API calls
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  const { data: productsData, isLoading: productsLoading } = trpc.admin.getStoreProducts.useQuery(
    { storeId: selectedStoreId!, search: debouncedSearch.trim() || undefined },
    { enabled: selectedStoreId !== null }
  );

  // Filter products by category and search
  const productsList = useMemo(() => {
    const products = productsData?.products || [];
    return products.filter(p => {
      const matchesCategory = !selectedCategoryId || p.categoryId === selectedCategoryId;
      return matchesCategory;
    });
  }, [productsData, selectedCategoryId]);

  const categoriesList = useMemo(() => {
    return productsData?.categories || [];
  }, [productsData]);

  const createPhoneOrderMutation = trpc.admin.createPhoneOrder.useMutation();
  const calculateFeesMutation = trpc.admin.calculatePhoneOrderFees.useMutation();

  // Cart calculations
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const hasAgeRestrictedItems = useMemo(() => cart.some(item => item.ageRestricted), [cart]);

  const addToCart = (product: { id: number; name: string; price: string; ageRestricted?: boolean }) => {
    const existing = cart.find(c => c.productId === product.id);
    if (existing) {
      setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1, ageRestricted: product.ageRestricted }]);
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
    setDeliveryEircode(text.toUpperCase());
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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      if (eircodeDebounceRef.current) clearTimeout(eircodeDebounceRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // ===== ORDER SUBMISSION =====
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
        customerDOB: hasAgeRestrictedItems ? customerDOB : undefined,
      });

      // For card payments, redirect to Elavon payment page
      if (paymentMethod === "card") {
        setOrderResult({
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          total: data.total,
          distance: data.distance,
          serviceFee: data.serviceFee,
          deliveryFee: data.deliveryFee,
          subtotal: data.subtotal,
          paymentMethod: "card",
        });
        router.push(`/payment/${data.orderId}`);
        return;
      }

      setOrderResult({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        total: data.total,
        distance: data.distance,
        serviceFee: data.serviceFee,
        deliveryFee: data.deliveryFee,
        subtotal: data.subtotal,
        paymentMethod: "cash_on_delivery",
      });
    } catch (e: any) {
      setSubmitting(false);
      setSubmitError(e.message || "Failed to create order");
    }
  }, [selectedStoreId, cart, customerName, customerPhone, deliveryAddress, deliveryEircode, customerDOB, paymentMethod, customerNotes, allowSubstitution, feeInfo, hasAgeRestrictedItems]);

  // ===== ORDER SUCCESS SCREEN =====
  if (orderResult) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 + insets.bottom, alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 8, textAlign: "center" }}>Order Created!</Text>
          <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 24, textAlign: "center" }}>
            {orderResult.orderNumber}
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 400, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Service Fee (10%)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.serviceFee.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Delivery Fee ({orderResult.distance.toFixed(1)} km)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Total</Text>
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

  // ===== CONFIRM MODAL =====
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
            disabled={submitting}
            style={{ flex: 2, backgroundColor: "#22C55E", padding: 14, borderRadius: 10, alignItems: "center", opacity: submitting ? 0.6 : 1 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
              {submitting ? "Creating..." : "Create Order"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;

  // ===== MAIN LAYOUT =====
  return (
    <ScreenContainer className="bg-background">
      {!selectedStoreId ? (
        // Store Selection Screen
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 + insets.bottom }}>
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
      ) : (
        // Main Single-Page Layout
        <View style={{ flex: 1, flexDirection: isDesktop ? "row" : "column" }}>
          {/* LEFT PANEL: Products (60% desktop, 100% mobile) */}
          <View style={{ flex: isDesktop ? 0.6 : 1, borderRightWidth: isDesktop ? 1 : 0, borderRightColor: "#334155", backgroundColor: "#151718" }}>
            {/* Header with Store Name */}
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155", backgroundColor: "#1e2022" }}>
              <TouchableOpacity onPress={() => { setSelectedStoreId(null); setCart([]); }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>← Change Store</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#ECEDEE" }}>{selectedStoreName}</Text>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#334155" }}>
              <View style={{ backgroundColor: "#1e2022", borderRadius: 8, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 10, paddingVertical: 8 }}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products..."
                  placeholderTextColor="#687076"
                  style={{ fontSize: 13, color: "#ECEDEE" }}
                  returnKeyType="search"
                />
              </View>
            </View>

            {/* Categories */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ borderBottomWidth: 1, borderBottomColor: "#334155" }}
              contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}
            >
              <TouchableOpacity
                onPress={() => setSelectedCategoryId(null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: selectedCategoryId === null ? "#00E5FF" : "#334155",
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: selectedCategoryId === null ? "700" : "600",
                  color: selectedCategoryId === null ? "#151718" : "#ECEDEE",
                }}>
                  All
                </Text>
              </TouchableOpacity>
              {categoriesList.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: selectedCategoryId === cat.id ? "#00E5FF" : "#334155",
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: selectedCategoryId === cat.id ? "700" : "600",
                    color: selectedCategoryId === cat.id ? "#151718" : "#ECEDEE",
                  }}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Products List */}
            {productsLoading ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color="#00E5FF" />
              </View>
            ) : (
              <FlatList
                data={productsList}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 10, paddingBottom: isDesktop ? 20 : 100 }}
                renderItem={({ item }) => {
                  const inCart = cart.find(c => c.productId === item.id);
                  return (
                    <View style={{
                      backgroundColor: "#1e2022",
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: inCart ? "#00E5FF" : "#334155",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#ECEDEE" }} numberOfLines={2}>
                          {item.name}
                          {item.ageRestricted && <Text style={{ color: "#EF4444" }}> 18+</Text>}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#00E5FF", marginTop: 2 }}>
                          €{parseFloat(item.price).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {inCart && (
                          <>
                            <TouchableOpacity
                              onPress={() => removeFromCart(item.id)}
                              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" }}
                            >
                              <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE" }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#ECEDEE", minWidth: 20, textAlign: "center" }}>
                              {inCart.quantity}
                            </Text>
                          </>
                        )}
                        <TouchableOpacity
                          onPress={() => addToCart(item)}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#151718" }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ color: "#687076" }}>
                      {searchQuery ? "No products found" : "No products available"}
                    </Text>
                  </View>
                }
              />
            )}
          </View>

          {/* RIGHT PANEL: Cart + Customer Details (40% desktop, 100% mobile stacked) */}
          <View style={{ flex: isDesktop ? 0.4 : 1, backgroundColor: "#151718" }}>
            <ScrollView
              contentContainerStyle={{
                padding: 12,
                paddingBottom: 20 + insets.bottom,
              }}
            >
              {/* Cart Summary */}
              <View style={{
                backgroundColor: "#1e2022",
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: "#334155",
                marginBottom: 16,
              }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#00E5FF", marginBottom: 8 }}>
                  CART ({cartItemCount} items)
                </Text>
                {cart.length === 0 ? (
                  <Text style={{ fontSize: 12, color: "#687076" }}>No items added</Text>
                ) : (
                  <>
                    {cart.map(item => (
                      <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: "#ECEDEE", flex: 1 }} numberOfLines={1}>
                          {item.name} × {item.quantity}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#00E5FF" }}>
                          €{(item.price * item.quantity).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 8 }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#ECEDEE" }}>Subtotal</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#00E5FF" }}>
                        €{cartSubtotal.toFixed(2)}
                      </Text>
                    </View>
                    {feeInfo && (
                      <>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                          <Text style={{ fontSize: 12, color: "#9BA1A6" }}>Service Fee (10%)</Text>
                          <Text style={{ fontSize: 12, color: "#9BA1A6" }}>€{feeInfo.serviceFee.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={{ fontSize: 12, color: "#9BA1A6" }}>Delivery ({feeInfo.distance.toFixed(1)} km)</Text>
                          <Text style={{ fontSize: 12, color: "#9BA1A6" }}>€{feeInfo.deliveryFee.toFixed(2)}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 8 }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: "#22C55E" }}>
                            €{feeInfo.total.toFixed(2)}
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>

              {/* Customer Details Form */}
              {cart.length > 0 && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#00E5FF", marginBottom: 8 }}>
                    CUSTOMER DETAILS
                  </Text>

                  {/* Phone */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>
                    PHONE * (auto-fills name)
                  </Text>
                  <View style={{
                    backgroundColor: "#1e2022",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: lookupDone ? "#22C55E" : "#334155",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 4,
                  }}>
                    <TextInput
                      value={customerPhone}
                      onChangeText={handlePhoneChange}
                      placeholder="089 123 4567"
                      placeholderTextColor="#687076"
                      style={{ fontSize: 13, color: "#ECEDEE" }}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                    />
                  </View>
                  {lookupLoading && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
                      <ActivityIndicator size="small" color="#00E5FF" />
                      <Text style={{ fontSize: 11, color: "#687076" }}>Looking up...</Text>
                    </View>
                  )}
                  {lookupMessage && (
                    <Text style={{
                      fontSize: 11,
                      color: lookupMessage.startsWith("✅") ? "#22C55E" : "#687076",
                      marginBottom: 8,
                    }}>
                      {lookupMessage}
                    </Text>
                  )}

                  {/* Name */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>
                    NAME *
                  </Text>
                  <View style={{
                    backgroundColor: "#1e2022",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#334155",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 12,
                  }}>
                    <TextInput
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="John Murphy"
                      placeholderTextColor="#687076"
                      style={{ fontSize: 13, color: "#ECEDEE" }}
                      returnKeyType="next"
                    />
                  </View>

                  {/* Address */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>
                    ADDRESS *
                  </Text>
                  <View style={{
                    backgroundColor: "#1e2022",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#334155",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 12,
                  }}>
                    <TextInput
                      value={deliveryAddress}
                      onChangeText={setDeliveryAddress}
                      placeholder="12 Main Street, Balbriggan"
                      placeholderTextColor="#687076"
                      style={{ fontSize: 13, color: "#ECEDEE", minHeight: 60 }}
                      multiline
                      returnKeyType="next"
                    />
                  </View>

                  {/* Eircode */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>
                    EIRCODE * (for fees)
                  </Text>
                  <View style={{
                    backgroundColor: "#1e2022",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: feeInfo ? "#22C55E" : "#334155",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 4,
                  }}>
                    <TextInput
                      value={deliveryEircode}
                      onChangeText={handleEircodeChange}
                      placeholder="K32 AB12"
                      placeholderTextColor="#687076"
                      style={{ fontSize: 13, color: "#ECEDEE" }}
                      autoCapitalize="characters"
                      returnKeyType="next"
                    />
                  </View>
                  {feeLoading && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
                      <ActivityIndicator size="small" color="#00E5FF" />
                      <Text style={{ fontSize: 11, color: "#687076" }}>Calculating...</Text>
                    </View>
                  )}
                  {feeError && (
                    <Text style={{ fontSize: 11, color: "#EF4444", marginBottom: 8 }}>{feeError}</Text>
                  )}
                  {!feeLoading && !feeError && deliveryEircode.replace(/\s+/g, "").length >= 5 && !feeInfo && (
                    <TouchableOpacity onPress={calculateFees} style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: "#00E5FF", fontWeight: "600" }}>Calculate delivery fee</Text>
                    </TouchableOpacity>
                  )}

                  {/* Age Verification (conditional) */}
                  {hasAgeRestrictedItems && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444", marginBottom: 4 }}>
                        DOB * (18+ items in cart)
                      </Text>
                      <View style={{
                        backgroundColor: "#1e2022",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#334155",
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        marginBottom: 12,
                      }}>
                        <TextInput
                          value={customerDOB}
                          onChangeText={setCustomerDOB}
                          placeholder="DD-MM-YYYY"
                          placeholderTextColor="#687076"
                          style={{ fontSize: 13, color: "#ECEDEE" }}
                          keyboardType="number-pad"
                          returnKeyType="next"
                        />
                      </View>
                    </>
                  )}

                  {/* Payment Method */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 6 }}>
                    PAYMENT
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setPaymentMethod("cash_on_delivery")}
                      style={{
                        flex: 1,
                        backgroundColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#1e2022",
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#334155",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: paymentMethod === "cash_on_delivery" ? "#151718" : "#ECEDEE",
                      }}>
                        Cash
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPaymentMethod("card")}
                      style={{
                        flex: 1,
                        backgroundColor: paymentMethod === "card" ? "#00E5FF" : "#1e2022",
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: paymentMethod === "card" ? "#00E5FF" : "#334155",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: paymentMethod === "card" ? "#151718" : "#ECEDEE",
                      }}>
                        Card
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Notes */}
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#687076", marginBottom: 4 }}>
                    NOTES
                  </Text>
                  <View style={{
                    backgroundColor: "#1e2022",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#334155",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 12,
                  }}>
                    <TextInput
                      value={customerNotes}
                      onChangeText={setCustomerNotes}
                      placeholder="Special requests..."
                      placeholderTextColor="#687076"
                      style={{ fontSize: 13, color: "#ECEDEE", minHeight: 50 }}
                      multiline
                    />
                  </View>

                  {/* Substitution */}
                  <TouchableOpacity
                    onPress={() => setAllowSubstitution(!allowSubstitution)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}
                  >
                    <View style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      backgroundColor: allowSubstitution ? "#00E5FF" : "#334155",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {allowSubstitution && <Text style={{ fontSize: 12, fontWeight: "700", color: "#151718" }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: "#ECEDEE" }}>Allow substitutions</Text>
                  </TouchableOpacity>

                  {/* Error Message */}
                  {submitError && (
                    <View style={{ backgroundColor: "#3a1f1f", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#EF4444" }}>
                      <Text style={{ fontSize: 12, color: "#EF4444" }}>{submitError}</Text>
                    </View>
                  )}

                  {/* Submit Button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
                        setSubmitError("Please fill in all required fields");
                        return;
                      }
                      if (hasAgeRestrictedItems && !customerDOB.trim()) {
                        setSubmitError("Please enter customer DOB for age-restricted items");
                        return;
                      }
                      if (!feeInfo) {
                        setSubmitError("Please calculate delivery fee first");
                        return;
                      }
                      setSubmitError("");
                      setShowConfirmModal(true);
                    }}
                    disabled={submitting || cart.length === 0}
                    style={{
                      backgroundColor: cart.length === 0 ? "#334155" : "#22C55E",
                      padding: 12,
                      borderRadius: 8,
                      alignItems: "center",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: cart.length === 0 ? "#687076" : "#fff",
                    }}>
                      {submitting ? "Creating..." : "Create Order"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {ConfirmOverlay}
    </ScreenContainer>
  );
}

export default function PhoneOrderScreen() {
  return (
    <AdminDesktopLayout title="Create Phone Order">
      <PhoneOrderScreenContent />
    </AdminDesktopLayout>
  );
}
