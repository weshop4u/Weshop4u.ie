import { Stack, useRouter } from "expo-router";
import { Platform, useWindowDimensions, View, Text, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  // On web with desktop sidebar (>900px), hide the Stack header since sidebar provides navigation
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  // Check user role — redirect store_staff away from admin
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "store_staff") {
        // Store staff should not access admin routes — redirect to store dashboard
        if (Platform.OS === "web") {
          window.location.href = "/store";
        } else {
          router.replace("/store" as any);
        }
      }
    }
  }, [user, isLoading]);

  // Show loading while checking role
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  // Block rendering for store_staff (redirect is in progress)
  if (user?.role === "store_staff") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <Text style={{ color: "#687076", fontSize: 14 }}>Redirecting to store dashboard...</Text>
      </View>
    );
  }

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
      <Stack.Screen
        name="batch-management"
        options={{
          title: "Batch Deliveries",
        }}
      />
    </Stack>
  );
}
