import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Modal, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

export default function ProductsManagementScreen() {
  const router = useRouter();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);

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
    setPendingImageBase64(null);
    setMessage("");
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64;

        // If base64 not returned by picker, read from file
        if (!base64Data && asset.uri && Platform.OS !== "web") {
          const fileData = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
          base64Data = fileData;
        }

        if (base64Data) {
          setPendingImageBase64(base64Data);
          // Show preview using local URI
          setEditingProduct({ ...editingProduct, images: [asset.uri], _localPreview: true });
        } else {
          setEditingProduct({ ...editingProduct, images: [asset.uri], _localPreview: true });
        }
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    try {
      // If we have a new image as base64, pass it; otherwise pass the existing URL
      const imageValue = pendingImageBase64
        ? `data:image/jpeg;base64,${pendingImageBase64}`
        : editingProduct.images?.[0];

      await updateMutation.mutateAsync({
        id: editingProduct.id,
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price,
        image: imageValue,
        quantity: editingProduct.quantity,
      });

      setMessage("Product updated successfully!");
      setMessageType("success");
      setShowEditModal(false);
      setEditingProduct(null);
      setPendingImageBase64(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update product");
      setMessageType("error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteConfirmId });
      setMessage("Product deleted successfully!");
      setMessageType("success");
      setDeleteConfirmId(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to delete product");
      setMessageType("error");
      setDeleteConfirmId(null);
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
            <TouchableOpacity onPress={() => setMessage("")}>
              <View className={`rounded-xl p-4 ${messageType === "error" ? "bg-error/10 border border-error" : "bg-success/10 border border-success"}`}>
                <Text className={messageType === "error" ? "text-error" : "text-success"}>
                  {message}
                </Text>
              </View>
            </TouchableOpacity>
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
                  <Text className="text-sm text-muted">{(store as any).category || ""}</Text>
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
                placeholderTextColor={colors.muted}
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
                        <Text className="text-sm text-muted" numberOfLines={2}>{product.description}</Text>
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
                        onPress={() => setDeleteConfirmId(product.id)}
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

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId !== null && (
        <View style={styles.overlay}>
          <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Delete Product?</Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
              Are you sure you want to delete this product? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteConfirmId(null)}
                style={[styles.confirmButton, { backgroundColor: colors.border }]}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[styles.confirmButton, { backgroundColor: "#DC2626" }]}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", textAlign: "center" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Edit Product</Text>
            
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16 }}>
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
                    style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + "20", borderRadius: 8 }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Name */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Name</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15 }}
                  value={editingProduct?.name}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, name: text })}
                />
              </View>

              {/* Description */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Description</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15 }}
                  value={editingProduct?.description}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, description: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Price */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Price (€)</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15 }}
                  value={editingProduct?.price}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, price: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Quantity */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 }}>Stock Quantity</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.foreground, fontSize: 15 }}
                  value={editingProduct?.quantity?.toString()}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, quantity: parseInt(text) || 0 })}
                  keyboardType="number-pad"
                />
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setPendingImageBase64(null);
                }}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: "85%",
    maxWidth: 360,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
