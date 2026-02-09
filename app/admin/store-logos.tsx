import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";

export default function StoreLogosScreen() {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: stores, refetch } = trpc.stores.getAll.useQuery();
  const updateMutation = trpc.stores.updateLogo.useMutation();

  const handlePickImage = async () => {
    if (!selectedStore) {
      setMessage("Please select a store first");
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
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleUpload = async () => {
    if (!selectedStore || !previewUri) {
      setMessage("Please select a store and image");
      setMessageType("error");
      return;
    }

    setIsUploading(true);
    setMessage("");

    try {
      // Upload image via backend
      const uploadMutation = trpc.stores.uploadLogo.useMutation();
      const response = await uploadMutation.mutateAsync({ uri: previewUri });

      // Update store with new logo URL
      await updateMutation.mutateAsync({
        id: selectedStore,
        logoUrl: response.url,
      });

      setMessage("Store logo updated successfully!");
      setMessageType("success");
      setPreviewUri(null);
      setSelectedStore(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to upload logo");
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
        <Text className="text-xl font-bold text-foreground">Store Logos</Text>
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
                  onPress={() => {
                    setSelectedStore(store.id);
                    setPreviewUri(null);
                  }}
                  className={`p-4 rounded-xl border ${
                    selectedStore === store.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  } active:opacity-70`}
                >
                  <View className="flex-row items-center gap-3">
                    {store.logo && (
                      <Image
                        source={{ uri: store.logo }}
                        style={{ width: 40, height: 40, borderRadius: 8 }}
                        contentFit="cover"
                      />
                    )}
                    <View className="flex-1">
                      <Text className={`font-semibold ${
                        selectedStore === store.id ? "text-primary" : "text-foreground"
                      }`}>
                        {store.name}
                      </Text>
                      <Text className="text-sm text-muted">{store.category}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upload Button */}
          {selectedStore && !previewUri && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Upload Logo</Text>
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isUploading}
                className={`py-4 rounded-xl border-2 border-dashed ${isUploading ? "border-muted bg-muted/10" : "border-primary bg-primary/5"} active:opacity-70`}
              >
                <Text className="text-primary text-center font-semibold">
                  📷 Choose Logo from Device
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Image Preview */}
          {previewUri && selectedStore && (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Preview</Text>
              <View className="bg-surface rounded-xl p-4 border border-border items-center">
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: 200, height: 200, borderRadius: 12 }}
                  contentFit="cover"
                />
                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => setPreviewUri(null)}
                    className="flex-1 px-4 py-2 bg-error/10 rounded-lg active:opacity-70"
                  >
                    <Text className="text-error text-center font-semibold">Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUpload}
                    disabled={isUploading}
                    className={`flex-1 px-4 py-2 rounded-lg active:opacity-70 ${isUploading ? "bg-muted" : "bg-primary"}`}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-background text-center font-bold">Upload</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
