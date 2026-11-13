import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { colors, layout } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  tab?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  tab = false,
  background = colors.bg,
  style,
  contentContainerStyle,
  edges = ['top'],
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={edges}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.scrollContent,
            padded ? styles.padded : null,
            tab ? { paddingBottom: layout.tabBarSpace } : null,
            contentContainerStyle,
          ]}
        >
          <View style={[styles.inner, style]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.inner, styles.flex, padded ? styles.padded : null, style]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
});
