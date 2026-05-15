import { Stack } from "expo-router";

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="job-offer" />
      <Stack.Screen name="active-delivery" />
      <Stack.Screen name="earnings" />
    </Stack>
  );
}
