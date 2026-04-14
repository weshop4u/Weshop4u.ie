import { View, Platform, ScrollView, StyleSheet, forwardRef } from 'react-native';
import { WebHeader } from './web-header';
import { WebFooter } from './web-footer';

export const WebLayoutScrollRef = { current: null as ScrollView | null };

interface WebLayoutProps {
  children: React.ReactNode;
  maxWidth?: number;
  showFooter?: boolean;
  constrainWidth?: boolean;
}

export function WebLayout({ children, maxWidth = 1200, showFooter = true, constrainWidth = true }: WebLayoutProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={styles.root}>
      <WebHeader />
      <ScrollView
        ref={(ref) => { WebLayoutScrollRef.current = ref; }}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, constrainWidth && { maxWidth, alignSelf: 'center' as const, width: '100%' as any }]}>
          {children}
        </View>
        {showFooter && <WebFooter />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
});
