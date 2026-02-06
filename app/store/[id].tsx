import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  
  const storeId = parseInt(id);
  const { data: store, isLoading: storeLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const { data: products, isLoading: productsLoading } = trpc.stores.getProducts.useQuery({ storeId });

  const addToCart = async (productId: number) => {
    const newCart = { ...cart, [productId]: (cart[productId] || 0) + 1 };
    setCart(newCart);
    await AsyncStorage.setItem(`cart_${storeId}`, JSON.stringify(newCart));
  };

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

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

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
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
            {store.isOpen247 && (
              <View className="bg-secondary px-3 py-1 rounded-full">
                <Text className="text-sm font-semibold text-background">24/7</Text>
              </View>
            )}
          </View>
          {store.address && (
            <Text className="text-sm text-muted">{store.address}</Text>
          )}
        </View>

        {/* Products */}
        <View className="px-4">
          <Text className="text-xl font-bold text-foreground mb-4">Products</Text>
          
          {products && products.length > 0 ? (
            <View className="gap-3">
              {products.map((product) => (
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
              <Text className="text-muted">No products available</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <View className="absolute bottom-8 right-4">
          <TouchableOpacity
            onPress={() => router.push(`/cart/${storeId}`)}
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
