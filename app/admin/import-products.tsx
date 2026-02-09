import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function ImportProductsScreen() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: stores } = trpc.stores.getAll.useQuery();
  const importMutation = trpc.stores.importProducts.useMutation();

  const handleImport = async () => {
    setMessage("");
    setMessageType("");

    if (!storeId || !csvText.trim()) {
      setMessage("Please select a store and paste CSV data");
      setMessageType("error");
      return;
    }

    setIsImporting(true);

    try {
      // Parse CSV
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const product: any = { storeId: parseInt(storeId) };

        headers.forEach((header, index) => {
          const value = values[index] || "";
          if (header === "name") product.name = value;
          else if (header === "description") product.description = value;
          else if (header === "price") product.price = value;
          else if (header === "category") product.categorySlug = value;
          else if (header === "sku") product.sku = value;
          else if (header === "barcode") product.barcode = value;
          else if (header === "quantity") product.quantity = parseInt(value) || 0;
        });

        if (product.name && product.price) {
          products.push(product);
        }
      }

      if (products.length === 0) {
        throw new Error("No valid products found in CSV");
      }

      // Import products
      await importMutation.mutateAsync({ storeId: parseInt(storeId), products });

      setMessage(`Successfully imported ${products.length} products!`);
      setMessageType("success");
      setCsvText("");
    } catch (error: any) {
      setMessage(error.message || "Failed to import products");
      setMessageType("error");
    } finally {
      setIsImporting(false);
    }
  };

  const csvTemplate = `name,description,price,category,sku,barcode,quantity
Coca Cola 500ml,Refreshing soft drink,2.50,beverages,CC500,5000112345678,50
Tayto Crisps,Classic cheese & onion crisps,1.50,snacks-crisps,TAY001,5000112345679,100
Avonmore Milk 2L,Fresh whole milk,2.99,dairy-eggs,AVM2L,5000112345680,30`;

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
        <Text className="text-xl font-bold text-foreground">Import Products</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Instructions */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">CSV Format</Text>
            <Text className="text-sm text-muted mb-3">
              Upload products using CSV format with these columns:{"\n"}
              name, description, price, category, sku, barcode, quantity
            </Text>
            <Text className="text-xs text-muted font-mono bg-background p-2 rounded">
              {csvTemplate}
            </Text>
          </View>

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
                  onPress={() => setStoreId(store.id.toString())}
                  className={`p-4 rounded-xl border ${
                    storeId === store.id.toString()
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  } active:opacity-70`}
                >
                  <Text className={`font-semibold ${
                    storeId === store.id.toString() ? "text-primary" : "text-foreground"
                  }`}>
                    {store.name}
                  </Text>
                  <Text className="text-sm text-muted">{store.category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CSV Input */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Paste CSV Data</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground font-mono text-xs"
              placeholder="Paste your CSV data here..."
              placeholderTextColor="#9BA1A6"
              value={csvText}
              onChangeText={setCsvText}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Import Button */}
          <TouchableOpacity
            onPress={handleImport}
            disabled={isImporting}
            className={`py-4 rounded-xl ${isImporting ? "bg-muted" : "bg-primary"} active:opacity-70`}
          >
            {isImporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-bold text-lg">
                Import Products
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
