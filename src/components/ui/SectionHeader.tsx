import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, hitSlop, spacing } from '@/constants/theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.texts}>
        <AppText variant="h3" weight="bold">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.inkMuted} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
        >
          <AppText variant="label" color={colors.primary} weight="bold">
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  texts: { flex: 1 },
  subtitle: { marginTop: 2 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.6 },
});
