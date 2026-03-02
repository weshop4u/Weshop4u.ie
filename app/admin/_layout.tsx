import { Stack } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  // On web with desktop sidebar (>900px), hide the Stack header since sidebar provides navigation
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  return (
    <Stack
      screenOptions={{
        headerShown: !isDesktopWeb,
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
        name="driver-applications"
        options={{
          title: "Driver Applications",
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
        name="manage-stores"
        options={{
          title: "Manage Stores",
        }}
      />
      <Stack.Screen
        name="phone-order"
        options={{
          title: "Create Phone Order",
        }}
      />
      <Stack.Screen
        name="modifier-templates"
        options={{
          title: "Modifier Templates",
        }}
      />
      <Stack.Screen
        name="product-prices"
        options={{
          title: "Product Prices",
        }}
      />
      <Stack.Screen
        name="discount-codes"
        options={{
          title: "Discount Codes",
        }}
      />
      <Stack.Screen
        name="customers"
        options={{
          title: "Customers",
        }}
      />
      <Stack.Screen
        name="promotional-banners"
        options={{
          title: "Promotional Banners",
        }}
      />
      <Stack.Screen
        name="driver-map"
        options={{
          title: "Driver Locations",
        }}
      />
      <Stack.Screen
        name="driver-performance"
        options={{
          title: "Driver Performance",
        }}
      />
      <Stack.Screen
        name="driver-feedback"
        options={{
          title: "Driver Feedback",
        }}
      />
    </Stack>
  );
}
