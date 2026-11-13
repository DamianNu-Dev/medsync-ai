import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { hhmmToMinutes, minutesToHHMM, pad2 } from '@/lib/date';
import { AppText } from './AppText';
import { Stepper } from './Stepper';

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  presets?: readonly string[];
}

export function TimeField({
  value,
  onChange,
  presets = ['08:00', '12:00', '16:00', '20:00', '22:00'],
}: TimeFieldProps) {
  const total = hhmmToMinutes(value);
  const hours24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const commit = (nextHours12: number, nextMinutes: number, pm: boolean) => {
    const next24 = (nextHours12 % 12) + (pm ? 12 : 0);
    onChange(`${pad2(next24)}:${pad2(nextMinutes)}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Stepper
          label="Hora"
          value={hours12}
          min={1}
          max={12}
          onChange={(next) => commit(next, minutes, isPM)}
          formatValue={(next) => pad2(next)}
        />
        <Stepper
          label="Minutos"
          value={minutes}
          min={0}
          max={55}
          step={5}
          onChange={(next) => commit(hours12, next, isPM)}
          formatValue={(next) => pad2(next)}
        />
      </View>

      <View style={styles.meridiem}>
        {[
          { label: 'a. m.', pm: false },
          { label: 'p. m.', pm: true },
        ].map((option) => {
          const selected = isPM === option.pm;
          return (
            <Pressable
              key={option.label}
              onPress={() => commit(hours12, minutes, option.pm)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.meridiemOption, selected ? styles.meridiemSelected : null]}
            >
              <AppText
                variant="label"
                color={selected ? colors.primaryStrong : colors.inkMuted}
                weight="bold"
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <ScrollPresets value={value} presets={presets} onChange={onChange} />
    </View>
  );
}

function ScrollPresets({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.presets}>
      <AppText variant="caption" color={colors.inkMuted}>
        Horarios frecuentes
      </AppText>
      <View style={styles.presetRow}>
        {presets.map((preset) => {
          const selected = value === minutesToHHMM(hhmmToMinutes(preset));
          return (
            <Pressable
              key={preset}
              onPress={() => onChange(preset)}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${preset}`}
              style={[styles.preset, selected ? styles.presetSelected : null]}
            >
              <AppText
                variant="caption"
                weight="bold"
                color={selected ? colors.primaryStrong : colors.inkSoft}
              >
                {preset}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  meridiem: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    padding: 4,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  meridiemOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  meridiemSelected: {
    backgroundColor: colors.surface,
  },
  presets: { gap: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    minHeight: 32,
    justifyContent: 'center',
  },
  presetSelected: {
    backgroundColor: colors.primarySoft,
  },
});
