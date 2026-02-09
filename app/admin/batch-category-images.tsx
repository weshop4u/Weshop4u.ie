import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function BatchCategoryImagesScreen() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: categories, refetch } = trpc.categories.getAll.useQuery();
  const updateMutation = trpc.categories.updateImage.useMutation();

  const handleBatchUpload = async () => {
    setMessage("");
    setMessageType("");

    if (!csvText.trim()) {
      setMessage("Please paste CSV data");
      setMessageType("error");
      return;
    }

    setIsUploading(true);

    try {
      // Parse CSV
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const updates = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const categorySlug = values[headers.indexOf("category")];
        const imageUrl = values[headers.indexOf("image")];

        if (categorySlug && imageUrl) {
          // Find category by slug
          const category = categories?.find(c => c.slug === categorySlug);
          if (category) {
            updates.push({ id: category.id, imageUrl });
          }
        }
      }

      if (updates.length === 0) {
        throw new Error("No valid category-image mappings found in CSV");
      }

      // Update all categories
      for (const update of updates) {
        await updateMutation.mutateAsync(update);
      }

      setMessage(`Successfully updated ${updates.length} category images!`);
      setMessageType("success");
      setCsvText("");
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to batch upload images");
      setMessageType("error");
    } finally {
      setIsUploading(false);
    }
  };

  const csvTemplate = `category,image
beverages,https://example.com/beverages.jpg
snacks-crisps,https://example.com/snacks.jpg
dairy-eggs,https://example.com/dairy.jpg`;

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
        <Text className="text-xl font-bold text-foreground">Batch Upload</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Instructions */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">CSV Format</Text>
            <Text className="text-sm text-muted mb-3">
              Upload category images using CSV format:{"\n"}
              category (slug), image (URL)
            </Text>
            <Text className="text-xs text-muted font-mono bg-background p-2 rounded">
              {csvTemplate}
            </Text>
          </View>

          {/* Available Categories */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">Available Category Slugs</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories?.map((category) => (
                <View key={category.id} className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-xs text-primary font-mono">{category.slug}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Message */}
          {message && (
            <View className={`rounded-xl p-4 ${messageType === "error" ? "bg-error/10 border border-error" : "bg-success/10 border border-success"}`}>
              <Text className={messageType === "error" ? "text-error" : "text-success"}>
                {message}
              </Text>
            </View>
          )}

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
            />
          </View>

          {/* Upload Button */}
          <TouchableOpacity
            onPress={handleBatchUpload}
            disabled={isUploading}
            className={`py-4 rounded-xl ${isUploading ? "bg-muted" : "bg-primary"} active:opacity-70`}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-bold text-lg">
                Batch Upload Images
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
