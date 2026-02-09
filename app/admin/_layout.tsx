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
          title: "Admin Panel",
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
    </Stack>
  );
}
