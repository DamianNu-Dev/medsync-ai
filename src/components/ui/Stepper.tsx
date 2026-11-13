import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  formatValue?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  suffix,
  formatValue,
  style,
}: StepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  const update = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <AppText variant="caption" color={colors.inkMuted} weight="semibold" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.control}>
        <Pressable
          onPress={() => update(-step)}
          disabled={!canDecrease}
          accessibilityRole="button"
          accessibilityLabel={`${label ?? 'Valor'}: disminuir`}
          style={({ pressed }) => [
            styles.button,
            !canDecrease ? styles.disabled : null,
            pressed && canDecrease ? styles.pressed : null,
          ]}
        >
          <Ionicons name="remove" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.valueWrap}>
          <AppText variant="h3" weight="bold" numberOfLines={1} adjustsFontSizeToFit>
            {formatValue ? formatValue(value) : value}
          </AppText>
          {suffix ? (
            <AppText variant="caption" color={colors.inkMuted}>
              {suffix}
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={() => update(step)}
          disabled={!canIncrease}
          accessibilityRole="button"
          accessibilityLabel={`${label ?? 'Valor'}: aumentar`}
          style={({ pressed }) => [
            styles.button,
            !canIncrease ? styles.disabled : null,
            pressed && canIncrease ? styles.pressed : null,
          ]}
        >
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 6 },
  label: { marginLeft: 2 },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 5,
    minHeight: 58,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: 4,
  },
  pressed: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.3 },
});
