import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { IconName } from '@/constants/medication';
import { colors, radius } from '@/constants/theme';
import { AppText } from './AppText';

export type BadgeTone =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'ai'
  | 'violet';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

const palette: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primaryStrong },
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.surfaceAlt, fg: colors.inkSoft },
  ai: { bg: colors.aiSoft, fg: colors.ai },
  violet: { bg: colors.violetSoft, fg: colors.violet },
};

export function Badge({ label, tone = 'neutral', icon, style, size = 'md' }: BadgeProps) {
  const toneColors = palette[tone];
  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: toneColors.bg },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 12 : 14} color={toneColors.fg} /> : null}
      <AppText
        variant="caption"
        color={toneColors.fg}
        weight="bold"
        numberOfLines={1}
        style={size === 'sm' ? styles.textSm : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radius.pill,
  },
  md: { paddingHorizontal: 11, paddingVertical: 6 },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  textSm: { fontSize: 11, lineHeight: 14 },
});
