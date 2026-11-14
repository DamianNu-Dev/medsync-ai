import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { stockNoun } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { formatFrequency, getStockLevel, getStockPercent } from '@/lib/schedule';
import { Treatment } from '@/types';
import { JoinedDose } from '@/store/selectors';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AppText } from '@/components/ui/AppText';
import { MedicationIcon } from '@/components/medication/MedicationIcon';

interface TreatmentCardProps {
  treatment: Treatment;
  nextDose?: JoinedDose;
  onPress: () => void;
  onDelete?: () => void;
}

export function TreatmentCard({ treatment, nextDose, onPress, onDelete }: TreatmentCardProps) {
  const level = getStockLevel(treatment);

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${treatment.name}, ${treatment.strength}, ${formatFrequency(
        treatment.frequencyHours,
      )}`}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <MedicationIcon form={treatment.form} color={treatment.color} size={50} />
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            <AppText variant="h3" weight="bold" numberOfLines={1} style={styles.name}>
              {treatment.name}
            </AppText>
            {!treatment.active ? <Badge label="En pausa" tone="neutral" size="sm" /> : null}
          </View>
          <AppText variant="body" color={colors.inkMuted} numberOfLines={2}>
            {treatment.strength} · {formatFrequency(treatment.frequencyHours)}
          </AppText>
        </View>
        <View style={styles.actions}>
          {onDelete ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${treatment.name}`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="alarm-outline" size={15} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkSoft} numberOfLines={1}>
            {nextDoseLabel(treatment, nextDose)}
          </AppText>
        </View>
        <Badge
          label={`${treatment.pillsRemaining} ${stockNoun(
            treatment.form,
            treatment.pillsRemaining,
          )}`}
          tone={level === 'ok' ? 'neutral' : level === 'low' ? 'warning' : 'danger'}
          size="sm"
        />
      </View>

      <ProgressBar
        value={getStockPercent(treatment)}
        height={6}
        color={level === 'ok' ? treatment.color : colors.danger}
      />
    </Card>
  );
}

function nextDoseLabel(treatment: Treatment, nextDose?: JoinedDose): string {
  if (!treatment.active) return 'Tratamiento pausado';
  if (!nextDose) return 'Sin próximas tomas';

  const time = formatTime(nextDose.dose.scheduledAt);
  switch (nextDose.status) {
    case 'upcoming':
      return `Próxima ${time}`;
    case 'due':
      return `Pendiente ${time}`;
    case 'late':
      return `Atrasada ${time}`;
    case 'missed':
      return `Sin registrar ${time}`;
    default:
      return `Pendiente ${time}`;
  }
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  texts: { flex: 1, gap: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { flexShrink: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
});
