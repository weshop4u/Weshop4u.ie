import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const storeId = parseInt(id);
  const { data: store, isLoading: storeLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const { data: products, isLoading: productsLoading } = trpc.stores.getProducts.useQuery({ storeId });

  // Load cart from storage
  useEffect(() => {
    loadCart();
  }, [storeId]);

  const loadCart = async () => {
    const savedCart = await AsyncStorage.getItem(`cart_${storeId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const addToCart = async (productId: number) => {
    const newCart = { ...cart, [productId]: (cart[productId] || 0) + 1 };
    setCart(newCart);
    await AsyncStorage.setItem(`cart_${storeId}`, JSON.stringify(newCart));
  };

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // Group products by category
  const categoriesWithProducts = products?.reduce((acc, product) => {
    if (!product.categoryId) return acc;
    
    if (!acc[product.categoryId]) {
      acc[product.categoryId] = {
        id: product.categoryId,
        name: product.category?.name || "Uncategorized",
        products: [],
      };
    }
    acc[product.categoryId].products.push(product);
    return acc;
  }, {} as Record<number, { id: number; name: string; products: typeof products }>) || {};

  const categories = Object.values(categoriesWithProducts);

  if (storeLoading || productsLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  if (!store) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Store not found</Text>
      </ScreenContainer>
    );
  }

  // If no category selected, show category selection
  if (selectedCategoryId === null) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="px-4 py-4 active:opacity-70"
          >
            <Text className="text-primary text-2xl">‹ Back</Text>
          </TouchableOpacity>

          {/* Store Header */}
          <View className="px-4 pb-6">
            <View className="flex-row items-center gap-3 mb-2">
              <Text className="text-3xl font-bold text-foreground">{store.name}</Text>
            </View>
            {store.address && (
              <Text className="text-sm text-muted">{store.address}</Text>
            )}
          </View>

          {/* Categories */}
          <View className="px-4">
            <Text className="text-xl font-bold text-foreground mb-4">Browse by Category</Text>
            
            {categories.length > 0 ? (
              <View className="gap-3">
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-foreground mb-1">
                          {category.name}
                        </Text>
                        <Text className="text-sm text-muted">
                          {category.products.length} {category.products.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                      <Text className="text-primary text-2xl">›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="items-center py-8">
                <Text className="text-muted">No products available</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Floating Cart Button */}
        {cartItemCount > 0 && (
          <View className="absolute bottom-8 right-4">
            <TouchableOpacity
              onPress={() => router.push(`/cart/${storeId}` as any)}
              className="bg-secondary w-16 h-16 rounded-full items-center justify-center active:opacity-70"
              style={{ shadowColor: "#FF00FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Text className="text-2xl">🛒</Text>
              <View className="absolute -top-1 -right-1 bg-primary w-6 h-6 rounded-full items-center justify-center">
                <Text className="text-background text-xs font-bold">{cartItemCount}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScreenContainer>
    );
  }

  // Show products for selected category
  const selectedCategory = categoriesWithProducts[selectedCategoryId];
  const categoryProducts = selectedCategory?.products || [];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => setSelectedCategoryId(null)}
          className="px-4 py-4 active:opacity-70"
        >
          <Text className="text-primary text-2xl">‹ Back to Categories</Text>
        </TouchableOpacity>

        {/* Category Header */}
        <View className="px-4 pb-6">
          <Text className="text-3xl font-bold text-foreground">{selectedCategory?.name}</Text>
          <Text className="text-sm text-muted">{store.name}</Text>
        </View>

        {/* Products */}
        <View className="px-4">
          {categoryProducts.length > 0 ? (
            <View className="gap-3">
              {categoryProducts.map((product) => (
                <View
                  key={product.id}
                  className="bg-surface rounded-xl p-4 border border-border"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-4">
                      <Text className="text-lg font-semibold text-foreground mb-1">
                        {product.name}
                      </Text>
                      {product.description && (
                        <Text className="text-sm text-muted mb-2" numberOfLines={2}>
                          {product.description}
                        </Text>
                      )}
                      <Text className="text-xl font-bold text-primary">
                        €{parseFloat(product.price).toFixed(2)}
                      </Text>
                    </View>

                    {/* Add to Cart Button */}
                    <TouchableOpacity
                      onPress={() => addToCart(product.id)}
                      className="bg-primary px-4 py-2 rounded-lg active:opacity-70"
                    >
                      <Text className="text-background font-semibold">
                        {cart[product.id] ? `+${cart[product.id]}` : "Add"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted">No products in this category</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <View className="absolute bottom-8 right-4">
          <TouchableOpacity
            onPress={() => router.push(`/cart/${storeId}` as any)}
            className="bg-secondary w-16 h-16 rounded-full items-center justify-center active:opacity-70"
            style={{ shadowColor: "#FF00FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Text className="text-2xl">🛒</Text>
            <View className="absolute -top-1 -right-1 bg-primary w-6 h-6 rounded-full items-center justify-center">
              <Text className="text-background text-xs font-bold">{cartItemCount}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
