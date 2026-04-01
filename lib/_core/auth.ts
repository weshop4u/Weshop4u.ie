import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

// Lazy-load SecureStore only on native to avoid any module-level crashes
let SecureStore: typeof import("expo-secure-store") | null = null;

async function getSecureStore() {
  if (Platform.OS === "web") return null;
  if (SecureStore) return SecureStore;
  try {
    SecureStore = await import("expo-secure-store");
    return SecureStore;
  } catch (e) {
    console.warn("[Auth] SecureStore not available, falling back to AsyncStorage:", e);
    return null;
  }
}

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
  role?: string | null;
};

// Helper: get item from SecureStore with AsyncStorage fallback
async function secureGet(key: string): Promise<string | null> {
  try {
    const ss = await getSecureStore();
    if (ss) {
      const value = await ss.getItemAsync(key);
      if (value) return value;
    }
  } catch (e) {
    console.warn(`[Auth] SecureStore.getItemAsync(${key}) failed:`, e);
  }
  // Fallback to AsyncStorage
  try {
    return await AsyncStorage.getItem(`secure_${key}`);
  } catch (e) {
    console.warn(`[Auth] AsyncStorage fallback get(${key}) failed:`, e);
    return null;
  }
}

// Helper: set item in SecureStore with AsyncStorage fallback
async function secureSet(key: string, value: string): Promise<void> {
  try {
    const ss = await getSecureStore();
    if (ss) {
      await ss.setItemAsync(key, value);
      // Also save to AsyncStorage as backup
      await AsyncStorage.setItem(`secure_${key}`, value).catch(() => {});
      return;
    }
  } catch (e) {
    console.warn(`[Auth] SecureStore.setItemAsync(${key}) failed:`, e);
  }
  // Fallback to AsyncStorage
  try {
    await AsyncStorage.setItem(`secure_${key}`, value);
  } catch (e) {
    console.warn(`[Auth] AsyncStorage fallback set(${key}) failed:`, e);
  }
}

// Helper: delete item from SecureStore with AsyncStorage fallback
async function secureDelete(key: string): Promise<void> {
  try {
    const ss = await getSecureStore();
    if (ss) {
      await ss.deleteItemAsync(key);
    }
  } catch (e) {
    console.warn(`[Auth] SecureStore.deleteItemAsync(${key}) failed:`, e);
  }
  // Also clean up AsyncStorage fallback
  try {
    await AsyncStorage.removeItem(`secure_${key}`);
  } catch (e) {
    // ignore
  }
}

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      return null;
    }
    const token = await secureGet(SESSION_TOKEN_KEY);
    return token;
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await secureSet(SESSION_TOKEN_KEY, token);
  } catch (error) {
    console.error("[Auth] Failed to set session token:", error);
    // Don't throw - let login continue even if token storage fails
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await secureDelete(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      try {
        info = window.localStorage.getItem(USER_INFO_KEY);
      } catch {
        info = null;
      }
    } else {
      info = await secureGet(USER_INFO_KEY);
    }

    if (!info) {
      return null;
    }
    const user = JSON.parse(info);
    return user;
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    const data = JSON.stringify(user);
    if (Platform.OS === "web") {
      try {
        window.localStorage.setItem(USER_INFO_KEY, data);
      } catch {
        // ignore
      }
      return;
    }
    await secureSet(USER_INFO_KEY, data);
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
    // Don't throw - let the app continue
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      try {
        window.localStorage.removeItem(USER_INFO_KEY);
      } catch {
        // ignore
      }
      return;
    }
    await secureDelete(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}
