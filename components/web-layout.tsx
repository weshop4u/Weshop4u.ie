import { View, Platform, ScrollView, StyleSheet } from "react-native";
import { WebHeader } from "./web-header";
import { WebFooter } from "./web-footer";

interface WebLayoutProps {
  children: React.ReactNode;
  /** Max width for the content area. Defaults to 1200 */
  maxWidth?: number;
  /** Whether to show the footer. Defaults to true */
  showFooter?: boolean;
  /** Whether to constrain content width. Defaults to true */
  constrainWidth?: boolean;
}

/**
 * Web-specific layout wrapper.
 * On web: adds header, constrains content width, adds footer.
 * On native: just renders children as-is.
 */
export function WebLayout({ children, maxWidth = 1200, showFooter = true, constrainWidth = true }: WebLayoutProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <WebHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[
          styles.content,
          constrainWidth && { maxWidth, alignSelf: "center" as const, width: "100%" as any },
        ]}>
          {children}
        </View>
        {showFooter && <WebFooter />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
