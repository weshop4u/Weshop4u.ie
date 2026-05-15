import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/use-colors";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

function StoreLogosScreenContent() {
  const colors = useColors();
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: stores, refetch } = trpc.stores.getAll.useQuery();
  const updateMutation = trpc.stores.updateLogo.useMutation();
  const uploadMutation = trpc.stores.uploadLogo.useMutation();

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
        setPreviewUri(result.assets[0].uri);
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const readImageAsBase64 = async (uri: string): Promise<{ base64: string; mimeType: string }> => {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mimeType = mimeMap[ext] || "image/jpeg";
      return { base64, mimeType };
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
      // Convert to base64 and upload to S3
      const { base64, mimeType } = await readImageAsBase64(previewUri);
      const response = await uploadMutation.mutateAsync({ base64, mimeType });

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
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        <View className="p-4 gap-4">
          {/* Message */}
          {message ? (
            <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7" }]}>
              <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
            </View>
          ) : null}

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
                    setMessage("");
                  }}
                  className={`p-4 rounded-xl border ${
                    selectedStore === store.id
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  } active:opacity-70`}
                >
                  <View className="flex-row items-center gap-3">
                    {store.logo ? (
                      <Image
                        source={{ uri: store.logo }}
                        style={{ width: 40, height: 40, borderRadius: 8 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 18 }}>🏪</Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className={`font-semibold ${
                        selectedStore === store.id ? "text-primary" : "text-foreground"
                      }`}>
                        {store.name}
                      </Text>
                      <Text className="text-sm text-muted">{store.category}</Text>
                    </View>
                    {store.logo ? (
                      <Text style={{ fontSize: 11, color: "#22C55E", fontWeight: "600" }}>Has logo</Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: colors.muted }}>No logo</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upload Button */}
          {selectedStore && !previewUri ? (
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
          ) : null}

          {/* Image Preview */}
          {previewUri && selectedStore ? (
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Preview</Text>
              <View className="bg-surface rounded-xl p-4 border border-border items-center">
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: 200, height: 200, borderRadius: 12 }}
                  contentFit="cover"
                />
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={() => setPreviewUri(null)}
                    style={[styles.actionButton, { backgroundColor: "#FEE2E2" }]}
                  >
                    <Text style={{ color: "#DC2626", fontWeight: "600", textAlign: "center" }}>Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUpload}
                    disabled={isUploading}
                    style={[styles.actionButton, { backgroundColor: isUploading ? "#9CA3AF" : "#0a7ea4" }]}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>Upload</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
  actionButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
});

export default function StoreLogosScreen() {
  return (
    <AdminDesktopLayout title="Store Logos">
      <StoreLogosScreenContent />
    </AdminDesktopLayout>
  );
}
