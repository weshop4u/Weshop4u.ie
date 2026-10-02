"use client";

import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTestMode } from "@/hooks/use-test-mode";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { testingModeEnabled, toggleTestingMode, isToggling, toggleError, clearToggleError } = useTestMode();
  const [testPinPrompt, setTestPinPrompt] = useState(false);
  const [testPin, setTestPin] = useState("");

  const [pinPrompt, setPinPrompt] = useState<null | boolean>(null); // the target state
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [editingMessage, setEditingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");

  const utils = trpc.useUtils();
  const { data: suspendState } = trpc.admin.getServiceSuspended.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const setSuspended = trpc.admin.setServiceSuspended.useMutation({
    onSuccess: () => {
      utils.admin.getServiceSuspended.invalidate();
      setPinPrompt(null);
      setPin("");
      setPinError("");
      setEditingMessage(false);
    },
    onError: (err) => setPinError(err.message),
  });

  const setMessage = trpc.admin.setSuspensionMessage.useMutation({
    onSuccess: () => {
      utils.admin.getServiceSuspended.invalidate();
      setEditingMessage(false);
    },
  });

  const suspended = suspendState?.enabled ?? false;

  

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6 p-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin Settings</Text>
            <Text className="text-base text-muted">Manage application settings and features</Text>
          </View>

          {/* Service Suspension */}
          <View
            className="rounded-lg p-4 gap-3 border"
            style={suspended
              ? { backgroundColor: "#FEF2F2", borderColor: "#DC2626", borderWidth: 2 }
              : { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
          >
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">🛑</Text>
                <Text className="text-lg font-semibold" style={{ color: suspended ? "#991B1B" : "#0F172A" }}>
                  Suspend Service
                </Text>
              </View>
              <Text className="text-sm" style={{ color: suspended ? "#991B1B" : "#687076" }}>
                Closes every store immediately and shows customers a notice. Use when there's no driver available.
              </Text>
            </View>

            <View className="flex-row items-center gap-2 mt-1">
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: suspended ? "#DC2626" : "#16A34A" }} />
              <Text className="text-base font-semibold" style={{ color: suspended ? "#991B1B" : "#0F172A" }}>
                {suspended ? "SUSPENDED — no orders being taken" : "Service running normally"}
              </Text>
            </View>

            {/* Live notice + edit */}
            {suspended && (
              <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#FECACA", borderRadius: 8, padding: 12, gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#991B1B", textTransform: "uppercase" }}>
                  Notice customers see
                </Text>
                {editingMessage ? (
                  <>
                    <TextInput
                      value={draftMessage}
                      onChangeText={setDraftMessage}
                      multiline
                      maxLength={300}
                      style={{
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 14,
                        color: "#0F172A",
                        minHeight: 70,
                      } as any}
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setEditingMessage(false)}
                        style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" }}
                      >
                        <Text style={{ fontWeight: "600", color: "#687076" }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { if (draftMessage.trim()) setMessage.mutate({ message: draftMessage.trim() }); }}
                        disabled={setMessage.isPending || !draftMessage.trim()}
                        style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: "#DC2626", alignItems: "center", opacity: setMessage.isPending ? 0.5 : 1 }}
                      >
                        <Text style={{ fontWeight: "700", color: "#fff" }}>
                          {setMessage.isPending ? "Saving..." : "Save notice"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 14, color: "#0F172A", lineHeight: 20 }}>
                      {suspendState?.message}
                    </Text>
                    <Pressable
                      onPress={() => { setDraftMessage(suspendState?.message || ""); setEditingMessage(true); }}
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#2563EB" }}>✎ Edit notice</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* PIN prompt */}
            {pinPrompt !== null ? (
              <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 12, gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>
                  {pinPrompt ? "Suspend all orders?" : "Resume normal service?"}
                </Text>
                {!pinPrompt && (
                  <Text style={{ fontSize: 12, color: "#687076" }}>
                    The notice resets to the default wording.
                  </Text>
                )}
                <TextInput
                  value={pin}
                  onChangeText={(v) => { setPin(v.replace(/[^0-9]/g, "").slice(0, 4)); setPinError(""); }}
                  placeholder="••••"
                  placeholderTextColor="#CBD5E1"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  style={{
                    borderWidth: 1,
                    borderColor: pinError ? "#DC2626" : "#E2E8F0",
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 18,
                    letterSpacing: 8,
                    textAlign: "center",
                    color: "#0F172A",
                  } as any}
                />
                {pinError ? <Text style={{ fontSize: 12, color: "#DC2626" }}>{pinError}</Text> : null}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => { setPinPrompt(null); setPin(""); setPinError(""); }}
                    style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" }}
                  >
                    <Text style={{ fontWeight: "600", color: "#687076" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (pin.length !== 4) { setPinError("Enter the 4-digit PIN"); return; }
                      setSuspended.mutate({ enabled: pinPrompt, pin });
                    }}
                    disabled={setSuspended.isPending}
                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pinPrompt ? "#DC2626" : "#16A34A", alignItems: "center", opacity: setSuspended.isPending ? 0.5 : 1 }}
                  >
                    <Text style={{ fontWeight: "700", color: "#fff" }}>
                      {setSuspended.isPending ? "Working..." : pinPrompt ? "Suspend" : "Resume"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => { setPinPrompt(!suspended); setPin(""); setPinError(""); }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 8,
                  backgroundColor: suspended ? "#16A34A" : "#DC2626",
                }}
              >
                <Text style={{ fontWeight: "700", textAlign: "center", fontSize: 16, color: "#fff" }}>
                  {suspended ? "✓ Resume Service" : "🛑 Suspend Service"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Testing Mode Section */}
          <View className="bg-surface rounded-lg p-4 gap-3 border border-border">
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">🧪</Text>
                <Text className="text-lg font-semibold text-foreground">Testing Mode</Text>
              </View>
              <Text className="text-sm text-muted">
                When enabled, all orders will be charged €0.01 instead of the full amount. Perfect for testing the complete order workflow.
              </Text>
            </View>

            {/* Status Display */}
            <View className="gap-3 mt-2">
              <View className="flex-row items-center gap-2">
                <View
                  className={cn(
                    "w-3 h-3 rounded-full",
                    testingModeEnabled ? "bg-yellow-500" : "bg-green-500"
                  )}
                />
                <Text className="text-base font-semibold text-foreground">
                  Status: {testingModeEnabled ? "🟡 ACTIVE" : "🟢 OFF"}
                </Text>
              </View>

              {/* Toggle Button — PIN gated */}
              {testPinPrompt ? (
                <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 12, gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>
                    {testingModeEnabled ? "Turn off testing mode?" : "Turn on testing mode?"}
                  </Text>
                  {!testingModeEnabled && (
                    <Text style={{ fontSize: 12, color: "#B45309" }}>
                      Every order will be charged €0.01 until this is turned off.
                    </Text>
                  )}
                  <TextInput
                    value={testPin}
                    onChangeText={(v) => { setTestPin(v.replace(/[^0-9]/g, "").slice(0, 4)); clearToggleError(); }}
                    placeholder="••••"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                    style={{
                      borderWidth: 1,
                      borderColor: toggleError ? "#DC2626" : "#E2E8F0",
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 18,
                      letterSpacing: 8,
                      textAlign: "center",
                      color: "#0F172A",
                    } as any}
                  />
                  {toggleError ? <Text style={{ fontSize: 12, color: "#DC2626" }}>{toggleError}</Text> : null}
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => { setTestPinPrompt(false); setTestPin(""); clearToggleError(); }}
                      style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" }}
                    >
                      <Text style={{ fontWeight: "600", color: "#687076" }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (testPin.length !== 4) return;
                        await toggleTestingMode(!testingModeEnabled, testPin);
                        setTestPin("");
                        setTestPinPrompt(false);
                      }}
                      disabled={isToggling}
                      style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#F59E0B", alignItems: "center", opacity: isToggling ? 0.5 : 1 }}
                    >
                      <Text style={{ fontWeight: "700", color: "#fff" }}>
                        {isToggling ? "Working..." : "Confirm"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setTestPinPrompt(true); setTestPin(""); clearToggleError(); }}
                  className={cn(
                    "px-4 py-3 rounded-lg active:opacity-80",
                    testingModeEnabled ? "bg-yellow-500" : "bg-primary"
                  )}
                >
                  <Text
                    className={cn(
                      "font-bold text-center text-base",
                      testingModeEnabled ? "text-yellow-900" : "text-foreground"
                    )}
                  >
                    {testingModeEnabled ? "Turn Off Testing Mode" : "Turn On Testing Mode"}
                  </Text>
                </Pressable>
              )}

              {/* Info Box */}
              {testingModeEnabled && (
                <View className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 gap-2">
                  <Text className="text-sm font-semibold text-yellow-900">
                    ⚠️ Testing Mode Active
                  </Text>
                  <Text className="text-sm text-yellow-800">
                    • Orders will be charged €0.01 only{"\n"}• Drivers will receive notifications{"\n"}• Full workflow is tested{"\n"}• Easy to refund test charges
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Dashboard Button */}
          <Pressable
            onPress={() => router.push("/admin")}
            className="px-4 py-3 rounded-lg bg-primary active:opacity-80"
          >
            <Text className="font-bold text-center text-base text-foreground">
              ← Back to Dashboard
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
