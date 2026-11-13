import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { doseAmountLabel } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { JoinedDose } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { DoseStatusBadge } from './DoseStatusBadge';
import { MedicationIcon } from './MedicationIcon';

interface DoseRowProps {
  item: JoinedDose;
  onPress?: () => void;
  /** Etiqueta de día (por ejemplo “13 nov”) para listas de varios días. */
  dayLabel?: string;
}

export function DoseRow({ item, onPress, dayLabel }: DoseRowProps) {
  const content = (
    <View style={styles.container}>
      <View style={styles.timeBox}>
        <AppText variant="label" weight="bold" color={colors.inkSoft}>
          {formatTime(item.dose.scheduledAt)}
        </AppText>
        {dayLabel ? (
          <AppText variant="caption" color={colors.inkMuted}>
            {dayLabel}
          </AppText>
        ) : null}
      </View>
      <MedicationIcon form={item.treatment.form} color={item.treatment.color} size={42} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.treatment.name}
        </AppText>
        <View style={styles.metaRow}>
          <AppText
            variant="caption"
            color={colors.inkMuted}
            numberOfLines={1}
            style={styles.metaText}
          >
            {item.treatment.strength} ·{' '}
            {doseAmountLabel(item.treatment.form, item.treatment.unitsPerDose)}
          </AppText>
          <DoseStatusBadge status={item.status} size="sm" />
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.treatment.name}, ${formatTime(item.dose.scheduledAt)}`}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  timeBox: {
    minWidth: 70,
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
});
