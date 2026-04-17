import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useCart, CartItemModifier, getItemUnitPrice } from "@/lib/cart-provider";
import { isStoreOpen, getTodayHours, getNextOpenTime, getWeeklyHoursSummary } from "@/lib/store-hours";
import { isCategoryAvailable, getAvailabilityMessage, getTodayAvailability } from "@/lib/category-availability";
import * as Haptics from "expo-haptics";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenWrapper } from "@/components/native-wrapper";
import { HighlightText } from "@/components/highlight-text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebLayoutScrollRef } from "@/components/web-layout";

type SortOption = "az" | "za" | "price_low" | "price_high";
type CategorySortOption = "popular" | "az" | "za";

// Custom category priority order — user-defined tiers, then rest alphabetically
const CATEGORY_PRIORITY_ORDER = [
  "Deli",
  "Fizzy Drinks",
  "Energy Drinks",
  "Water and Flavoured Water",
  "Chocolate Bars",
  "Chocolates Multi packs and Boxes",
  "Crisps and Nuts",
  "Biscuits and Cookies",
  "Tobacco and Cigars and Papers",
  "Vapes and Vape Oils",
  "Spirits",
  "Cans and Bottles",
  "Flavored Alcohol",
  "Wines",
  "Nicotine Products",
];

export default function StoreDetailScreen() {
  const { id, categoryId: categoryIdParam, productSearch: productSearchParam } = useLocalSearchParams<{ id: string; categoryId?: string; productSearch?: string }>();
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    categoryIdParam ? parseInt(categoryIdParam) : null
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySortBy, setCategorySortBy] = useState<CategorySortOption>("popular");
  const [productSearch, setProductSearch] = useState(productSearchParam || "");
  const [globalSearch, setGlobalSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const categoryScrollRef = useRef<ScrollView>(null);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const [showHours, setShowHours] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("az");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalQuantity, setModalQuantity] = useState(1);
  const insets = useSafeAreaInsets();
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, number[]>>({}); // groupId -> modifierIds
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>({}); // "groupId_modId" -> quantity (for allowOptionQuantity groups)
  const { cart, addToCart, clearCart, getItemCount, getProductQuantity: cartGetProductQuantity } = useCart();
  
  const storeId = parseInt(id);
  const { data: store, isLoading: storeLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const { data: productsData, isLoading: productsLoading } = trpc.stores.getProducts.useQuery({ storeId, limit: 5000 });
  const products = productsData?.items || [];
  const { data: trendingProducts } = trpc.store.getTrendingProducts.useQuery({ storeId, limit: 10 });

  const storeOpen = store ? isStoreOpen(store) : true;
  const todayHours = store ? getTodayHours(store) : null;
  const nextOpen = store && !storeOpen ? getNextOpenTime(store) : null;
  const weeklyHours = store ? getWeeklyHoursSummary(store) : [];

  const handleAddToCart = async (productId: number, productName: string, productPrice: string, categorySchedule?: string | null, qty: number = 1) => {
    if (!storeOpen) {
      Alert.alert(
        "Store Closed",
        `${store?.name} is currently closed. ${nextOpen || "Please check back later."}`,
        [{ text: "OK" }]
      );
      return;
    }

    // Check category availability
    if (categorySchedule && !isCategoryAvailable(categorySchedule)) {
      const msg = getAvailabilityMessage(categorySchedule) || "This product is not available right now.";
      Alert.alert("Not Available", msg, [{ text: "OK" }]);
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const success = await addToCart(storeId, store?.name || "Store", {
      productId,
      productName,
      productPrice,
      quantity: qty,
    });

    if (!success) {
      Alert.alert(
        "Replace cart items?",
        `You have items from ${cart.storeName} in your cart.\n\nAdding items from ${store?.name} will remove your current cart.`,
        [
          { text: "Keep Current Cart", style: "cancel" },
          {
            text: "Start New Cart",
            onPress: () => {
              clearCart();
              addToCart(storeId, store?.name || "Store", {
                productId,
                productName,
                productPrice,
                quantity: qty,
              });
            },
          },
        ]
      );
    }
  };

  const cartItemCount = getItemCount();

  // Group products by category - memoized to prevent flickering from re-renders
  const categoriesWithProducts = useMemo(() => {
    if (!products || products.length === 0) return {} as Record<number, { id: number; name: string; icon: string | null; ageRestricted: boolean; availabilitySchedule: string | null; products: typeof products }>;
    return products.reduce((acc, product) => {
      if (!product.categoryId) return acc;
      
      if (!acc[product.categoryId]) {
        acc[product.categoryId] = {
          id: product.categoryId,
          name: product.category?.name || "Uncategorized",
          icon: product.category?.icon || null,
          ageRestricted: product.category?.ageRestricted || false,
          availabilitySchedule: product.category?.availabilitySchedule || null,
          products: [],
        };
      }
      acc[product.categoryId].products.push(product);
      return acc;
    }, {} as Record<number, { id: number; name: string; icon: string | null; ageRestricted: boolean; availabilitySchedule: string | null; products: typeof products }>);
  }, [products]);

  const categories = useMemo(() => Object.values(categoriesWithProducts), [categoriesWithProducts]);

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let result = [...categories];
    const searchTerm = globalSearch.trim() || categorySearch.trim();
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter((category) =>
        category.name.toLowerCase().includes(query)
      );
    }
    // Sort categories
    switch (categorySortBy) {
      case "popular":
        // Use custom priority order: priority categories first, then rest alphabetically
        result.sort((a, b) => {
          const aIdx = CATEGORY_PRIORITY_ORDER.indexOf(a.name);
          const bIdx = CATEGORY_PRIORITY_ORDER.indexOf(b.name);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
        break;
      case "az":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
    return result;
  }, [categories, categorySearch, globalSearch, categorySortBy]);

  // Search products across all categories (for global search)
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const query = globalSearch.toLowerCase().trim();
    const results: Array<{ product: any; categoryName: string; categoryId: number; categorySchedule: string | null }> = [];
    for (const cat of categories) {
      for (const product of cat.products) {
        if (
          product.name.toLowerCase().includes(query) ||
          (product.description?.toLowerCase().includes(query) || false)
        ) {
          results.push({
            product,
            categoryName: cat.name,
            categoryId: cat.id,
            categorySchedule: cat.availabilitySchedule,
          });
        }
      }
    }
    // Sort by name
    results.sort((a, b) => a.product.name.localeCompare(b.product.name));
    return results.slice(0, 50); // Limit to 50 results
  }, [categories, globalSearch]);

  // These hooks MUST be before any conditional returns to avoid hooks ordering errors
  const selectedCategory = selectedCategoryId !== null ? categoriesWithProducts[selectedCategoryId] : null;
  const categoryProducts = selectedCategory?.products || [];
  const catAvailable = isCategoryAvailable(selectedCategory?.availabilitySchedule);
  const catAvailMsg = getAvailabilityMessage(selectedCategory?.availabilitySchedule);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = categoryProducts;
    
    // Filter by search
    if (productSearch.trim()) {
      const query = productSearch.toLowerCase().trim();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(query) ||
        (product.description?.toLowerCase().includes(query) || false)
      );
    }
    
    // Sort — use custom sortOrder as primary, then apply user-selected secondary sort
    const sorted = [...result];
    sorted.sort((a, b) => {
      const aOrder = (a as any).sortOrder ?? 999;
      const bOrder = (b as any).sortOrder ?? 999;
      // If both have custom sort orders (not default 999), respect them
      if (aOrder !== 999 || bOrder !== 999) {
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      // Then apply user-selected sort
      switch (sortBy) {
        case "az":
          return a.name.localeCompare(b.name);
        case "za":
          return b.name.localeCompare(a.name);
        case "price_low":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price_high":
          return parseFloat(b.price) - parseFloat(a.price);
        default:
          return 0;
      }
    });
    return sorted;
  }, [categoryProducts, productSearch, sortBy]);

  const getProductImage = (product: any): string | null => {
    // Try images array first
    if (product.images && product.images.length > 0) {
      return product.images[0];
    }
    // Fallback to image field (single image)
    if (product.image) {
      return product.image;
    }
    // Fallback to imageUrl field
    if (product.imageUrl) {
      return product.imageUrl;
    }
    return null;
  };

  const getProductQuantity = (productId: number): number => {
    const qty = cartGetProductQuantity(productId);
    return qty || 0;
  };

  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    AsyncStorage.setItem(`recentSearches_${storeId}`, JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(`recentSearches_${storeId}`);
  };

  const openProductDetail = (product: any) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const renderProductModal = () => {
    if (!selectedProduct || !modalVisible) return null;
    const modifierGroups = selectedProduct.modifierGroups || [];
    const modifierData = modifierGroups.map((group: any) => ({
      ...group,
      selectedModifiers: selectedModifiers[group.id] || [],
    }));

    return (
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              {selectedProduct.images && selectedProduct.images[0] && (
                <Image source={{ uri: selectedProduct.images[0] }} style={styles.productImage} contentFit="contain" />
              )}

              <View style={styles.productDetails}>
                <Text style={styles.productName}>{selectedProduct.name}</Text>
                {selectedProduct.description && (
                  <Text style={styles.productDescription}>{selectedProduct.description}</Text>
                )}
                <Text style={styles.productPrice}>€{parseFloat(selectedProduct.price).toFixed(2)}</Text>

                {modifierData.length > 0 && (
                  <View style={styles.modifiersContainer}>
                    {modifierData.map((group: any) => (
                      <View key={group.id} style={styles.modifierGroup}>
                        <Text style={styles.modifierGroupTitle}>
                          {group.name} {group.required ? "*" : ""}
                        </Text>
                        <View style={styles.modifierOptions}>
                          {group.modifiers.map((modifier: any) => {
                            const isSelected = selectedModifiers[group.id]?.includes(modifier.id);
                            const quantity = optionQuantities[`${group.id}_${modifier.id}`] || 1;
                            return (
                              <TouchableOpacity
                                key={modifier.id}
                                onPress={() => {
                                  const updated = isSelected
                                    ? selectedModifiers[group.id].filter((id: number) => id !== modifier.id)
                                    : [...(selectedModifiers[group.id] || []), modifier.id];
                                  setSelectedModifiers({ ...selectedModifiers, [group.id]: updated });
                                }}
                                style={[styles.modifierOption, isSelected && styles.modifierOptionSelected]}
                              >
                                <Text style={[styles.modifierText, isSelected && styles.modifierTextSelected]}>
                                  {modifier.name} +€{parseFloat(modifier.price).toFixed(2)}
                                </Text>
                                {isSelected && group.allowOptionQuantity && (
                                  <View style={styles.quantityControl}>
                                    <TouchableOpacity onPress={() => setOptionQuantities({ ...optionQuantities, [`${group.id}_${modifier.id}`]: Math.max(1, quantity - 1) })}>
                                      <Text style={styles.quantityButtonText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.quantityText}>{quantity}</Text>
                                    <TouchableOpacity onPress={() => setOptionQuantities({ ...optionQuantities, [`${group.id}_${modifier.id}`]: quantity + 1 })}>
                                      <Text style={styles.quantityButtonText}>+</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                const modifierPrice = modifierData.reduce((sum: number, group: any) => {
                  return sum + (group.selectedModifiers || []).reduce((groupSum: number, modId: number) => {
                    const mod = group.modifiers.find((m: any) => m.id === modId);
                    const qty = optionQuantities[`${group.id}_${modId}`] || 1;
                    return groupSum + (mod ? parseFloat(mod.price) * qty : 0);
                  }, 0);
                }, 0);

                const totalPrice = (parseFloat(selectedProduct.price) + modifierPrice).toFixed(2);
                handleAddToCart(selectedProduct.id, selectedProduct.name, totalPrice, selectedCategory?.availabilitySchedule, modalQuantity);
                setModalVisible(false);
                setSelectedModifiers({});
                setOptionQuantities({});
                setModalQuantity(1);
              }}
              style={styles.addToCartButton}
            >
              <Text style={styles.addToCartText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  useEffect(() => {
    const defaults: Record<number, number[]> = {};
    const modifierGroups = selectedProduct?.modifierGroups || [];
    for (const group of modifierGroups) {
      if (group.required && group.modifiers.length > 0) {
        defaults[group.id] = [group.modifiers[0].id];
      }
    }
    setSelectedModifiers(defaults);
  }, [selectedProduct?.id, modalVisible]);

  // Scroll to top when category selection changes
  useEffect(() => {
    if (selectedCategoryId !== null) {
      setTimeout(() => {
        WebLayoutScrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 50);
    }
  }, [selectedCategoryId]);


  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(`recentSearches_${storeId}`).then((data) => {
      if (data) setRecentSearches(JSON.parse(data));
    });
  }, [storeId]);

  if (storeLoading || productsLoading) {
    return (
      <ScreenWrapper>
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color="#00E5FF" />
        </ScreenContainer>
      </ScreenWrapper>
    );
  }

  if (!store) {
    return (
      <ScreenWrapper>
        <ScreenContainer className="items-center justify-center">
          <Text className="text-foreground">Store not found</Text>
        </ScreenContainer>
      </ScreenWrapper>
    );
  }

  // Sort pill component - defined before return so it's available in both views
  const SortPill = ({ label, value }: { label: string; value: SortOption }) => {
    const isActive = sortBy === value;
    return (
      <TouchableOpacity
        onPress={() => {
          setSortBy(value);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={[
          styles.sortPill,
          isActive && styles.sortPillActive,
        ]}
      >
        <Text style={[
          styles.sortPillText,
          isActive && styles.sortPillTextActive,
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper>
      <ScreenContainer className="bg-background">
        {renderProductModal()}

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
          {selectedCategoryId === null ? (
            <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
              <Text className="text-primary text-2xl">‹ Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => { setSelectedCategoryId(null); setProductSearch(""); setSortBy("az"); }}
              className="active:opacity-70"
            >
              <Text className="text-primary text-2xl">‹ Categories</Text>
            </TouchableOpacity>
          )}

          {cartItemCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push(`/cart/${cart.storeId}` as any)}
              className="active:opacity-70"
            >
              <View className="relative">
                <Text className="text-3xl">🛒</Text>
                <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
                  <Text className="text-background text-xs font-bold">{cartItemCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Single ScrollView for both views */}
        <ScrollView
          ref={mainScrollViewRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {selectedCategoryId === null ? (
            // ── CATEGORY LIST VIEW ──
            <>
              {/* Store Header */}
              <View className="px-4 pt-4 pb-2">
                <View className="flex-row items-center gap-3 mb-2">
                  <Text className="text-3xl font-bold text-foreground">{store.name}</Text>
                  <View style={{ backgroundColor: storeOpen ? "#DCFCE7" : "#FEF2F2", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: storeOpen ? "#16A34A" : "#DC2626" }}>
                      {storeOpen ? "Open" : "Closed"}
                    </Text>
                  </View>
                </View>
                {store.address && (
                  <Text className="text-sm text-muted mb-1">{store.address}</Text>
                )}
              </View>

              {/* Store Hours */}
              <View className="px-4 pb-4">
                <TouchableOpacity onPress={() => setShowHours(!showHours)} className="active:opacity-70">
                  <View className="flex-row items-center gap-2">
                    <Text style={{ fontSize: 13, color: storeOpen ? "#16A34A" : "#DC2626", fontWeight: "600" }}>
                      {todayHours || "Hours not set"}
                    </Text>
                    <Text className="text-muted text-xs">{showHours ? "▲" : "▼"}</Text>
                  </View>
                  {!storeOpen && nextOpen && (
                    <Text style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>{nextOpen}</Text>
                  )}
                </TouchableOpacity>
                {showHours && weeklyHours.length > 0 && (
                  <View className="mt-3 bg-surface rounded-xl p-3 border border-border">
                    {weeklyHours.map((item, index) => {
                      const isToday = index === new Date().getDay();
                      return (
                        <View
                          key={item.day}
                          className="flex-row justify-between py-1.5"
                          style={isToday ? { backgroundColor: "rgba(0,229,255,0.08)", marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 6 } : undefined}
                        >
                          <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "400", color: isToday ? "#00E5FF" : "#687076" }}>
                            {item.day}{isToday ? " (Today)" : ""}
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "400", color: item.hours === "Closed" ? "#DC2626" : (isToday ? "#00E5FF" : "#687076") }}>
                            {item.hours}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Closed Banner */}
              {!storeOpen && (
                <View className="mx-4 mb-4 p-4 rounded-xl" style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#DC2626", marginBottom: 2 }}>
                    This store is currently closed
                  </Text>
                  <Text style={{ fontSize: 13, color: "#991B1B" }}>
                    You can browse the menu but ordering is not available right now.{nextOpen ? ` ${nextOpen}.` : ""}
                  </Text>
                </View>
              )}

              {/* Search Bar */}
              <View className="px-4 mb-4">
                <TextInput
                  style={{ backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, color: '#11181C', fontSize: 16 }}
                  placeholder="Search products and categories..."
                  placeholderTextColor="#9BA1A6"
                  value={globalSearch}
                  onChangeText={(text) => {
                    setGlobalSearch(text);
                    setCategorySearch("");
                    if (text.trim().length > 0) setShowRecentSearches(false);
                  }}
                  onFocus={() => {
                    setSearchFocused(true);
                    if (globalSearch.trim().length === 0 && recentSearches.length > 0) setShowRecentSearches(true);
                  }}
                  onBlur={() => { setTimeout(() => { setShowRecentSearches(false); setSearchFocused(false); }, 200); }}
                  onSubmitEditing={() => { if (globalSearch.trim().length >= 2) saveRecentSearch(globalSearch); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {/* Recent Searches */}
                {showRecentSearches && recentSearches.length > 0 && globalSearch.trim().length === 0 && (
                  <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, marginTop: 4, paddingVertical: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076" }}>Recent Searches</Text>
                      <TouchableOpacity onPress={clearRecentSearches}>
                        <Text style={{ fontSize: 12, color: "#00BCD4", fontWeight: "600" }}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    {recentSearches.map((term, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => { setGlobalSearch(term); setCategorySearch(""); setShowRecentSearches(false); }}
                        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                      >
                        <Text style={{ fontSize: 16, color: "#9BA1A6" }}>🕒</Text>
                        <Text style={{ fontSize: 14, color: "#11181C", flex: 1 }}>{term}</Text>
                        <Text style={{ fontSize: 14, color: "#9BA1A6" }}>↗</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Autocomplete Results */}
                {searchFocused && globalSearch.trim().length > 0 && globalSearchResults.length > 0 && (
                  <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, marginTop: 4, maxHeight: 300, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                    <ScrollView>
                      {globalSearchResults.map((result, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            openProductDetail(result.product);
                            setGlobalSearch("");
                            setSearchFocused(false);
                          }}
                          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
                        >
                          <Text style={{ fontSize: 16 }}>🔍</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>{result.product.name}</Text>
                            <Text style={{ fontSize: 12, color: "#9BA1A6" }}>{result.categoryName}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#00E5FF" }}>€{parseFloat(result.product.price).toFixed(2)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Global Search Results */}
              {globalSearch.trim().length > 0 && globalSearchResults.length > 0 && (
                <View className="px-4">
                  <Text className="text-lg font-bold text-foreground mb-3">Search Results</Text>
                  <View className="gap-3">
                    {globalSearchResults.map((result, idx) => {
                      const qty = getProductQuantity(result.product.id);
                      const itemImage = getProductImage(result.product);
                      const fullProduct = result.product;
                      return (
                        <TouchableOpacity
                          key={`search-${result.product.id}-${idx}`}
                          onPress={() => { if (fullProduct) openProductDetail(fullProduct); }}
                          style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" }}
                        >
                          <View style={{ width: 150, height: 110, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" }}>
                            {itemImage ? (
                              <Image source={{ uri: itemImage }} style={{ width: 150, height: 110 }} contentFit="cover" />
                            ) : (
                              <Text style={{ fontSize: 36 }}>📦</Text>
                            )}
                          </View>
                          <View style={{ padding: 10, gap: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#11181C" }} numberOfLines={2}>{result.product.name}</Text>
                            <Text style={{ fontSize: 10, color: "#9BA1A6" }} numberOfLines={1}>{result.categoryName}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                              <Text style={{ fontSize: 15, fontWeight: "700", color: "#00E5FF" }}>€{parseFloat(result.product.price).toFixed(2)}</Text>
                              {qty > 0 ? (
                                <View style={{ backgroundColor: "#00E5FF", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{qty} in cart</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={(e) => { e.stopPropagation?.(); if (fullProduct?.hasModifiers) { if (fullProduct) openProductDetail(fullProduct); } else { handleAddToCart(result.product.id, result.product.name, result.product.price, result.categorySchedule); } }}
                                  style={{ backgroundColor: "#00E5FF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
                                >
                                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{fullProduct?.hasModifiers ? "Customise" : "+ Add"}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Trending Section */}
              {!(globalSearch.trim().length > 0 && globalSearchResults.length > 0) && (
                <View className="px-4">
                  {trendingProducts && trendingProducts.length > 0 && (
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text className="text-xl font-bold text-foreground">🔥 Trending Now</Text>
                        <Text className="text-xs text-muted">Based on recent orders</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {trendingProducts.map((item, index) => {
                          const itemImage = getProductImage(item);
                          const qty = getProductQuantity(item.id);
                          const fullProduct = item;
                          return (
                            <TouchableOpacity
                              key={`trending-${item.id}`}
                              onPress={() => { if (fullProduct) openProductDetail(fullProduct); }}
                              style={{ width: 150, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" }}
                            >
                              {index < 3 && (
                                <View style={{ position: "absolute", top: 8, left: 8, zIndex: 10, backgroundColor: index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : "#CD7F32", borderRadius: 10, width: 22, height: 22, justifyContent: "center", alignItems: "center" }}>
                                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>#{index + 1}</Text>
                                </View>
                              )}
                              <View style={{ width: 150, height: 110, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                                {itemImage ? (
                                  <Image 
                                    key={itemImage}
                                    source={{ uri: itemImage }} 
                                    style={{ width: 150, height: 110 }} 
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                  />
                                ) : (
                                  <Text style={{ fontSize: 36 }}>📦</Text>
                                )}
                              </View>
                              <View style={{ padding: 10, gap: 4 }}>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#11181C" }} numberOfLines={2}>{item.name}</Text>
                                <Text style={{ fontSize: 10, color: "#9BA1A6" }} numberOfLines={1}>{item.categoryName}</Text>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#00E5FF" }}>€{parseFloat(item.price).toFixed(2)}</Text>
                                  {qty > 0 ? (
                                    <View style={{ backgroundColor: "#00E5FF", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{qty} in cart</Text>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      onPress={(e) => { e.stopPropagation?.(); if (fullProduct?.hasModifiers) { if (fullProduct) openProductDetail(fullProduct); } else { handleAddToCart(item.id, item.name, item.price); } }}
                                      style={{ backgroundColor: "#00E5FF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
                                    >
                                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{fullProduct?.hasModifiers ? "Customise" : "+ Add"}</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                                  <Text style={{ fontSize: 10, color: "#9BA1A6" }}>🔥 {item.orderCount} ordered</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Browse by Category */}
              {!(globalSearch.trim().length > 0 && globalSearchResults.length > 0) && (
                <View className="px-4">
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text className="text-xl font-bold text-foreground">Browse by Category</Text>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {(["popular", "az", "za"] as CategorySortOption[]).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setCategorySortBy(opt)}
                          style={[{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 }, categorySortBy === opt ? { backgroundColor: "#00BCD4", borderColor: "#00BCD4" } : { backgroundColor: "transparent", borderColor: "#9BA1A6" }]}
                        >
                          <Text style={[{ fontSize: 11, fontWeight: "700" }, categorySortBy === opt ? { color: "#fff" } : { color: "#9BA1A6" }]}>
                            {opt === "popular" ? "Popular" : opt === "az" ? "A → Z" : "Z → A"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {filteredCategories.length > 0 ? (
                    <View className="gap-3">
                      {filteredCategories.map((category) => {
                        const catAvailable = isCategoryAvailable(category.availabilitySchedule);
                        const availMsg = getAvailabilityMessage(category.availabilitySchedule);
                        const todayAvail = getTodayAvailability(category.availabilitySchedule);
                        return (
                          <TouchableOpacity
                            key={category.id}
                            onPress={() => setSelectedCategoryId(category.id)}
                            className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                            style={!catAvailable ? { opacity: 0.55 } : undefined}
                          >
                            <View className="flex-row items-center gap-3">
                              <View className="w-14 h-14 bg-primary/10 rounded-xl overflow-hidden">
                                {category.icon ? (
                                  <Image source={{ uri: category.icon }} style={{ width: 56, height: 56 }} contentFit="cover" />
                                ) : (
                                  <View className="w-full h-full items-center justify-center">
                                    <Text className="text-3xl">📦</Text>
                                  </View>
                                )}
                              </View>
                              <View className="flex-1">
                                <View className="flex-row items-center gap-1.5">
                                  <Text className="text-lg font-semibold text-foreground" numberOfLines={1} style={{ flexShrink: 1 }}>{category.name}</Text>
                                  {category.ageRestricted && (
                                    <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                                    </View>
                                  )}
                                </View>
                                <Text className="text-sm text-muted">
                                  {category.products.length} {category.products.length === 1 ? 'item' : 'items'}
                                </Text>
                                {!catAvailable && availMsg && (
                                  <View className="flex-row items-center gap-1 mt-1">
                                    <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "600" }}>🕐 {availMsg}</Text>
                                  </View>
                                )}
                                {catAvailable && todayAvail && (
                                  <Text style={{ fontSize: 11, color: "#16A34A", marginTop: 2 }}>🕐 {todayAvail}</Text>
                                )}
                              </View>
                              <Text className="text-primary text-2xl">›</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    !globalSearch.trim() ? (
                      <View className="items-center py-8">
                        <Text className="text-muted text-center">No products available</Text>
                      </View>
                    ) : null
                  )}
                </View>
              )}
            </>
          ) : (
            // ── PRODUCT LIST VIEW ──
            <>
              {/* Category Header */}
              <View className="px-4 pt-4 pb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-3xl font-bold text-foreground">{selectedCategory?.name}</Text>
                  {selectedCategory?.ageRestricted && (
                    <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2 mt-1">
                  <Text className="text-sm text-muted">{store.name} · {filteredProducts.length} items</Text>
                  {!storeOpen && (
                    <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>Closed</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Category Availability Banner */}
              {!catAvailable && catAvailMsg && (
                <View className="mx-4 mb-3 p-3 rounded-xl" style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E" }}>🕐 {catAvailMsg}</Text>
                  <Text style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>You can browse but these items cannot be added to your cart right now.</Text>
                </View>
              )}

              {/* Product Search */}
              <View className="px-4 pt-3 pb-2">
                <TextInput
                  style={{ backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, color: '#11181C', fontSize: 16 }}
                  placeholder="Search products..."
                  placeholderTextColor="#9BA1A6"
                  value={productSearch}
                  onChangeText={setProductSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>

              {/* Sort Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
                <SortPill label="A → Z" value="az" />
                <SortPill label="Z → A" value="za" />
                <SortPill label="Price ↑" value="price_low" />
                <SortPill label="Price ↓" value="price_high" />
              </ScrollView>

              {/* Products */}
              <View className="px-4 pt-2">
                {filteredProducts.length > 0 ? (
                  <View className="gap-3">
                    {filteredProducts.map((product) => {
                      const quantity = getProductQuantity(product.id);
                      const isRestricted = !catAvailable;
                      const productImage = getProductImage(product);
                      return (
                        <TouchableOpacity
                          key={product.id}
                          onPress={() => openProductDetail(product)}
                          activeOpacity={0.7}
                          style={isRestricted ? { opacity: 0.45 } : undefined}
                        >
                          <View className="bg-surface rounded-xl p-4 border border-border">
                            <View className="flex-row justify-between items-start">
                              {productImage && (
                                <View style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", marginRight: 12 }}>
                                  <Image source={{ uri: productImage }} style={{ width: 64, height: 64 }} contentFit="cover" />
                                </View>
                              )}
                              <View className="flex-1 pr-3">
                                <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={2}>{product.name}</Text>
                                {product.description && (
                                  <Text className="text-sm text-muted mb-2" numberOfLines={2}>{product.description}</Text>
                                )}
                                <Text className="text-lg font-bold text-primary">€{parseFloat(product.price).toFixed(2)}</Text>
                                {product.isDrs && (
                                  <Text style={{ fontSize: 10, color: "#0EA5E9", fontWeight: "600", marginTop: 1 }}>Price incl. DRS deposit</Text>
                                )}
                                {product.stockStatus === "out_of_stock" && (
                                  <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "600", marginTop: 2 }}>Out of stock</Text>
                                )}
                              </View>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  if (product.hasModifiers) {
                                    openProductDetail(product);
                                  } else {
                                    handleAddToCart(product.id, product.name, product.price, selectedCategory?.availabilitySchedule);
                                  }
                                }}
                                style={[styles.quickAddButton, { backgroundColor: isRestricted || !storeOpen || product.stockStatus === "out_of_stock" ? "#9BA1A6" : "#00E5FF" }]}
                                disabled={product.stockStatus === "out_of_stock"}
                              >
                                <Text className="text-background font-semibold">
                                  {product.stockStatus === "out_of_stock" ? "N/A" : product.hasModifiers ? "Customise" : quantity > 0 ? `+${quantity}` : "Add"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View className="items-center py-8">
                    <Text className="text-muted">
                      {productSearch ? "No products match your search" : "No products in this category"}
                    </Text>
                    {productSearch && (
                      <TouchableOpacity onPress={() => setProductSearch("")} className="mt-4 bg-primary px-6 py-2 rounded-lg active:opacity-70">
                        <Text className="text-background font-semibold">Clear Search</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* View Cart Button */}
        {cartItemCount > 0 && cart.storeId === storeId && (
          <View style={[styles.cartButtonContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity onPress={() => router.push(`/cart/${storeId}` as any)} style={styles.cartButton}>
              <Text style={styles.cartButtonText}>
                View Cart ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScreenContainer>
    </ScreenWrapper>
  );
}

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Sort pills
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9BA1A6",
    backgroundColor: "transparent",
  },
  sortPillActive: {
    backgroundColor: "#00E5FF",
    borderColor: "#00E5FF",
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9BA1A6",
  },
  sortPillTextActive: {
    color: "#ffffff",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingTop: 16,
  },
  closeButton: {
    alignSelf: "flex-end",
    paddingRight: 16,
    paddingBottom: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#11181C",
  },
  productImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#f5f5f5",
  },
  productDetails: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#11181C",
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: "#687076",
    marginBottom: 12,
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00E5FF",
    marginBottom: 16,
  },
  modifiersContainer: {
    marginTop: 16,
    gap: 16,
  },
  modifierGroup: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  modifierGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#11181C",
    marginBottom: 10,
  },
  modifierOptions: {
    gap: 8,
  },
  modifierOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modifierOptionSelected: {
    backgroundColor: "#E0F7FA",
    borderColor: "#00E5FF",
  },
  modifierText: {
    fontSize: 14,
    color: "#11181C",
    fontWeight: "500",
  },
  modifierTextSelected: {
    color: "#00BCD4",
    fontWeight: "600",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#11181C",
  },
  quantityText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#11181C",
    minWidth: 28,
    textAlign: "center",
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: "#00E5FF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  cartButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
  },
  cartButton: {
    backgroundColor: "#00E5FF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cartButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  quickAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
});
