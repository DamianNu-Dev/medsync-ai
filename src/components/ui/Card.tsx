import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/constants/theme';

export type CardTone =
  | 'surface'
  | 'alt'
  | 'primary'
  | 'dark'
  | 'danger'
  | 'dangerSoft'
  | 'warningSoft'
  | 'successSoft'
  | 'infoSoft'
  | 'aiSoft'
  | 'primarySoft'
  | 'outline'
  | 'transparent';

interface CardProps {
  children: React.ReactNode;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
}

const toneStyles: Record<CardTone, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderColor: 'transparent' },
  alt: { backgroundColor: colors.surfaceAlt, borderColor: 'transparent' },
  primary: { backgroundColor: colors.primary, borderColor: 'transparent' },
  dark: { backgroundColor: colors.ink, borderColor: 'transparent' },
  danger: { backgroundColor: colors.danger, borderColor: 'transparent' },
  dangerSoft: { backgroundColor: colors.dangerSoft, borderColor: 'transparent' },
  warningSoft: { backgroundColor: colors.warningSoft, borderColor: 'transparent' },
  successSoft: { backgroundColor: colors.successSoft, borderColor: 'transparent' },
  infoSoft: { backgroundColor: colors.infoSoft, borderColor: 'transparent' },
  aiSoft: { backgroundColor: colors.aiSoft, borderColor: 'transparent' },
  primarySoft: { backgroundColor: colors.primarySoft, borderColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  transparent: { backgroundColor: 'transparent', borderColor: 'transparent' },
};

export function Card({
  children,
  tone = 'surface',
  style,
  onPress,
  accessibilityLabel,
  padded = true,
}: CardProps) {
  const content = (
    <View
      style={[
        styles.base,
        toneStyles[tone],
        padded ? styles.padded : null,
        tone === 'surface' ? shadows.soft : null,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.xl,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
});
