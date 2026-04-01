import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, FlatList, Platform, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

function CustomerRow({ customer, isDesktop }: { customer: any; isDesktop: boolean }) {
  const date = new Date(customer.createdAt);
  const dateStr = date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });

  if (isDesktop) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EC4899", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{(customer.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 2, minWidth: 150 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#0F172A" }}>{customer.name || "Unknown"}</Text>
        </View>
        <View style={{ flex: 2, minWidth: 200 }}>
          <Text style={{ fontSize: 13, color: "#687076" }}>{customer.email}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 13, color: "#687076" }}>{customer.phone || "—"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 100, alignItems: "center" }}>
          <View style={{ backgroundColor: customer.orderCount > 0 ? "#DCFCE7" : "#F3F4F6", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: customer.orderCount > 0 ? "#16A34A" : "#9CA3AF" }}>{customer.orderCount}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 100, alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>€{customer.totalSpent.toFixed(2)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 110 }}>
          <Text style={{ fontSize: 12, color: "#9CA3AF" }}>{dateStr}</Text>
        </View>
      </View>
    );
  }

  // Mobile card layout
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EC4899", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{(customer.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#0F172A" }}>{customer.name || "Unknown"}</Text>
          <Text style={{ fontSize: 13, color: "#687076" }}>{customer.email}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Phone</Text>
          <Text style={{ fontSize: 13, color: "#0F172A" }}>{customer.phone || "—"}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Orders</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: customer.orderCount > 0 ? "#16A34A" : "#9CA3AF" }}>{customer.orderCount}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Spent</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>€{customer.totalSpent.toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>Joined</Text>
          <Text style={{ fontSize: 12, color: "#687076" }}>{dateStr}</Text>
        </View>
      </View>
    </View>
  );
}

function CustomersContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  // Debounce search
  const handleSearch = (text: string) => {
    setSearch(text);
    // Simple debounce using setTimeout
    setTimeout(() => setDebouncedSearch(text), 300);
  };

  const { data, isLoading } = trpc.admin.getCustomers.useQuery(
    { search: debouncedSearch || undefined, limit: 500 },
    { refetchInterval: 60000 }
  );

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;

  // Sort options
  const [sortBy, setSortBy] = useState<"newest" | "orders" | "spent">("newest");
  const sortedCustomers = useMemo(() => {
    const sorted = [...customers];
    switch (sortBy) {
      case "orders":
        sorted.sort((a, b) => b.orderCount - a.orderCount);
        break;
      case "spent":
        sorted.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case "newest":
      default:
        // Already sorted by newest from API
        break;
    }
    return sorted;
  }, [customers, sortBy]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
        <ActivityIndicator size="large" color="#EC4899" />
        <Text style={{ color: "#687076", marginTop: 16 }}>Loading customers...</Text>
      </View>
    );
  }

  const renderDesktop = () => (
    <View style={{ gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <View>
          <Text style={{ fontSize: 14, color: "#687076" }}>{total} total customers</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder="Search by name, email or phone..."
            placeholderTextColor="#9CA3AF"
            style={{
              backgroundColor: "#F8FAFC",
              borderWidth: 1,
              borderColor: "#E2E8F0",
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 8,
              fontSize: 14,
              color: "#0F172A",
              width: 300,
            }}
          />
          {/* Sort buttons */}
          {(["newest", "orders", "spent"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortBy(s)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: sortBy === s ? "#EC4899" : "#F8FAFC",
                borderWidth: 1,
                borderColor: sortBy === s ? "#EC4899" : "#E2E8F0",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: sortBy === s ? "#fff" : "#687076" }}>
                {s === "newest" ? "Newest" : s === "orders" ? "Most Orders" : "Top Spenders"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Table */}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" }}>
        {/* Table header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
          <View style={{ width: 48 }} />
          <Text style={{ flex: 2, minWidth: 150, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase" }}>Name</Text>
          <Text style={{ flex: 2, minWidth: 200, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase" }}>Email</Text>
          <Text style={{ flex: 1, minWidth: 120, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase" }}>Phone</Text>
          <Text style={{ flex: 1, minWidth: 100, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", textAlign: "center" }}>Orders</Text>
          <Text style={{ flex: 1, minWidth: 100, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", textAlign: "center" }}>Total Spent</Text>
          <Text style={{ flex: 1, minWidth: 110, fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase" }}>Joined</Text>
        </View>

        {/* Rows */}
        {sortedCustomers.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 16, color: "#9CA3AF" }}>No customers found</Text>
          </View>
        ) : (
          <FlatList
            data={sortedCustomers}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <CustomerRow customer={item} isDesktop={true} />}
            style={{ maxHeight: 600 }}
          />
        )}
      </View>
    </View>
  );

  const renderMobile = () => (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <TextInput
          value={search}
          onChangeText={handleSearch}
          placeholder="Search customers..."
          placeholderTextColor="#9CA3AF"
          style={{
            backgroundColor: "#F8FAFC",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            color: "#0F172A",
          }}
        />
      </View>

      {/* Sort pills */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        {(["newest", "orders", "spent"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSortBy(s)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: sortBy === s ? "#EC4899" : "#F3F4F6",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: sortBy === s ? "#fff" : "#687076" }}>
              {s === "newest" ? "Newest" : s === "orders" ? "Orders" : "Spent"}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 13, color: "#9CA3AF", alignSelf: "center" }}>{total} total</Text>
      </View>

      {/* Customer list */}
      <FlatList
        data={sortedCustomers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <CustomerRow customer={item} isDesktop={false} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 16, color: "#9CA3AF" }}>No customers found</Text>
          </View>
        }
      />
    </View>
  );

  return isDesktop ? renderDesktop() : renderMobile();
}

export default function CustomersPage() {
  return (
    <AdminDesktopLayout title="Customers">
      <CustomersContent />
    </AdminDesktopLayout>
  );
}
