import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { playChatMessageSound } from "@/lib/notification-sound";

interface ChatPanelProps {
  orderId: number;
  userId: number;
  userRole: "customer" | "driver";
  isExpanded: boolean;
  onToggle: () => void;
}

export function ChatPanel({ orderId, userId, userRole, isExpanded, onToggle }: ChatPanelProps) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const prevMessageCountRef = useRef(0);

  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { orderId },
    { enabled: isExpanded, refetchInterval: isExpanded ? 3000 : 10000 }
  );

  const { data: unreadData } = trpc.chat.getUnreadCount.useQuery(
    { orderId, userId, userRole },
    { enabled: !isExpanded, refetchInterval: 5000 }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation();

  // Play sound for new messages from the other party
  useEffect(() => {
    if (!messages) return;
    const currentCount = messages.length;
    if (prevMessageCountRef.current > 0 && currentCount > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.senderId !== userId) {
        playChatMessageSound();
      }
    }
    prevMessageCountRef.current = currentCount;
  }, [messages, userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isExpanded && messages && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isExpanded]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    const text = message.trim();
    setMessage("");
    setSending(true);

    try {
      await sendMutation.mutateAsync({
        orderId,
        senderId: userId,
        senderRole: userRole,
        message: text,
      });
      await refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessage(text); // Restore message on failure
    } finally {
      setSending(false);
    }
  };

  const otherParty = userRole === "customer" ? "Driver" : "Customer";
  const unreadCount = unreadData?.count || 0;

  // Collapsed state - just show the toggle button
  if (!isExpanded) {
    return (
      <TouchableOpacity
        onPress={onToggle}
        style={{
          backgroundColor: "#0a7ea4",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 25,
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: Math.max(insets.bottom, 8) + 8,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          💬 Chat with {otherParty}
        </Text>
        {unreadCount > 0 && (
          <View style={{
            backgroundColor: "#EF4444",
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 8,
            paddingHorizontal: 6,
          }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Expanded chat panel
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      style={{
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        backgroundColor: "#fff",
        maxHeight: "50%",
      }}
    >
      {/* Chat Header */}
      <TouchableOpacity
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#0a7ea4",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          💬 Chat with {otherParty}
        </Text>
        <Text style={{ color: "#fff", fontSize: 13 }}>▼ Minimize</Text>
      </TouchableOpacity>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ maxHeight: 220, paddingHorizontal: 12, paddingVertical: 8 }}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {(!messages || messages.length === 0) ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ color: "#687076", fontSize: 13 }}>
              No messages yet. Say hello!
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <View
                key={msg.id}
                style={{
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  marginBottom: 8,
                }}
              >
                {!isMe && (
                  <Text style={{ fontSize: 11, color: "#687076", marginBottom: 2, marginLeft: 4 }}>
                    {msg.senderName || otherParty}
                  </Text>
                )}
                <View style={{
                  backgroundColor: isMe ? "#0a7ea4" : "#f0f0f0",
                  borderRadius: 16,
                  borderBottomRightRadius: isMe ? 4 : 16,
                  borderBottomLeftRadius: isMe ? 16 : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}>
                  <Text style={{
                    color: isMe ? "#fff" : "#11181C",
                    fontSize: 14,
                    lineHeight: 20,
                  }}>
                    {msg.message}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 10,
                  color: "#9BA1A6",
                  marginTop: 2,
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  marginHorizontal: 4,
                }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        backgroundColor: "#f9f9f9",
      }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={`Message ${otherParty.toLowerCase()}...`}
          placeholderTextColor="#9BA1A6"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            fontSize: 14,
            color: "#11181C",
            maxHeight: 80,
          }}
          multiline
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!message.trim() || sending}
          style={{
            backgroundColor: message.trim() ? "#0a7ea4" : "#ccc",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
