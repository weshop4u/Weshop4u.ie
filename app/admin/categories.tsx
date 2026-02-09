import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";

export default function CategoriesScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: categories, refetch } = trpc.categories.getAll.useQuery();
  const updateMutation = trpc.categories.updateImage.useMutation();

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
        setImageUrl(uri);
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleUploadImage = async (uri: string): Promise<string | null> => {
    if (!selectedCategory) return null;

    try {
      // Upload to S3 via backend
      const uploadMutation = trpc.categories.uploadImage.useMutation();
      const response = await uploadMutation.mutateAsync({ uri });
      return response.url;
    } catch (error: any) {
      setMessage(error.message || "Failed to upload image");
      setMessageType("error");
      return null;
    }
  };

  const handleUpdateImage = async () => {
    if (!selectedCategory || !imageUrl.trim()) {
      setMessage("Please select a category and enter an image URL");
      setMessageType("error");
      return;
    }

    setIsUploading(true);
    setMessage("");

    try {
      // If preview exists, upload the image first
      let finalImageUrl = imageUrl;
      if (previewUri && previewUri.startsWith("file://")) {
        const uploadResult = await handleUploadImage(previewUri);
        if (!uploadResult) {
          throw new Error("Failed to upload image");
        }
        finalImageUrl = uploadResult;
      }

      await updateMutation.mutateAsync({
        id: selectedCategory,
        imageUrl: finalImageUrl.trim(),
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
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Manage Categories</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Instructions */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">Upload Category Images</Text>
            <Text className="text-sm text-muted">
              Select a category and paste an image URL to update its icon.{"\n\n"}
              You can upload images to any image hosting service (Imgur, Cloudinary, etc.) or use the built-in file upload feature.
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

          {/* Categories List */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Select Category</Text>
            <View className="gap-2">
              {categories?.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setImageUrl(category.icon || "");
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
                        <Text className="text-2xl">{category.icon || "📦"}</Text>
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
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upload Button */}
          {selectedCategory && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Upload Image</Text>
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isUploading}
                className={`py-4 rounded-xl border-2 border-dashed ${isUploading ? "border-muted bg-muted/10" : "border-primary bg-primary/5"} active:opacity-70 mb-4`}
              >
                <Text className="text-primary text-center font-semibold">
                  📷 Choose Image from Device
                </Text>
              </TouchableOpacity>
              
              <Text className="text-sm text-muted text-center mb-4">— OR —</Text>
            </View>
          )}

          {/* Image Preview */}
          {previewUri && selectedCategory && (
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
          )}

          {/* Image URL Input */}
          {selectedCategory && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Paste Image URL</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                placeholder="https://example.com/category-image.jpg"
                placeholderTextColor="#9BA1A6"
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text className="text-xs text-muted mt-2">
                Tip: Upload your image to Imgur.com and paste the direct link here
              </Text>
            </View>
          )}

          {/* Update Button */}
          {selectedCategory && (
            <TouchableOpacity
              onPress={handleUpdateImage}
              disabled={isUploading}
              className={`py-4 rounded-xl ${isUploading ? "bg-muted" : "bg-primary"} active:opacity-70`}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background text-center font-bold text-lg">
                  Update Category Image
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
