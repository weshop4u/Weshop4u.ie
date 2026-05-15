import { createContext, useCallback, useContext, useRef } from "react";
import { View, Platform, StyleSheet, type ViewStyle } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── MODULE-LEVEL INITIALIZATION ───────────────────────────────────────────
// Everything below runs ONCE at import time, before any component renders.
// This eliminates ALL hooks/effects that could trigger re-renders.

const INITIAL_SCHEME: ColorScheme = "light";

// Set NativeWind color scheme at module level
try {
  nativewindColorScheme.set(INITIAL_SCHEME);
} catch (_) {}

// Compute NativeWind CSS variables at MODULE LEVEL — this object reference
// NEVER changes, so the View wrapper's style prop is always the same identity.
// This prevents React from detecting a style change and re-rendering the tree.
const THEME_VARS = vars({
  "--color-primary": SchemeColors[INITIAL_SCHEME].primary,
  "--color-background": SchemeColors[INITIAL_SCHEME].background,
  "--color-surface": SchemeColors[INITIAL_SCHEME].surface,
  "--color-foreground": SchemeColors[INITIAL_SCHEME].foreground,
  "--color-muted": SchemeColors[INITIAL_SCHEME].muted,
  "--color-border": SchemeColors[INITIAL_SCHEME].border,
  "--color-success": SchemeColors[INITIAL_SCHEME].success,
  "--color-warning": SchemeColors[INITIAL_SCHEME].warning,
  "--color-error": SchemeColors[INITIAL_SCHEME].error,
});

// Pre-compute the combined style array at module level — same identity every render
const ROOT_STYLE: ViewStyle[] = [{ flex: 1 }, THEME_VARS as unknown as ViewStyle];

// Apply web CSS variables at module level
if (Platform.OS === "web" && typeof document !== "undefined") {
  const root = document.documentElement;
  root.dataset.theme = INITIAL_SCHEME;
  const palette = SchemeColors[INITIAL_SCHEME];
  Object.entries(palette).forEach(([token, value]) => {
    root.style.setProperty(`--color-${token}`, value);
  });
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────

/**
 * Minimal ThemeProvider — ZERO hooks that subscribe to system changes.
 * 
 * All initialization happens at module level (above). The component itself
 * has zero useState, zero useEffect, zero subscriptions. It renders once
 * and never re-renders unless its parent re-renders.
 * 
 * The View wrapper with THEME_VARS is required for NativeWind CSS variable
 * inheritance on native. But since ROOT_STYLE is a module-level constant,
 * the style prop identity never changes, so React never triggers a re-layout.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const schemeRef = useRef<ColorScheme>(INITIAL_SCHEME);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    schemeRef.current = scheme;
    try {
      nativewindColorScheme.set(scheme);
    } catch (_) {}
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  // Context value is a ref — same identity every render, never triggers consumer re-renders
  const valueRef = useRef<ThemeContextValue>({
    colorScheme: INITIAL_SCHEME,
    setColorScheme,
  });

  return (
    <ThemeContext.Provider value={valueRef.current}>
      <View style={ROOT_STYLE}>{children}</View>
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
