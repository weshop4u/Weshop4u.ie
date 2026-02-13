import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Switch, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { parseOpeningHours, type WeeklyHours, type DayHours } from "@/lib/store-hours";

// Web-compatible alert
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message);
  }
};

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

type DayKey = typeof DAYS[number]["key"];

interface DaySchedule {
  isOpen: boolean;
  open: string;
  close: string;
}

const DEFAULT_SCHEDULE: DaySchedule = { isOpen: true, open: "08:00", close: "22:00" };

export default function StoreHoursScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const storeId = params.storeId ? Number(params.storeId) : 1;

  const { data: user } = trpc.auth.me.useQuery();
  const { data: storeInfo, isLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const updateHoursMutation = trpc.store.updateOpeningHours.useMutation();

  const [isOpen247, setIsOpen247] = useState(false);
  const [schedule, setSchedule] = useState<Record<DayKey, DaySchedule>>({
    monday: { ...DEFAULT_SCHEDULE },
    tuesday: { ...DEFAULT_SCHEDULE },
    wednesday: { ...DEFAULT_SCHEDULE },
    thursday: { ...DEFAULT_SCHEDULE },
    friday: { ...DEFAULT_SCHEDULE },
    saturday: { ...DEFAULT_SCHEDULE },
    sunday: { ...DEFAULT_SCHEDULE },
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Load current hours from store data
  useEffect(() => {
    if (!storeInfo) return;

    setIsOpen247(storeInfo.isOpen247 || false);

    const parsed = parseOpeningHours(storeInfo.openingHours);
    if (parsed) {
      const newSchedule: Record<DayKey, DaySchedule> = {} as any;
      for (const day of DAYS) {
        const dayHours = parsed[day.key as keyof WeeklyHours];
        if (dayHours && dayHours.open && dayHours.close) {
          newSchedule[day.key] = {
            isOpen: true,
            open: dayHours.open,
            close: dayHours.close,
          };
        } else {
          newSchedule[day.key] = {
            isOpen: false,
            open: "08:00",
            close: "22:00",
          };
        }
      }
      setSchedule(newSchedule);
    }
  }, [storeInfo]);

  const updateDay = (day: DayKey, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      showAlert("Error", "You must be logged in to update store hours");
      return;
    }

    try {
      // Build opening hours object
      const openingHours: Record<string, DayHours> = {};
      for (const day of DAYS) {
        const daySchedule = schedule[day.key];
        if (daySchedule.isOpen) {
          openingHours[day.key] = {
            open: daySchedule.open,
            close: daySchedule.close,
          };
        } else {
          openingHours[day.key] = {
            open: null,
            close: null,
          };
        }
      }

      await updateHoursMutation.mutateAsync({
        storeId,
        userId: user.id,
        openingHours,
        isOpen247,
      });

      setHasChanges(false);
      showAlert("Success", "Store hours updated successfully!");
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to update store hours");
    }
  };

  const applyToAll = (day: DayKey) => {
    const source = schedule[day];
    const newSchedule = { ...schedule };
    for (const d of DAYS) {
      newSchedule[d.key] = { ...source };
    }
    setSchedule(newSchedule);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading store hours...</Text>
      </ScreenContainer>
    );
  }

  const storeName = storeInfo?.name || "Store";

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View style={{ backgroundColor: "#0a7ea4", padding: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 8 }}
          >
            <Text style={{ color: "#fff", fontSize: 14 }}>{"\u2190"} Back to Dashboard</Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{storeName}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Opening Hours Management</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* 24/7 Toggle */}
          <View style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: isOpen247 ? "rgba(34,197,94,0.1)" : "rgba(104,112,118,0.05)",
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isOpen247 ? "#22C55E" : "#E5E7EB",
            marginBottom: 20,
          }}>
            <View style={{ flex: 1 }}>
              <Text className="text-foreground font-bold text-lg">Open 24/7</Text>
              <Text className="text-muted text-sm">Store is always open, no schedule needed</Text>
            </View>
            <Switch
              value={isOpen247}
              onValueChange={(val) => {
                setIsOpen247(val);
                setHasChanges(true);
              }}
              trackColor={{ false: "#E5E7EB", true: "#22C55E" }}
              thumbColor="#fff"
            />
          </View>

          {/* Daily Schedule */}
          {!isOpen247 && (
            <View>
              <Text className="text-foreground font-bold text-lg mb-3">Weekly Schedule</Text>

              {DAYS.map((day) => {
                const daySchedule = schedule[day.key];
                return (
                  <View
                    key={day.key}
                    style={{
                      marginBottom: 12,
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: daySchedule.isOpen ? "rgba(10,126,164,0.05)" : "rgba(104,112,118,0.05)",
                      borderWidth: 1,
                      borderColor: daySchedule.isOpen ? "#0a7ea4" : "#E5E7EB",
                    }}
                  >
                    {/* Day header with toggle */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: daySchedule.isOpen ? 12 : 0 }}>
                      <Text className="text-foreground font-semibold text-base" style={{ minWidth: 100 }}>
                        {day.label}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: daySchedule.isOpen ? "#22C55E" : "#EF4444", fontWeight: "600", fontSize: 13 }}>
                          {daySchedule.isOpen ? "Open" : "Closed"}
                        </Text>
                        <Switch
                          value={daySchedule.isOpen}
                          onValueChange={(val) => updateDay(day.key, "isOpen", val)}
                          trackColor={{ false: "#E5E7EB", true: "#22C55E" }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>

                    {/* Time inputs */}
                    {daySchedule.isOpen && (
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text className="text-muted text-xs mb-1">Opens at</Text>
                            <TextInput
                              value={daySchedule.open}
                              onChangeText={(val) => updateDay(day.key, "open", val)}
                              placeholder="08:00"
                              style={{
                                backgroundColor: "#fff",
                                borderWidth: 1,
                                borderColor: "#E5E7EB",
                                borderRadius: 8,
                                padding: 10,
                                fontSize: 16,
                                fontWeight: "600",
                                textAlign: "center",
                                color: "#11181C",
                              }}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                          <Text className="text-muted text-lg mt-3">to</Text>
                          <View style={{ flex: 1 }}>
                            <Text className="text-muted text-xs mb-1">Closes at</Text>
                            <TextInput
                              value={daySchedule.close}
                              onChangeText={(val) => updateDay(day.key, "close", val)}
                              placeholder="22:00"
                              style={{
                                backgroundColor: "#fff",
                                borderWidth: 1,
                                borderColor: "#E5E7EB",
                                borderRadius: 8,
                                padding: 10,
                                fontSize: 16,
                                fontWeight: "600",
                                textAlign: "center",
                                color: "#11181C",
                              }}
                              keyboardType="numbers-and-punctuation"
                              maxLength={5}
                            />
                          </View>
                        </View>

                        {/* Apply to all button */}
                        <TouchableOpacity
                          onPress={() => applyToAll(day.key)}
                          style={{ marginTop: 8, alignSelf: "flex-end" }}
                        >
                          <Text style={{ color: "#0a7ea4", fontSize: 12, fontWeight: "600" }}>
                            Apply to all days
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Quick Presets */}
          {!isOpen247 && (
            <View style={{ marginTop: 8, marginBottom: 20 }}>
              <Text className="text-muted text-sm mb-2">Quick Presets:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    const newSchedule: Record<DayKey, DaySchedule> = {} as any;
                    for (const d of DAYS) {
                      newSchedule[d.key] = { isOpen: true, open: "07:00", close: "23:00" };
                    }
                    setSchedule(newSchedule);
                    setHasChanges(true);
                  }}
                  style={{ backgroundColor: "rgba(10,126,164,0.1)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                >
                  <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>7am - 11pm (All)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const newSchedule: Record<DayKey, DaySchedule> = {} as any;
                    for (const d of DAYS) {
                      newSchedule[d.key] = { isOpen: true, open: "08:00", close: "22:00" };
                    }
                    setSchedule(newSchedule);
                    setHasChanges(true);
                  }}
                  style={{ backgroundColor: "rgba(10,126,164,0.1)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                >
                  <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>8am - 10pm (All)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const newSchedule: Record<DayKey, DaySchedule> = {} as any;
                    for (const d of DAYS) {
                      if (d.key === "sunday") {
                        newSchedule[d.key] = { isOpen: false, open: "10:00", close: "18:00" };
                      } else {
                        newSchedule[d.key] = { isOpen: true, open: "09:00", close: "18:00" };
                      }
                    }
                    setSchedule(newSchedule);
                    setHasChanges(true);
                  }}
                  style={{ backgroundColor: "rgba(10,126,164,0.1)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                >
                  <Text style={{ color: "#0a7ea4", fontWeight: "600", fontSize: 13 }}>Mon-Sat 9-6</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button (fixed at bottom) */}
        {hasChanges && (
          <View style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
          }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={updateHoursMutation.isPending}
              style={{
                backgroundColor: updateHoursMutation.isPending ? "#9CA3AF" : "#22C55E",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                {updateHoursMutation.isPending ? "Saving..." : "Save Opening Hours"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
