import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

export default function SavedAddressesScreen() {
  const router = useRouter();
  
  const { data: addresses, isLoading, refetch } = trpc.addresses.getAddresses.useQuery();
  const deleteAddressMutation = trpc.addresses.deleteAddress.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to delete address");
    },
  });

  const handleDelete = (id: number, label: string) => {
    Alert.alert(
      "Delete Address",
      `Are you sure you want to delete "${label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAddressMutation.mutate({ id }),
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="active:opacity-70 mr-4"
          >
            <Text className="text-primary text-2xl">‹ Back</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Saved Addresses</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/profile/add-address" as any)}
          className="bg-primary px-4 py-2 rounded-lg active:opacity-70"
        >
          <Text className="text-background font-semibold">+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 p-4">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : addresses && addresses.length > 0 ? (
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View className="bg-surface rounded-xl border border-border p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Text className="text-foreground font-bold text-lg">{item.label}</Text>
                      {item.isDefault && (
                        <View className="bg-primary px-2 py-1 rounded">
                          <Text className="text-background text-xs font-semibold">DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-foreground mb-1">{item.streetAddress}</Text>
                    <Text className="text-muted text-sm">{item.eircode}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => router.push(`/profile/edit-address?id=${item.id}` as any)}
                    className="flex-1 bg-primary/10 py-2 rounded-lg active:opacity-70"
                  >
                    <Text className="text-primary text-center font-semibold">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.label)}
                    disabled={deleteAddressMutation.isPending}
                    className="flex-1 bg-red-500/10 py-2 rounded-lg active:opacity-70"
                  >
                    {deleteAddressMutation.isPending ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text className="text-red-500 text-center font-semibold">Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted text-center text-lg mb-4">
              No saved addresses yet
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/profile/add-address" as any)}
              className="bg-primary px-6 py-3 rounded-xl active:opacity-70"
            >
              <Text className="text-background font-semibold">Add Your First Address</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
