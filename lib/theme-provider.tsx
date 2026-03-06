import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { View, useColorScheme as useSystemColorScheme, Platform } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ThemeProvider that is stable on native Android.
 * 
 * Key design decisions to prevent remount cascades:
 * 1. Use useRef for the color scheme to avoid state-driven re-renders of the entire tree
 * 2. Do NOT call Appearance.setColorScheme() which creates a feedback loop
 * 3. Compute NativeWind vars once and keep them stable
 * 4. No console.log in render path
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  
  // Use a ref to store the resolved scheme so changes don't trigger re-renders
  // On native, we want the initial scheme and that's it — no cascading updates
  const schemeRef = useRef<ColorScheme>(systemScheme);
  
  // Apply NativeWind color scheme once on mount
  const hasApplied = useRef(false);
  if (!hasApplied.current) {
    hasApplied.current = true;
    try {
      nativewindColorScheme.set(schemeRef.current);
    } catch (e) {
      // Ignore if NativeWind isn't ready
    }
    // Apply web-specific CSS variables
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = schemeRef.current;
      root.classList.toggle("dark", schemeRef.current === "dark");
      const palette = SchemeColors[schemeRef.current];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    schemeRef.current = scheme;
    try {
      nativewindColorScheme.set(scheme);
    } catch (e) {
      // Ignore
    }
    // Only manipulate DOM on web
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
    // Do NOT call Appearance.setColorScheme() — it creates a feedback loop
    // that triggers useSystemColorScheme() to fire, causing cascading re-renders
  }, []);

  // Compute theme variables ONCE based on the initial scheme
  // This prevents the root View style from changing and causing full tree re-layouts
  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[schemeRef.current].primary,
        "color-background": SchemeColors[schemeRef.current].background,
        "color-surface": SchemeColors[schemeRef.current].surface,
        "color-foreground": SchemeColors[schemeRef.current].foreground,
        "color-muted": SchemeColors[schemeRef.current].muted,
        "color-border": SchemeColors[schemeRef.current].border,
        "color-success": SchemeColors[schemeRef.current].success,
        "color-warning": SchemeColors[schemeRef.current].warning,
        "color-error": SchemeColors[schemeRef.current].error,
      }),
    [], // Empty deps — compute once and never change
  );

  const value = useMemo(
    () => ({
      colorScheme: schemeRef.current,
      setColorScheme,
    }),
    [setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
