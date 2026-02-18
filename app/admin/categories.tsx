import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/use-colors";
import { StyleSheet } from "react-native";

export default function CategoriesScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: categories, refetch } = trpc.categories.getAll.useQuery();
  const updateMutation = trpc.categories.updateImage.useMutation();
  const uploadMutation = trpc.categories.uploadImage.useMutation();

  const handlePickImage = async () => {
    if (!selectedCategory) {
      setMessage("Please select a category first");
      setMessageType("error");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setPreviewUri(uri);
        // Don't set imageUrl to local URI — it will be uploaded as base64
        setImageUrl("");
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const readImageAsBase64 = async (uri: string): Promise<{ base64: string; mimeType: string }> => {
    if (Platform.OS === "web") {
      // On web, fetch the blob and convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Strip the data:image/...;base64, prefix
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      // On native, use FileSystem
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Guess mime type from extension
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mimeType = mimeMap[ext] || "image/jpeg";
      return { base64, mimeType };
    }
  };

  const handleUpdateImage = async () => {
    if (!selectedCategory) {
      setMessage("Please select a category first");
      setMessageType("error");
      return;
    }

    if (!previewUri && !imageUrl.trim()) {
      setMessage("Please pick an image or enter a URL");
      setMessageType("error");
      return;
    }

    setIsUploading(true);
    setMessage("");

    try {
      let finalImageUrl = imageUrl.trim();

      // If user picked an image from device, upload it as base64
      if (previewUri) {
        const { base64, mimeType } = await readImageAsBase64(previewUri);
        const uploadResult = await uploadMutation.mutateAsync({ base64, mimeType });
        finalImageUrl = uploadResult.url;
      }

      if (!finalImageUrl) {
        throw new Error("No image URL available");
      }

      await updateMutation.mutateAsync({
        id: selectedCategory,
        imageUrl: finalImageUrl,
      });

      setMessage("Category image updated successfully!");
      setMessageType("success");
      setImageUrl("");
      setPreviewUri(null);
      setSelectedCategory(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update category image");
      setMessageType("error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Instructions */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">Upload Category Images</Text>
            <Text className="text-sm text-muted">
              Select a category, then pick an image from your device or paste a URL to update its icon.
            </Text>
          </View>

          {/* Message */}
          {message ? (
            <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7" }]}>
              <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
            </View>
          ) : null}

          {/* Categories List */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Select Category</Text>
            <View className="gap-2">
              {categories?.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setImageUrl(category.icon && category.icon.startsWith("http") ? category.icon : "");
                    setPreviewUri(null);
                    setMessage("");
                  }}
                  className={`p-4 rounded-xl border flex-row items-center gap-3 ${
                    selectedCategory === category.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  } active:opacity-70`}
                >
                  {/* Current Image */}
                  <View className="w-12 h-12 bg-primary/10 rounded-lg overflow-hidden">
                    {category.icon && category.icon.startsWith("http") ? (
                      <Image
                        source={{ uri: category.icon }}
                        style={{ width: 48, height: 48 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <Text className="text-2xl">📦</Text>
                      </View>
                    )}
                  </View>

                  {/* Category Info */}
                  <View className="flex-1">
                    <Text className={`font-semibold ${
                      selectedCategory === category.id ? "text-primary" : "text-foreground"
                    }`}>
                      {category.name}
                    </Text>
                    <Text className="text-xs text-muted">{category.slug}</Text>
                  </View>

                  {/* Status indicator */}
                  {category.icon && category.icon.startsWith("http") ? (
                    <Text style={{ fontSize: 11, color: "#22C55E", fontWeight: "600" }}>Has image</Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.muted }}>No image</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upload Section */}
          {selectedCategory ? (
            <View className="gap-4">
              {/* Pick from device */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Upload Image</Text>
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isUploading}
                  className={`py-4 rounded-xl border-2 border-dashed ${isUploading ? "border-muted bg-muted/10" : "border-primary bg-primary/5"} active:opacity-70`}
                >
                  <Text className="text-primary text-center font-semibold">
                    📷 Choose Image from Device
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Image Preview */}
              {previewUri ? (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Preview</Text>
                  <View className="bg-surface rounded-xl p-4 border border-border items-center">
                    <Image
                      source={{ uri: previewUri }}
                      style={{ width: 200, height: 200, borderRadius: 12 }}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setPreviewUri(null);
                        setImageUrl("");
                      }}
                      className="mt-3 px-4 py-2 bg-error/10 rounded-lg active:opacity-70"
                    >
                      <Text className="text-error font-semibold">Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* OR divider */}
              {!previewUri ? (
                <Text className="text-sm text-muted text-center">— OR paste a URL —</Text>
              ) : null}

              {/* Image URL Input (only show if no device image picked) */}
              {!previewUri ? (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Paste Image URL</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="https://example.com/category-image.jpg"
                    placeholderTextColor={colors.muted}
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                    Tip: Upload your image to Imgur.com and paste the direct link here
                  </Text>
                </View>
              ) : null}

              {/* Update Button */}
              <TouchableOpacity
                onPress={handleUpdateImage}
                disabled={isUploading || (!previewUri && !imageUrl.trim())}
                style={[styles.saveButton, { opacity: isUploading || (!previewUri && !imageUrl.trim()) ? 0.5 : 1 }]}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {previewUri ? "Upload & Save" : "Save Image URL"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  messageBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
