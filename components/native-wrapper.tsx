import React from "react";
import { Platform } from "react-native";
import { WebLayout } from "@/components/web-layout";

/**
 * Stable wrapper component for native platforms.
 * 
 * CRITICAL: This MUST be defined outside of any component function.
 * Defining it inline (as an arrow function inside a component) creates
 * a NEW component type on every render, causing React to unmount and
 * remount the entire subtree — destroying TextInput focus, FlatList
 * scroll position, and all component state.
 * 
 * On web: uses WebLayout (header/footer chrome)
 * On native: passes children through with no wrapper (Fragment)
 */
function NativePassthrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Use this as the Wrapper component in all screens.
 * It's a stable reference that never changes between renders.
 * 
 * Usage:
 * ```tsx
 * import { ScreenWrapper } from "@/components/native-wrapper";
 * 
 * export default function MyScreen() {
 *   return (
 *     <ScreenWrapper>
 *       <ScreenContainer>
 *         ...
 *       </ScreenContainer>
 *     </ScreenWrapper>
 *   );
 * }
 * ```
 */
export const ScreenWrapper = Platform.OS === "web" ? WebLayout : NativePassthrough;
