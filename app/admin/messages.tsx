import { Text, View, TouchableOpacity, FlatList, StyleSheet, Platform, useWindowDimensions, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type FilterType = "all" | "unread" | "read";

function MessagesContent() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const { data, isLoading, refetch } = trpc.messages.list.useQuery(
    { page, limit: 20, filter },
    { refetchInterval: 30000 }
  );

  const markReadMutation = trpc.messages.markRead.useMutation();
  const deleteMutation = trpc.messages.delete.useMutation();

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleToggleRead = async (id: number, currentlyRead: boolean) => {
    try {
      await markReadMutation.mutateAsync({ id, isRead: !currentlyRead });
      showMessage(currentlyRead ? "Marked as unread" : "Marked as read", "success");
      refetch();
    } catch {
      showMessage("Failed to update message", "error");
    }
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === "web") {
      if (!window.confirm("Delete this message permanently?")) return;
      doDelete(id);
    } else {
      Alert.alert("Delete Message", "Delete this message permanently?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete(id) },
      ]);
    }
  };

  const doDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      showMessage("Message deleted", "success");
      if (expandedId === id) setExpandedId(null);
      refetch();
    } catch {
      showMessage("Failed to delete message", "error");
    }
  };

  const handleExpand = async (id: number, isRead: boolean) => {
    setExpandedId(expandedId === id ? null : id);
    // Auto-mark as read when expanding
    if (!isRead) {
      try {
        await markReadMutation.mutateAsync({ id, isRead: true });
        refetch();
      } catch { /* silent */ }
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  };

  const filterPills: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread (${data?.unreadCount ?? 0})` },
    { key: "read", label: "Read" },
  ];

  const renderMessage = ({ item }: { item: any }) => {
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleExpand(item.id, item.isRead)}
        activeOpacity={0.7}
        style={[
          styles.messageCard,
          {
            backgroundColor: item.isRead ? colors.surface : (Platform.OS === "web" ? "#E0F7FA" : colors.surface),
            borderColor: item.isRead ? colors.border : "#00E5FF",
            borderLeftWidth: item.isRead ? 1 : 4,
          },
        ]}
      >
        {/* Header row */}
        <View style={styles.messageHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {!item.isRead && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#00E5FF" }} />
              )}
              <Text style={[styles.senderName, { color: colors.foreground }]} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Text style={[styles.senderEmail, { color: colors.muted }]} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Subject */}
        <Text style={[styles.subject, { color: colors.foreground }]} numberOfLines={isExpanded ? undefined : 1}>
          {item.subject}
        </Text>

        {/* Expanded content */}
        {isExpanded && (
          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={[styles.messageDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.messageBody, { color: colors.foreground }]}>
              {item.message}
            </Text>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleToggleRead(item.id, item.isRead)}
                style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>
                  {item.isRead ? "Mark Unread" : "Mark Read"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === "web") {
                    window.open(`mailto:${item.email}?subject=Re: ${encodeURIComponent(item.subject)}`);
                  }
                }}
                style={[styles.actionButton, { backgroundColor: "#00E5FF" }]}
              >
                <Text style={{ fontSize: 13, color: "#fff", fontWeight: "600" }}>Reply via Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={[styles.actionButton, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}
              >
                <Text style={{ fontSize: 13, color: "#DC2626", fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const content = (
    <View style={{ flex: 1, gap: 16 }}>
      {/* Header */}
      {!isDesktopWeb && (
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: -8 }}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: isDesktopWeb ? 24 : 20, fontWeight: "800", color: colors.foreground }}>
            Messages
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            {data?.total ?? 0} total · {data?.unreadCount ?? 0} unread
          </Text>
        </View>
      </View>

      {/* Status message */}
      {message ? (
        <View style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: messageType === "success" ? "#D1FAE520" : "#FEE2E220",
          borderWidth: 1,
          borderColor: messageType === "success" ? "#22C55E" : "#EF4444",
        }}>
          <Text style={{ color: messageType === "success" ? "#22C55E" : "#EF4444", fontSize: 13 }}>
            {message}
          </Text>
        </View>
      ) : null}

      {/* Filter pills */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {filterPills.map((pill) => (
          <TouchableOpacity
            key={pill.key}
            onPress={() => { setFilter(pill.key); setPage(1); setExpandedId(null); }}
            style={[
              styles.filterPill,
              {
                backgroundColor: filter === pill.key ? "#00E5FF" : colors.surface,
                borderColor: filter === pill.key ? "#00E5FF" : colors.border,
              },
            ]}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: "600",
              color: filter === pill.key ? "#fff" : colors.foreground,
            }}>
              {pill.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages list */}
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={{ color: colors.muted, marginTop: 12 }}>Loading messages...</Text>
        </View>
      ) : !data?.messages?.length ? (
        <View style={{ paddingVertical: 60, alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 40 }}>📭</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>No messages</Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>
            {filter === "unread" ? "All messages have been read" : "No contact messages yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data.messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
          scrollEnabled={!isDesktopWeb}
        />
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={[styles.pageButton, { backgroundColor: page <= 1 ? colors.border : colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: page <= 1 ? colors.muted : colors.foreground, fontWeight: "600", fontSize: 13 }}>← Prev</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Page {page} of {data.totalPages}
          </Text>
          <TouchableOpacity
            onPress={() => setPage(Math.min(data.totalPages, page + 1))}
            disabled={page >= data.totalPages}
            style={[styles.pageButton, { backgroundColor: page >= data.totalPages ? colors.border : "#00E5FF" }]}
          >
            <Text style={{ color: page >= data.totalPages ? colors.muted : "#fff", fontWeight: "600", fontSize: 13 }}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isDesktopWeb) {
    return content;
  }

  return (
    <ScreenContainer className="p-4">
      {content}
    </ScreenContainer>
  );
}

export default function MessagesPage() {
  return (
    <AdminDesktopLayout title="Messages">
      <MessagesContent />
    </AdminDesktopLayout>
  );
}

const styles = StyleSheet.create({
  messageCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  senderName: {
    fontSize: 15,
    fontWeight: "700",
  },
  senderEmail: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 12,
    flexShrink: 0,
  },
  subject: {
    fontSize: 14,
    fontWeight: "600",
  },
  messageDivider: {
    height: 1,
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
});
