import { View, StyleSheet, type ViewProps, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
  contentStyle?: ViewStyle;
}

/**
 * Maps common Tailwind class names to React Native style objects.
 * This avoids NativeWind's className processing on native, which can
 * cause component remounts and TextInput focus loss.
 */
const CLASS_MAP: Record<string, ViewStyle> = {
  "flex-1": { flex: 1 },
  "items-center": { alignItems: "center" },
  "justify-center": { justifyContent: "center" },
  "p-4": { padding: 16 },
  "p-5": { padding: 20 },
  "p-6": { padding: 24 },
  "bg-background": {}, // Already set on outerContainer
};

function classNameToStyle(className?: string): ViewStyle {
  if (!className) return {};
  const result: ViewStyle = {};
  const classes = className.trim().split(/\s+/);
  for (const cls of classes) {
    const mapped = CLASS_MAP[cls];
    if (mapped) {
      Object.assign(result, mapped);
    }
  }
  return result;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  contentStyle,
  ...props
}: ScreenContainerProps) {
  // Convert className to native style to avoid NativeWind processing
  const mappedStyle = classNameToStyle(className);

  return (
    <View
      style={styles.outerContainer}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        style={[styles.safeArea, style]}
      >
        <View style={[styles.innerContainer, mappedStyle, contentStyle]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  safeArea: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
});
