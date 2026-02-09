import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";

export default function ProductsManagementScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: stores } = trpc.stores.getAll.useQuery();
  const { data: products, refetch } = trpc.stores.getProducts.useQuery(
    { storeId: selectedStore! },
    { enabled: !!selectedStore }
  );

  const updateMutation = trpc.stores.updateProduct.useMutation();
  const deleteMutation = trpc.stores.deleteProduct.useMutation();

  const handleEdit = (product: any) => {
    setEditingProduct({ ...product });
    setShowEditModal(true);
    setMessage("");
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEditingProduct({ ...editingProduct, images: [result.assets[0].uri] });
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    try {
      await updateMutation.mutateAsync({
        id: editingProduct.id,
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        image: editingProduct.images?.[0],
        quantity: editingProduct.quantity,
      });

      setMessage("Product updated successfully!");
      setMessageType("success");
      setShowEditModal(false);
      setEditingProduct(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update product");
      setMessageType("error");
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await deleteMutation.mutateAsync({ id: productId });
      setMessage("Product deleted successfully!");
      setMessageType("success");
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to delete product");
      setMessageType("error");
    }
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Manage Products</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Message */}
          {message && (
            <View className={`rounded-xl p-4 ${messageType === "error" ? "bg-error/10 border border-error" : "bg-success/10 border border-success"}`}>
              <Text className={messageType === "error" ? "text-error" : "text-success"}>
                {message}
              </Text>
            </View>
          )}

          {/* Store Selection */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Select Store</Text>
            <View className="gap-2">
              {stores?.map((store) => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => setSelectedStore(store.id)}
                  className={`p-4 rounded-xl border ${
                    selectedStore === store.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  } active:opacity-70`}
                >
                  <Text className={`font-semibold ${
                    selectedStore === store.id ? "text-primary" : "text-foreground"
                  }`}>
                    {store.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Search */}
          {selectedStore && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Search Products</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                placeholder="Search by name..."
                placeholderTextColor="#9BA1A6"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}

          {/* Products List */}
          {selectedStore && filteredProducts && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">
                Products ({filteredProducts.length})
              </Text>
              <View className="gap-3">
                {filteredProducts.map((product) => (
                  <View key={product.id} className="bg-surface rounded-xl p-4 border border-border">
                    <View className="flex-row gap-3">
                      {product.images && product.images.length > 0 && (
                        <Image
                          source={{ uri: product.images[0] }}
                          style={{ width: 60, height: 60, borderRadius: 8 }}
                          contentFit="cover"
                        />
                      )}
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">{product.name}</Text>
                        <Text className="text-sm text-muted">{product.description}</Text>
                        <Text className="text-primary font-bold mt-1">€{product.price}</Text>
                        <Text className="text-xs text-muted">Stock: {product.quantity}</Text>
                      </View>
                    </View>
                    <View className="flex-row gap-2 mt-3">
                      <TouchableOpacity
                        onPress={() => handleEdit(product)}
                        className="flex-1 py-2 bg-primary/10 rounded-lg active:opacity-70"
                      >
                        <Text className="text-primary text-center font-semibold">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(product.id)}
                        className="flex-1 py-2 bg-error/10 rounded-lg active:opacity-70"
                      >
                        <Text className="text-error text-center font-semibold">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "90%" }}>
            <Text className="text-xl font-bold text-foreground mb-4">Edit Product</Text>
            
            <ScrollView className="flex-1" contentContainerStyle={{ gap: 16 }}>
              {/* Image */}
              {editingProduct?.images && editingProduct.images.length > 0 && (
                <View className="items-center">
                  <Image
                    source={{ uri: editingProduct.images[0] }}
                    style={{ width: 150, height: 150, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={handlePickImage}
                    className="mt-2 px-4 py-2 bg-primary/10 rounded-lg active:opacity-70"
                  >
                    <Text className="text-primary font-semibold">Change Image</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Name */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Name</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={editingProduct?.name}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, name: text })}
                />
              </View>

              {/* Description */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={editingProduct?.description}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, description: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Price */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Price (€)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={editingProduct?.price}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, price: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Quantity */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Stock Quantity</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={editingProduct?.quantity?.toString()}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, quantity: parseInt(text) || 0 })}
                  keyboardType="number-pad"
                />
              </View>
            </ScrollView>

            {/* Buttons */}
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                }}
                className="flex-1 py-4 bg-surface border border-border rounded-xl active:opacity-70"
              >
                <Text className="text-foreground text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-4 bg-primary rounded-xl active:opacity-70"
              >
                <Text className="text-background text-center font-bold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
