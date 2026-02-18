import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#0a7ea4",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Dashboard",
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          title: "All Orders",
        }}
      />
      <Stack.Screen
        name="driver-management"
        options={{
          title: "Driver Management",
        }}
      />
      <Stack.Screen
        name="create-driver"
        options={{
          title: "Create Driver Account",
        }}
      />
      <Stack.Screen
        name="drivers"
        options={{
          title: "All Drivers",
        }}
      />
      <Stack.Screen
        name="products"
        options={{
          title: "Manage Products",
        }}
      />
      <Stack.Screen
        name="import-products"
        options={{
          title: "Import Products",
        }}
      />
      <Stack.Screen
        name="categories"
        options={{
          title: "Category Images",
        }}
      />
      <Stack.Screen
        name="batch-category-images"
        options={{
          title: "Batch Category Images",
        }}
      />
      <Stack.Screen
        name="store-logos"
        options={{
          title: "Store Logos",
        }}
      />
      <Stack.Screen
        name="phone-order"
        options={{
          title: "Create Phone Order",
        }}
      />
    </Stack>
  );
}
