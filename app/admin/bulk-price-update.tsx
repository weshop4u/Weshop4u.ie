import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";

interface PriceUpdate {
  store: string;
  productName: string;
  price: number;
  matched?: {
    productId: number;
    productName: string;
    confidence: number;
  };
  error?: string;
}

interface EditingItem extends PriceUpdate {
  id?: number;
  description?: string;
  categoryId?: number | null;
  sku?: string;
  stockStatus?: "in_stock" | "out_of_stock" | "low_stock";
  quantity?: number;
  images?: string[];
  isDrs?: boolean;
  pinnedToTrending?: boolean;
}

export default function BulkPriceUpdatePage() {
  const [csvText, setCsvText] = useState("");
  const [updates, setUpdates] = useState<PriceUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const parseCSV = trpc.admin.parseCSVPrices.useMutation();
  const bulkUpdate = trpc.admin.bulkUpdatePrices.useMutation();

  const handleParse = async () => {
    if (!csvText.trim()) {
      Alert.alert("Error", "Please paste CSV data first");
      return;
    }

    setLoading(true);
    try {
      const result = await parseCSV.mutateAsync({ csvText });
      setUpdates(result);
      setReviewing(true);
    } catch (error: any) {
      Alert.alert("Parse Error", error.message || "Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    const validUpdates = updates.filter(u => u.matched && !u.error);
    
    if (validUpdates.length === 0) {
      Alert.alert("Error", "No valid matches to update");
      return;
    }

    setLoading(true);
    try {
      await bulkUpdate.mutateAsync({
        updates: validUpdates.map(u => ({
          productId: u.matched!.productId,
          price: u.price,
        })),
      });
      Alert.alert("Success", `Updated ${validUpdates.length} prices and marked as Price Verified`);
      setCsvText("");
      setUpdates([]);
      setReviewing(false);
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Failed to update prices");
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (index: number) => {
    const item = updates[index];
    setEditingItem({
      ...item,
      id: item.matched?.productId,
      categoryId: null,
      sku: "",
      stockStatus: "in_stock",
      quantity: 0,
      isDrs: false,
      pinnedToTrending: false,
    });
    setShowEditModal(true);
  };

  const handleSaveEditedItem = () => {
    if (!editingItem) return;
    
    const updatedIndex = updates.findIndex(
      u => u.productName === editingItem.productName && u.price === editingItem.price
    );
    
    if (updatedIndex >= 0) {
      const updatedUpdates = [...updates];
      updatedUpdates[updatedIndex] = {
        ...editingItem,
        matched: editingItem.id ? {
          productId: editingItem.id,
          productName: editingItem.productName,
          confidence: 1.0,
        } : undefined,
        error: editingItem.id ? undefined : "No product selected",
      };
      setUpdates(updatedUpdates);
    }
    
    setShowEditModal(false);
    setEditingItem(null);
  };

  const content = (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      {!reviewing ? (
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Bulk Price Update</Text>
            <Text className="text-sm text-muted">
              Paste CSV data (Store, Product with size, Price) and we'll match and update prices in bulk.
            </Text>
          </View>

          {/* Instructions */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-2">CSV Format:</Text>
            <Text className="text-xs text-muted font-mono">
              Store,Product (with size),Price{"\n"}
              Spar,Tunnock's Teacakes 6pk,3.49{"\n"}
              Spar,Domestos Bleach 750ml,2.25
            </Text>
          </View>

          {/* CSV Input */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Paste CSV Data:</Text>
            <View className="border border-border rounded-lg overflow-hidden bg-surface">
              {Platform.OS === "web" ? (
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Store,Product,Price&#10;Spar,Tunnock's Teacakes 6pk,3.49"
                  style={{
                    padding: 12,
                    fontSize: 14,
                    fontFamily: "monospace",
                    minHeight: 200,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#11181C",
                  }}
                />
              ) : (
                <Text className="p-3 text-foreground">
                  {csvText || "Paste CSV data here..."}
                </Text>
              )}
            </View>
          </View>

          {/* Parse Button */}
          <TouchableOpacity
            onPress={handleParse}
            disabled={loading}
            className="bg-primary rounded-lg py-3 items-center"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Parse & Match Products</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View className="gap-4">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-foreground">Review Matches</Text>
            <TouchableOpacity
              onPress={() => setReviewing(false)}
              className="px-3 py-2 rounded bg-surface border border-border"
            >
              <Text className="text-foreground text-sm">← Back</Text>
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-sm text-muted mb-2">
              Found {updates.length} items • {updates.filter(u => u.matched).length} matched • {updates.filter(u => u.error).length} errors
            </Text>
          </View>

          {/* Matches List */}
          <View className="gap-2">
            {updates.map((update, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleEditItem(idx)}
                className="bg-surface rounded-lg p-4 border border-border active:opacity-70"
              >
                <View className="mb-2">
                  <Text className="text-sm font-semibold text-foreground">{update.productName}</Text>
                  <Text className="text-xs text-muted">€{update.price.toFixed(2)}</Text>
                </View>

                {update.error ? (
                  <View className="bg-error/10 rounded p-2 mb-2">
                    <Text className="text-xs text-error">{update.error}</Text>
                  </View>
                ) : update.matched ? (
                  <View className="bg-success/10 rounded p-2">
                    <Text className="text-xs text-success font-semibold">
                      ✓ Matched: {update.matched.productName}
                    </Text>
                    <Text className="text-xs text-muted">
                      Confidence: {(update.matched.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                ) : (
                  <View className="bg-warning/10 rounded p-2">
                    <Text className="text-xs text-warning font-semibold">
                      ⚠ No match - Tap to edit
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Update Button */}
          <TouchableOpacity
            onPress={handleBulkUpdate}
            disabled={loading}
            className="bg-primary rounded-lg py-3 items-center mt-4"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">
                Update {updates.filter(u => u.matched).length} Prices & Mark PV
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // Quick-edit modal
  const editModal = (
    <Modal visible={showEditModal} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-2xl p-6 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-foreground">Edit Product</Text>
            <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingItem(null); }}>
              <Text className="text-2xl text-muted">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
            {/* Product Name */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Product Name</Text>
              <TextInput
                className="border border-border rounded-lg p-3 text-foreground bg-surface"
                value={editingItem?.productName || ""}
                onChangeText={(text) => setEditingItem({ ...editingItem!, productName: text })}
                placeholder="Product name"
              />
            </View>

            {/* Price */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Price (€)</Text>
              <TextInput
                className="border border-border rounded-lg p-3 text-foreground bg-surface"
                value={editingItem?.price.toString() || ""}
                onChangeText={(text) => setEditingItem({ ...editingItem!, price: parseFloat(text) || 0 })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>

            {/* SKU */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">SKU</Text>
              <TextInput
                className="border border-border rounded-lg p-3 text-foreground bg-surface"
                value={editingItem?.sku || ""}
                onChangeText={(text) => setEditingItem({ ...editingItem!, sku: text })}
                placeholder="SKU (optional)"
              />
            </View>

            {/* Stock Status */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Stock Status</Text>
              <View className="flex-row gap-2">
                {["in_stock", "low_stock", "out_of_stock"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setEditingItem({ ...editingItem!, stockStatus: status as any })}
                    className={`flex-1 py-2 rounded-lg border ${
                      editingItem?.stockStatus === status
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                    }`}
                  >
                    <Text className={`text-xs font-semibold text-center ${
                      editingItem?.stockStatus === status ? "text-white" : "text-foreground"
                    }`}>
                      {status.replace("_", " ").toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quantity */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Stock Quantity</Text>
              <TextInput
                className="border border-border rounded-lg p-3 text-foreground bg-surface"
                value={editingItem?.quantity?.toString() || "0"}
                onChangeText={(text) => setEditingItem({ ...editingItem!, quantity: parseInt(text) || 0 })}
                keyboardType="number-pad"
                placeholder="0"
              />
            </View>

            {/* DRS Toggle */}
            <TouchableOpacity
              onPress={() => setEditingItem({ ...editingItem!, isDrs: !editingItem?.isDrs })}
              className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                editingItem?.isDrs ? "bg-cyan-500/10 border-cyan-500" : "bg-surface border-border"
              }`}
            >
              <View className={`w-5 h-5 rounded border-2 items-center justify-center ${
                editingItem?.isDrs ? "bg-cyan-500 border-cyan-500" : "border-muted"
              }`}>
                {editingItem?.isDrs && <Text className="text-white text-xs font-bold">✓</Text>}
              </View>
              <Text className="text-sm text-foreground flex-1">DRS (Deposit Return Scheme)</Text>
            </TouchableOpacity>

            <Text className="text-xs text-muted text-center mt-4">
              For modifiers and deals, open the full product editor
            </Text>
          </ScrollView>

          {/* Buttons */}
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => { setShowEditModal(false); setEditingItem(null); }}
              className="flex-1 py-3 rounded-lg bg-surface border border-border items-center"
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveEditedItem}
              className="flex-1 py-3 rounded-lg bg-primary items-center"
            >
              <Text className="text-white font-bold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <AdminDesktopLayout title="Bulk Price Update">
      <ScreenContainer>
        {content}
        {editModal}
      </ScreenContainer>
    </AdminDesktopLayout>
  );
}
