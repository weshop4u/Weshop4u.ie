import { View, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
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

export default function BulkPriceUpdatePage() {
  const [csvText, setCsvText] = useState("");
  const [updates, setUpdates] = useState<PriceUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);

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

  const handleManualMatch = (index: number) => {
    // TODO: Open product selector modal
    Alert.alert("Manual Match", "Product selector coming soon");
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
              <View key={idx} className="bg-surface rounded-lg p-4 border border-border">
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
                  <TouchableOpacity
                    onPress={() => handleManualMatch(idx)}
                    className="bg-warning/10 rounded p-2"
                  >
                    <Text className="text-xs text-warning font-semibold">
                      ⚠ No match - Tap to select manually
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
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

  return (
    <AdminDesktopLayout title="Bulk Price Update">
      <ScreenContainer>{content}</ScreenContainer>
    </AdminDesktopLayout>
  );
}
