import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";
import { WebLayout } from "@/components/web-layout";
import { useColors } from "@/hooks/use-colors";

type LoginMethod = "email" | "phone";

// Load remembered data synchronously-ish via lazy state initializer
// This avoids useEffect setState that causes re-renders and steals focus
function getInitialRemembered(): { method: LoginMethod; remember: boolean } {
  // Default values - AsyncStorage will update these on first render via a one-time load
  return { method: "email", remember: false };
}

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  // Disable autoFetch to prevent background re-renders while user is typing
  const { refresh: refreshAuth } = useAuth({ autoFetch: false });

  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [identifier, setIdentifier] = useState(""); // Single field for email or phone
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const identifierRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const loginMutation = trpc.auth.login.useMutation();

  // Load remembered data ONCE in useEffect (not during render)
  useEffect(() => {
    AsyncStorage.multiGet(["rememberedLoginMethod", "rememberedEmail", "rememberedPhone"])
      .then((results) => {
        const method = results[0][1];
        const savedEmail = results[1][1];
        const savedPhone = results[2][1];
        if (method === "email" || method === "phone") {
          setLoginMethod(method);
          setRememberMe(true);
          if (method === "email" && savedEmail) {
            setIdentifier(savedEmail);
          } else if (method === "phone" && savedPhone) {
            setIdentifier(savedPhone);
          }
        }
        setInitialLoaded(true);
      })
      .catch(() => {
        setInitialLoaded(true);
      });
  }, []); // Empty deps = runs once on mount

  const handleMethodSwitch = useCallback((method: LoginMethod) => {
    setLoginMethod(method);
    setIdentifier(""); // Clear identifier when switching
    setError("");
  }, []);

  const handleLogin = useCallback(async () => {
    setError("");

    if (!identifier.trim()) {
      setError(loginMethod === "email" ? "Please enter your email" : "Please enter your phone number");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate credentials via tRPC
      const loginPayload = loginMethod === "email"
        ? { email: identifier.toLowerCase().trim(), password }
        : { phone: identifier.trim(), password };

      const result = await loginMutation.mutateAsync(loginPayload);

      // Step 2: Store user data in AsyncStorage for quick access
      await AsyncStorage.setItem("user", JSON.stringify(result.user));
      await AsyncStorage.setItem("userId", String(result.user.id));
      if (result.profile) {
        await AsyncStorage.setItem("profile", JSON.stringify(result.profile));
      }

      // Step 2b: Store login method preference if Remember me is checked
      if (rememberMe) {
        await AsyncStorage.setItem("rememberedLoginMethod", loginMethod);
        if (loginMethod === "email") {
          await AsyncStorage.setItem("rememberedEmail", identifier);
        } else {
          await AsyncStorage.setItem("rememberedPhone", identifier);
        }
      } else {
        await AsyncStorage.multiRemove(["rememberedLoginMethod", "rememberedEmail", "rememberedPhone"]);
      }

      // Step 3: Create session via REST API (sets cookie for web, returns token for native)
      const apiUrl = getApiBaseUrl();
      const sessionResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: result.user.email }),
        credentials: "include",
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();

        // Step 4: Store session token in SecureStore for native persistence
        if (Platform.OS !== "web") {
          if (sessionData.sessionToken) {
            try {
              await Auth.setSessionToken(sessionData.sessionToken);
            } catch (e) {
              console.error("[Login] Failed to store session token:", e);
            }
          }
        }

        // Step 5: Cache user info for quick session restore
        try {
          await Auth.setUserInfo({
            id: result.user.id,
            openId: "",
            name: result.user.name,
            email: result.user.email,
            loginMethod: "password",
            lastSignedIn: new Date(),
            role: result.user.role || null,
          });
        } catch (e) {
          console.error("[Login] Failed to cache user info:", e);
        }
      }

      // Step 6: Refresh useAuth to sync user state across all components
      try {
        await refreshAuth();
      } catch (e) {
        console.error("[Login] Failed to refresh auth:", e);
      }

      // Step 7: Navigate based on role
      if (Platform.OS === "web") {
        const base = window.location.pathname.startsWith("/api/web") ? "/api/web" : "";
        if (result.user.role === "driver") {
          window.location.href = `${base}/driver`;
        } else if (result.user.role === "store_staff") {
          window.location.href = `${base}/store`;
        } else {
          window.location.href = `${base}/`;
        }
      } else {
        // Use setTimeout to ensure navigation happens after state updates settle
        setTimeout(() => {
          try {
            if (result.user.role === "driver") {
              router.replace("/driver");
            } else if (result.user.role === "store_staff") {
              router.replace("/store");
            } else {
              router.replace("/");
            }
          } catch (e) {
            console.error("[Login] Navigation error:", e);
          }
        }, 100);
      }
    } catch (err: any) {
      setError(err.message || (loginMethod === "email" ? "Invalid email or password" : "Invalid phone number or password"));
    } finally {
      setLoading(false);
    }
  }, [identifier, password, loginMethod, rememberMe, loginMutation, refreshAuth, router]);

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <Wrapper>
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={styles.logo}
              resizeMode="cover"
            />
            <Text style={[styles.title, { color: colors.primary }]}>WESHOP4U</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Welcome Back!</Text>
          </View>

          {/* Login Method Toggle */}
          <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => handleMethodSwitch("email")}
              style={[
                styles.toggleButton,
                { backgroundColor: loginMethod === "email" ? colors.primary : "transparent" },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.toggleText,
                { color: loginMethod === "email" ? "#FFFFFF" : colors.muted },
              ]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleMethodSwitch("phone")}
              style={[
                styles.toggleButton,
                { backgroundColor: loginMethod === "phone" ? colors.primary : "transparent" },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.toggleText,
                { color: loginMethod === "phone" ? "#FFFFFF" : colors.muted },
              ]}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {loginMethod === "email" ? "Email" : "Phone Number"}
              </Text>
              {/* SINGLE TextInput - never conditionally rendered, just change props */}
              <TextInput
                ref={identifierRef}
                style={[styles.input, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                }]}
                placeholder={loginMethod === "email" ? "your@email.com" : "087 123 4567"}
                placeholderTextColor="#9BA1A6"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType={loginMethod === "email" ? "email-address" : "phone-pad"}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
              {loginMethod === "phone" && (
                <Text style={[styles.helperText, { color: colors.muted }]}>
                  Enter the phone number you registered with
                </Text>
              )}
            </View>

            {/* Remember Me Checkbox */}
            <TouchableOpacity
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.rememberRow}
            >
              <View
                style={[styles.checkbox, {
                  backgroundColor: rememberMe ? colors.primary : "transparent",
                  borderColor: rememberMe ? colors.primary : colors.border,
                }]}
              >
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.rememberText, { color: colors.foreground }]}>Remember this login method</Text>
            </TouchableOpacity>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
              <TextInput
                ref={passwordRef}
                style={[styles.input, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                }]}
                placeholder="Enter your password"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginButton, {
                backgroundColor: colors.primary,
                opacity: loading ? 0.5 : 1,
              }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.loginButtonText, { color: colors.background }]}>
                {loading ? "Logging in..." : "Login"}
              </Text>
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <View style={styles.linkRow}>
              <TouchableOpacity
                onPress={() => router.push("/auth/forgot-password" as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Register Link */}
            <View style={styles.linkRow}>
              <Text style={{ color: colors.muted }}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push("/auth/register" as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
  },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleText: {
    fontWeight: "700",
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    fontWeight: "600",
  },
  formContainer: {
    gap: 16,
  },
  label: {
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  rememberText: {
    fontSize: 14,
  },
  loginButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  loginButtonText: {
    fontWeight: "700",
    fontSize: 18,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  linkText: {
    fontWeight: "600",
  },
});
