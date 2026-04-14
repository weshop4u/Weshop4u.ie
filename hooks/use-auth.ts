import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

// Shared auth state across all useAuth instances
// This ensures logout in one component is reflected everywhere
type AuthListener = (user: Auth.User | null) => void;
const listeners = new Set<AuthListener>();
let sharedUser: Auth.User | null | undefined = undefined; // undefined = not yet loaded

function notifyListeners(user: Auth.User | null) {
  sharedUser = user;
  listeners.forEach((listener) => listener(user));
}

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(sharedUser ?? null);
  const [loading, setLoading] = useState(sharedUser === undefined);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Subscribe to shared auth state changes
  useEffect(() => {
    mountedRef.current = true;
    const listener: AuthListener = (newUser) => {
      if (mountedRef.current) {
        setUser(newUser);
        setLoading(false);
      }
    };
    listeners.add(listener);

    // If shared user is already loaded, sync immediately
    if (sharedUser !== undefined) {
      setUser(sharedUser);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: check for stored session token first (from OAuth callback)
      if (Platform.OS === "web") {
        console.log("[useAuth] Web platform: checking for stored session token...");
        // On web, we store the session token in localStorage after OAuth callback
        const storedUser = await Auth.getUserInfo();
        if (storedUser) {
          console.log("[useAuth] Web: Found stored user info, using it");
          notifyListeners(storedUser);
          // Then validate in background
          try {
            const apiUser = await Api.getMe();
            if (apiUser) {
              const userInfo: Auth.User = {
                id: apiUser.id,
                openId: apiUser.openId,
                name: apiUser.name,
                email: apiUser.email,
                loginMethod: apiUser.loginMethod,
                lastSignedIn: new Date(apiUser.lastSignedIn),
                role: apiUser.role || null,
              };
              await Auth.setUserInfo(userInfo);
              notifyListeners(userInfo);
              console.log("[useAuth] Web user validated from API:", userInfo);
            } else {
              console.log("[useAuth] Web: Stored user validation failed, clearing");
              await Auth.clearUserInfo();
              notifyListeners(null);
            }
          } catch (error) {
            console.error("[useAuth] Web: Background validation failed:", error);
            // Keep the stored user even if validation fails
          }
        } else {
          console.log("[useAuth] Web platform: fetching user from API...");
          const apiUser = await Api.getMe();
          console.log("[useAuth] API user response:", apiUser);

          if (apiUser) {
            const userInfo: Auth.User = {
              id: apiUser.id,
              openId: apiUser.openId,
              name: apiUser.name,
              email: apiUser.email,
              loginMethod: apiUser.loginMethod,
              lastSignedIn: new Date(apiUser.lastSignedIn),
              role: apiUser.role || null,
            };
            await Auth.setUserInfo(userInfo);
            notifyListeners(userInfo);
            console.log("[useAuth] Web user set from API:", userInfo);
          } else {
            console.log("[useAuth] Web: No authenticated user from API");
            await Auth.clearUserInfo();
            notifyListeners(null);
          }
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        notifyListeners(null);
        return;
      }

      // Always validate against API on native to ensure session is still valid
      console.log("[useAuth] Native: validating session via API...");
      try {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
            role: apiUser.role || null,
          };
          await Auth.setUserInfo(userInfo);
          notifyListeners(userInfo);
          console.log("[useAuth] User validated from API:", userInfo);
        } else {
          // Session is invalid, clean up
          console.log("[useAuth] Session invalid, clearing");
          await Auth.removeSessionToken();
          await Auth.clearUserInfo();
          notifyListeners(null);
        }
      } catch {
        // API call failed, session might be expired
        console.log("[useAuth] API validation failed, clearing session");
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        notifyListeners(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      notifyListeners(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log("[useAuth] logout called");
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      // Notify ALL useAuth instances that user is now null
      notifyListeners(null);
      setError(null);
      console.log("[useAuth] logout completed, all instances notified");
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS);
    if (!autoFetch) {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
      return;
    }

    // If shared state is already loaded, don't fetch again
    if (sharedUser !== undefined) {
      console.log("[useAuth] Using existing shared auth state");
      setUser(sharedUser);
      setLoading(false);
      return;
    }

    // First load: check cache then fetch
    if (Platform.OS === "web") {
      Auth.getUserInfo().then((cachedUser) => {
        if (cachedUser) {
          console.log("[useAuth] Web: setting cached user immediately for fast display");
          notifyListeners(cachedUser);
          // Then validate in background
          fetchUser();
        } else {
          fetchUser();
        }
      });
    } else {
      Auth.getUserInfo().then((cachedUser) => {
        console.log("[useAuth] Native cached user check:", cachedUser);
        if (cachedUser) {
          console.log("[useAuth] Native: setting cached user immediately, then validating...");
          notifyListeners(cachedUser);
          // Always validate cached user against API in background
          fetchUser();
        } else {
          fetchUser();
        }
      });
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    console.log("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
