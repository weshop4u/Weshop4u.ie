import { Text, View, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { WebHeader } from "@/components/web-header";
import { WebFooter } from "@/components/web-footer";

export default function ContactPage() {
  const colors = useColors();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitMutation = trpc.messages.submit.useMutation();

  const handleSubmit = async () => {
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email address"); return; }
    if (!subject.trim()) { setError("Please enter a subject"); return; }
    if (!message.trim()) { setError("Please enter your message"); return; }

    try {
      await submitMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send message. Please try again.");
    }
  };

  const formContent = submitted ? (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.successContainer}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Message Sent!</Text>
        <Text style={[styles.successText, { color: colors.muted }]}>
          Thank you for reaching out. We'll get back to you as soon as possible.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSubmitted(false);
            setName("");
            setEmail("");
            setSubject("");
            setMessage("");
          }}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.buttonText}>Send Another Message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={[styles.outlineButton, { borderColor: colors.primary }]}
        >
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Send us a Message</Text>
      <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
        Fill out the form below and we'll get back to you as soon as possible.
      </Text>

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: "#EF444420", borderColor: "#EF4444" }]}>
          <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={colors.muted}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Email *</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Subject *</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="What is this about?"
          placeholderTextColor={colors.muted}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Message *</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message here..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitMutation.isPending}
        style={[styles.button, { backgroundColor: submitMutation.isPending ? colors.border : colors.primary }]}
      >
        {submitMutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Send Message</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (isWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <WebHeader />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.webContainer}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Contact Us</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              Have a question, feedback, or need help? We'd love to hear from you.
            </Text>

            <View style={styles.contactInfoRow}>
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 28 }}>📞</Text>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>Phone</Text>
                <Text style={[styles.infoText, { color: colors.muted }]}>089-4 626262</Text>
              </View>
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 28 }}>📧</Text>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>Email</Text>
                <Text style={[styles.infoText, { color: colors.muted }]}>weshop4u247@gmail.com</Text>
              </View>
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 28 }}>📍</Text>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>Location</Text>
                <Text style={[styles.infoText, { color: colors.muted }]}>Balbriggan, Ireland</Text>
              </View>
            </View>

            {formContent}
          </View>
          <WebFooter />
        </ScrollView>
      </View>
    );
  }

  // Mobile layout
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={[styles.pageTitle, { color: colors.foreground, fontSize: 24 }]}>Contact Us</Text>
          <Text style={[styles.pageSubtitle, { color: colors.muted, fontSize: 14, marginBottom: 16 }]}>
            Have a question or need help? Send us a message.
          </Text>

          {formContent}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  contactInfoRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  infoCard: {
    flex: 1,
    minWidth: 180,
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  infoText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  outlineButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  successText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
