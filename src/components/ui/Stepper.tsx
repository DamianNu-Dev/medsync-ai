import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef } from 'react';
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

/** Mantener pulsado acelera el cambio (útil para minutos o días). */
const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 80;

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

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const holdDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldValue = useRef(false);

  const stopHold = useCallback(() => {
    if (holdDelay.current) {
      clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const update = (delta: number) => {
    const next = Math.min(max, Math.max(min, valueRef.current + delta));
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };

  const startHold = (delta: number) => {
    stopHold();
    heldValue.current = false;
    holdDelay.current = setTimeout(() => {
      holdDelay.current = null;
      heldValue.current = true;
      update(delta);
      holdInterval.current = setInterval(() => update(delta), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  const finishHold = () => {
    stopHold();
    const didHold = heldValue.current;
    heldValue.current = false;
    return didHold;
  };

  const handlePress = (delta: number) => {
    // Si hubo repetición al mantener pulsado, no sumar un paso extra.
    if (finishHold()) return;
    update(delta);
  };

  const renderButton = (
    delta: number,
    enabled: boolean,
    icon: React.ComponentProps<typeof Ionicons>['name'],
    accessibilityLabel: string,
  ) => (
    <Pressable
      onPressIn={() => {
        if (enabled) startHold(delta);
      }}
      onPressOut={() => {
        if (enabled) stopHold();
      }}
      onPress={() => {
        if (enabled) handlePress(delta);
      }}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        !enabled ? styles.disabled : null,
        pressed && enabled ? styles.pressed : null,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <AppText variant="caption" color={colors.inkMuted} weight="semibold" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.control}>
        {renderButton(
          -step,
          canDecrease,
          'remove',
          `${label ?? 'Valor'}: disminuir`,
        )}
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
        {renderButton(step, canIncrease, 'add', `${label ?? 'Valor'}: aumentar`)}
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
