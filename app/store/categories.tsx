import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";

const CATEGORY_PRIORITY_ORDER = [
  "Deli",
  "Fizzy Drinks",
  "Energy Drinks",
  "Water and Flavoured Water",
  "Chocolate Bars",
  "Chocolates Multi packs and Boxes",
  "Crisps and Nuts",
  "Biscuits and Cookies",
  "Tobacco and Cigars and Papers",
  "Vapes and Vape Oils",
  "Spirits",
  "Cans and Bottles",
  "Flavored Alcohol",
  "Wines",
  "Nicotine Products",
];

export default function CategoriesManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const { data: myStore } = trpc.store.getMyStore.useQuery(
    { userId: user?.id! },
    { enabled: !!user?.id }
  );
  const storeId = myStore?.storeId;

  const { data: categoriesData, isLoading } = trpc.categories.getAllWithCounts.useQuery(
    { storeId: storeId! },
    { enabled: !!storeId }
  );

  const uploadImageMutation = trpc.categories.uploadImage.useMutation();
  const updateImageMutation = trpc.categories.updateImage.useMutation();

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Sort categories in priority order
  const sortedCategories = useMemo(() => {
    if (!categoriesData) return [];
    const filtered = searchQuery
      ? categoriesData.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : categoriesData;

    return [...filtered].sort((a, b) => {
      const aIdx = CATEGORY_PRIORITY_ORDER.findIndex(
        (p) => p.toLowerCase() === a.name.toLowerCase().trim()
      );
      const bIdx = CATEGORY_PRIORITY_ORDER.findIndex(
        (p) => p.toLowerCase() === b.name.toLowerCase().trim()
      );
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categoriesData, searchQuery]);

  const withImage = sortedCategories.filter((c) => c.icon);
  const withoutImage = sortedCategories.filter((c) => !c.icon);

  const handlePickImage = useCallback(
    async (categoryId: number) => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true,
        });

        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        setUploadingId(categoryId);

        // Upload base64 to S3 via server
        const base64Data = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : null;

        if (!base64Data) {
          // Fallback: if base64 not available, try using the URI directly
          if (asset.uri) {
            await updateImageMutation.mutateAsync({
              id: categoryId,
              imageUrl: asset.uri,
            });
            utils.categories.getAllWithCounts.invalidate();
            setUploadingId(null);
            return;
          }
          throw new Error("Could not get image data");
        }

        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: base64Data,
          mimeType: "image/jpeg",
        });

        // Update the category with the new image URL
        await updateImageMutation.mutateAsync({
          id: categoryId,
          imageUrl: uploadResult.url,
        });

        utils.categories.getAllWithCounts.invalidate();
        setUploadingId(null);
      } catch (error: any) {
        setUploadingId(null);
        if (Platform.OS === "web") {
          alert(`Failed to upload image: ${error.message}`);
        } else {
          Alert.alert("Error", `Failed to upload image: ${error.message}`);
        }
      }
    },
    [uploadImageMutation, updateImageMutation, utils]
  );

  const handleRemoveImage = useCallback(
    async (categoryId: number) => {
      try {
        await updateImageMutation.mutateAsync({
          id: categoryId,
          imageUrl: "",
        });
        utils.categories.getAllWithCounts.invalidate();
      } catch (error: any) {
        if (Platform.OS === "web") {
          alert(`Failed to remove image: ${error.message}`);
        } else {
          Alert.alert("Error", `Failed to remove image: ${error.message}`);
        }
      }
    },
    [updateImageMutation, utils]
  );

  if (isLoading) {
    return (
      <ScreenContainer className="p-4">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-2">Loading categories...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
              ← Back
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>
            Category Images
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Stats */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: withImage.length === sortedCategories.length ? "#dcfce7" : "#fef3c7",
              borderRadius: 12,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#16a34a" }}>
              {categoriesData?.filter((c) => c.icon).length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: "#666" }}>With Image</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#fef2f2",
              borderRadius: 12,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#dc2626" }}>
              {categoriesData?.filter((c) => !c.icon).length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: "#666" }}>Need Image</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#eff6ff",
              borderRadius: 12,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.primary }}>
              {categoriesData?.length || 0}
            </Text>
            <Text style={{ fontSize: 12, color: "#666" }}>Total</Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search categories..."
            placeholderTextColor="#999"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>

        {/* Categories needing images first */}
        {withoutImage.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: "#dc2626",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              ⚠ Need Image ({withoutImage.length})
            </Text>
            {withoutImage.map((category) => (
              <View
                key={category.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#fecaca",
                  gap: 12,
                }}
              >
                {/* Placeholder */}
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: "#f5f5f5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {uploadingId === category.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={{ fontSize: 28 }}>📦</Text>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#999" }}>
                    {category.productCount} products
                  </Text>
                </View>

                {/* Upload button */}
                <TouchableOpacity
                  onPress={() => handlePickImage(category.id)}
                  disabled={uploadingId === category.id}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    opacity: uploadingId === category.id ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                    Upload
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Categories with images */}
        {withImage.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: "#16a34a",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              ✓ Has Image ({withImage.length})
            </Text>
            {withImage.map((category) => (
              <View
                key={category.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  gap: 12,
                }}
              >
                {/* Image */}
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  {uploadingId === category.id ? (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: category.icon! }}
                      style={{ width: 56, height: 56 }}
                      contentFit="cover"
                    />
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#999" }}>
                    {category.productCount} products
                  </Text>
                </View>

                {/* Change / Remove buttons */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handlePickImage(category.id)}
                    disabled={uploadingId === category.id}
                    style={{
                      backgroundColor: "#f0f0f0",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                      Change
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveImage(category.id)}
                    style={{
                      backgroundColor: "#fef2f2",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "600", fontSize: 13 }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
