"use client";

import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform, Alert, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";

interface PriceUpdate {
  store: string;
  productName: string;
  price: number;
  checked: boolean;
  matched?: {
    productId: number;
    productName: string;
    currentPrice: number;
    confidence: number;
  };
  error?: string;
}

export default function BulkPriceUpdatePage() {
  const [csvText, setCsvText] = useState("");
  const [updates, setUpdates] = useState<PriceUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [creatingProduct, setCreatingProduct] = useState<number | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const parseCSV = trpc.admin.parseCSVPrices.useMutation();
  const bulkUpdate = trpc.admin.bulkUpdatePrices.useMutation();
  const getCategories = trpc.store.getCategories.useQuery({ storeId: 1 }); // TODO: Get actual store ID
  const createProduct = trpc.store.addProduct.useMutation();

  useEffect(() => {
    if (getCategories.data) {
      setCategories(getCategories.data);
    }
  }, [getCategories.data]);

  const handleParse = async () => {
    if (!csvText.trim()) {
      if (Platform.OS === "web") {
        alert("Please paste CSV data first");
      } else {
        Alert.alert("Error", "Please paste CSV data first");
      }
      return;
    }

    setLoading(true);
    try {
      const result = await parseCSV.mutateAsync({ csvText });
      // Initialize with checked state
      const withChecked = result.map((r: any) => ({ ...r, checked: !!r.matched }));
      setUpdates(withChecked);
      setReviewing(true);
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert("Parse Error: " + (error.message || "Failed to parse CSV"));
      } else {
        Alert.alert("Parse Error", error.message || "Failed to parse CSV");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCheck = (index: number) => {
    const newUpdates = [...updates];
    newUpdates[index].checked = !newUpdates[index].checked;
    setUpdates(newUpdates);
  };

  const handleEditPrice = (index: number) => {
    setEditingIndex(index);
    setEditingPrice(updates[index].price.toString());
  };

  const handleSavePrice = (index: number) => {
    const newUpdates = [...updates];
    newUpdates[index].price = parseFloat(editingPrice) || newUpdates[index].price;
    setUpdates(newUpdates);
    setEditingIndex(null);
  };

  const handleCreateProduct = (index: number) => {
    setCreatingProduct(index);
    setNewProductName(updates[index].productName);
    setNewProductPrice(updates[index].price.toString());
    setNewProductCategory(null);
  };

  const handleSaveNewProduct = async (index: number) => {
    if (!newProductCategory) {
      if (Platform.OS === "web") {
        alert("Please select a category");
      } else {
        Alert.alert("Error", "Please select a category");
      }
      return;
    }

    setLoading(true);
    try {
      const result = await createProduct.mutateAsync({
        storeId: 1, // TODO: Get actual store ID
        name: newProductName,
        price: newProductPrice,
        categoryId: newProductCategory,
        isActive: true,
        stockStatus: "in_stock",
      });

      const newUpdates = [...updates];
      newUpdates[index].matched = {
        productId: result.id,
        productName: newProductName,
        currentPrice: 0,
        confidence: 1.0,
      };
      newUpdates[index].checked = true;
      newUpdates[index].error = undefined;
      setUpdates(newUpdates);
      setCreatingProduct(null);
      
      if (Platform.OS === "web") {
        alert("Product created successfully!");
      } else {
        Alert.alert("Success", "Product created successfully!");
      }
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert("Error: " + (error.message || "Failed to create product"));
      } else {
        Alert.alert("Error", error.message || "Failed to create product");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    const validUpdates = updates.filter(u => u.checked && u.matched && !u.error);
    
    if (validUpdates.length === 0) {
      if (Platform.OS === "web") {
        alert("No valid matches to update");
      } else {
        Alert.alert("Error", "No valid matches to update");
      }
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
      if (Platform.OS === "web") {
        alert(`Success: Updated ${validUpdates.length} prices and marked as Price Verified`);
      } else {
        Alert.alert("Success", `Updated ${validUpdates.length} prices and marked as Price Verified`);
      }
      setCsvText("");
      setUpdates([]);
      setReviewing(false);
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert("Update Error: " + (error.message || "Failed to update prices"));
      } else {
        Alert.alert("Update Error", error.message || "Failed to update prices");
      }
    } finally {
      setLoading(false);
    }
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
              spar,Bakers Chicken Bites 130g,2.49{"\n"}
              spar,Domestos Bleach 750ml,2.25
            </Text>
          </View>

          {/* CSV Input */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Paste CSV Data:</Text>
            <View className="border border-border rounded-lg overflow-hidden bg-surface">
              {Platform.OS === "web" ? (
                <textarea
                  value={csvText}
                  onChange={(e: any) => setCsvText(e.currentTarget.value)}
                  placeholder="Store,Product,Price&#10;spar,Bakers Chicken Bites 130g,2.49"
                  style={{
                    padding: 12,
                    fontSize: 14,
                    fontFamily: "monospace",
                    minHeight: 200,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#11181C",
                    resize: "vertical",
                  }}
                />
              ) : (
                <TextInput
                  multiline
                  numberOfLines={10}
                  value={csvText}
                  onChangeText={setCsvText}
                  placeholder="Paste CSV data here..."
                  className="p-3 text-foreground"
                />
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
            <Text className="text-sm text-muted">
              {updates.filter(u => u.checked).length} items checked for update
            </Text>
          </View>

          {/* Matches List */}
          <View className="gap-3">
            {updates.map((update, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleEditPrice(idx)}
                className="bg-surface rounded-lg p-4 border border-border"
                activeOpacity={0.7}
              >
                {/* Header with checkbox */}
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{update.productName}</Text>
                    <Text className="text-xs text-muted">New Price: €{update.price.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleToggleCheck(idx)}
                    className={`w-6 h-6 rounded border-2 items-center justify-center ${
                      update.checked ? "bg-primary border-primary" : "border-border"
                    }`}
                  >
                    {update.checked && <Text className="text-white text-sm font-bold">✓</Text>}
                  </TouchableOpacity>
                </View>

                {/* Match status */}
                {update.error ? (
                  <View className="bg-error/10 rounded p-3 mb-2">
                    <Text className="text-xs text-error font-semibold mb-2">{update.error}</Text>
                    <TouchableOpacity
                      onPress={() => handleCreateProduct(idx)}
                      className="bg-primary rounded px-3 py-2"
                    >
                      <Text className="text-xs text-white font-semibold">+ Create New Product</Text>
                    </TouchableOpacity>
                  </View>
                ) : update.matched ? (
                  <View className="bg-success/10 rounded p-3">
                    <Text className="text-xs text-success font-semibold mb-1">
                      ✓ Matched: {update.matched.productName}
                    </Text>
                    <Text className="text-xs text-muted mb-1">
                      Current: €{update.matched.currentPrice.toFixed(2)} → New: €{update.price.toFixed(2)}
                    </Text>
                    <Text className="text-xs text-muted">
                      Match confidence: {(update.matched.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                ) : null}
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
                Update {updates.filter(u => u.checked && u.matched).length} Prices & Mark PV
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Price Modal */}
      <Modal visible={editingIndex !== null} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-surface rounded-lg p-6 w-full max-w-sm">
            <Text className="text-lg font-bold text-foreground mb-4">Edit Price</Text>
            <TextInput
              value={editingPrice}
              onChangeText={setEditingPrice}
              placeholder="Enter price"
              keyboardType="decimal-pad"
              className="border border-border rounded-lg p-3 text-foreground mb-4"
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setEditingIndex(null)}
                className="flex-1 bg-surface border border-border rounded-lg py-2 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSavePrice(editingIndex!)}
                className="flex-1 bg-primary rounded-lg py-2 items-center"
              >
                <Text className="text-white font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Product Modal */}
      <Modal visible={creatingProduct !== null} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-surface rounded-lg p-6 w-full max-w-sm max-h-96">
            <ScrollView>
              <Text className="text-lg font-bold text-foreground mb-4">Create New Product</Text>
              
              <Text className="text-sm text-muted mb-2">Product Name:</Text>
              <TextInput
                value={newProductName}
                onChangeText={setNewProductName}
                placeholder="Product name"
                className="border border-border rounded-lg p-3 text-foreground mb-4"
              />
              
              <Text className="text-sm text-muted mb-2">Price (€):</Text>
              <TextInput
                value={newProductPrice}
                onChangeText={setNewProductPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
                className="border border-border rounded-lg p-3 text-foreground mb-4"
              />
              
              <Text className="text-sm text-muted mb-2">Category:</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                className="border border-border rounded-lg p-3 mb-4"
              >
                <Text className="text-foreground">
                  {newProductCategory 
                    ? categories.find(c => c.id === newProductCategory)?.name || "Select category"
                    : "Select category"}
                </Text>
              </TouchableOpacity>

              {showCategoryPicker && (
                <View className="border border-border rounded-lg mb-4 max-h-48">
                  <FlatList
                    data={categories}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setNewProductCategory(item.id);
                          setShowCategoryPicker(false);
                        }}
                        className={`p-3 border-b border-border ${
                          newProductCategory === item.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <Text className="text-foreground">{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  onPress={() => setCreatingProduct(null)}
                  className="flex-1 bg-surface border border-border rounded-lg py-2 items-center"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSaveNewProduct(creatingProduct!)}
                  disabled={loading}
                  className="flex-1 bg-primary rounded-lg py-2 items-center"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  return (
    <AdminDesktopLayout title="Bulk Price Update">
      <ScreenContainer>{content}</ScreenContainer>
    </AdminDesktopLayout>
  );
}
