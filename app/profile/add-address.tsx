import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AddAddressScreen() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const addAddressMutation = trpc.addresses.addAddress.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Address added successfully");
      router.back();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to add address");
    },
  });

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert("Error", "Label is required (e.g., Home, Work)");
      return;
    }
    if (!streetAddress.trim()) {
      Alert.alert("Error", "Street address is required");
      return;
    }
    if (!eircode.trim()) {
      Alert.alert("Error", "Eircode is required");
      return;
    }

    addAddressMutation.mutate({
      label: label.trim(),
      streetAddress: streetAddress.trim(),
      eircode: eircode.trim().toUpperCase(),
      isDefault,
    });
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mr-4"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Add Address</Text>
      </View>

      <View className="flex-1 p-6">
        <View className="gap-4">
          {/* Label */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Label *</Text>
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border"
              placeholder="e.g., Home, Work, Mom's House"
              placeholderTextColor="#9BA1A6"
              value={label}
              onChangeText={setLabel}
              autoCapitalize="words"
            />
          </View>

          {/* Street Address */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Street Address *</Text>
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border"
              placeholder="e.g., 123 Main Street, Balbriggan"
              placeholderTextColor="#9BA1A6"
              value={streetAddress}
              onChangeText={setStreetAddress}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Eircode */}
          <View>
            <Text className="text-foreground font-semibold mb-2">Eircode *</Text>
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border"
              placeholder="e.g., K32 Y621"
              placeholderTextColor="#9BA1A6"
              value={eircode}
              onChangeText={setEircode}
              autoCapitalize="characters"
              maxLength={10}
            />
          </View>

          {/* Set as Default */}
          <View className="flex-row items-center justify-between bg-surface p-4 rounded-lg border border-border">
            <View className="flex-1">
              <Text className="text-foreground font-semibold">Set as Default</Text>
              <Text className="text-muted text-sm mt-1">Use this address for all orders</Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: "#E5E7EB", true: "#0a7ea4" }}
              thumbColor={isDefault ? "#fff" : "#f4f3f4"}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={addAddressMutation.isPending}
            className="bg-primary py-4 rounded-xl active:opacity-70 mt-4"
          >
            {addAddressMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-background text-center font-semibold text-base">
                Save Address
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
