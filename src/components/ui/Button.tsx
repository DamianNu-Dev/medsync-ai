import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import type { IconName } from '@/constants/medication';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { tapFeedback } from '@/lib/haptics';
import { AppText } from './AppText';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerSoft'
  | 'success'
  | 'dark'
  | 'ai'
  | 'soft';

type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Sobrescribe el color de texto e icono (útil sobre fondos personalizados). */
  foreground?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.primarySoft, fg: colors.primaryStrong, border: colors.primarySoft },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.inkSoft, border: 'transparent' },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  dangerSoft: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  success: { bg: colors.success, fg: colors.white, border: colors.success },
  dark: { bg: colors.ink, fg: colors.white, border: colors.ink },
  ai: { bg: colors.ai, fg: colors.white, border: colors.ai },
  soft: { bg: colors.surfaceAlt, fg: colors.inkSoft, border: colors.surfaceAlt },
};

const heights: Record<ButtonSize, number> = { lg: 58, md: 50, sm: 42 };
const fontSizes: Record<ButtonSize, number> = { lg: 18, md: 16, sm: 14 };
const iconSizes: Record<ButtonSize, number> = { lg: 22, md: 20, sm: 18 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'left',
  fullWidth,
  disabled,
  loading,
  iconOnly,
  accessibilityLabel,
  accessibilityHint,
  foreground,
  style,
  textStyle,
  haptic = true,
}: ButtonProps) {
  const tone = palette[variant];
  const fg = foreground ?? tone.fg;
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic) tapFeedback();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          height: iconOnly ? heights[size] : heights[size],
          width: iconOnly ? heights[size] : undefined,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        iconOnly ? styles.iconOnly : null,
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' ? (
            <Ionicons name={icon} size={iconSizes[size]} color={fg} />
          ) : null}
          {label ? (
            <AppText
              style={[
                {
                  color: fg,
                  fontFamily: typography.title.fontFamily,
                  fontSize: fontSizes[size],
                  lineHeight: fontSizes[size] + 6,
                },
                textStyle,
              ]}
              numberOfLines={1}
              color={fg}
            >
              {label}
            </AppText>
          ) : null}
          {icon && iconPosition === 'right' ? (
            <Ionicons name={icon} size={iconSizes[size]} color={fg} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconOnly: {
    paddingHorizontal: 0,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
});
