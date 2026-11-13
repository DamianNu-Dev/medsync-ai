import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { IconName } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  icon?: IconName;
}

interface ChoiceChipsProps<T extends string | number> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2;
  style?: StyleProp<ViewStyle>;
}

export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  columns = 2,
  style,
}: ChoiceChipsProps<T>) {
  return (
    <View style={[styles.wrap, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}${option.hint ? `, ${option.hint}` : ''}`}
            style={({ pressed }) => [
              styles.chip,
              columns === 1 ? styles.chipFull : styles.chipHalf,
              selected ? styles.chipSelected : null,
              pressed ? styles.chipPressed : null,
            ]}
          >
            <View style={styles.chipRow}>
              {option.icon ? (
                <View style={[styles.iconWrap, selected ? styles.iconWrapSelected : null]}>
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={selected ? colors.primaryStrong : colors.inkMuted}
                  />
                </View>
              ) : null}
              <View style={styles.texts}>
                <AppText
                  variant="bodyStrong"
                  color={selected ? colors.primaryStrong : colors.ink}
                  numberOfLines={2}
                >
                  {option.label}
                </AppText>
                {option.hint ? (
                  <AppText
                    variant="caption"
                    color={selected ? colors.primaryStrong : colors.inkMuted}
                    numberOfLines={2}
                  >
                    {option.hint}
                  </AppText>
                ) : null}
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 58,
    justifyContent: 'center',
    flexGrow: 1,
  },
  chipHalf: { flexBasis: '46%' },
  chipFull: { flexBasis: '100%' },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipPressed: { opacity: 0.8 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.white,
  },
  texts: { flex: 1, gap: 1 },
});
