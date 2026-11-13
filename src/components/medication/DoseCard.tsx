import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { doseAmountLabel, stockNoun } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { formatMinutesDuration, formatTime } from '@/lib/date';
import { successFeedback } from '@/lib/haptics';
import { formatFrequency, getStockLevel } from '@/lib/schedule';
import { JoinedDose } from '@/store/selectors';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { AppText } from '@/components/ui/AppText';
import { DoseStatusBadge } from './DoseStatusBadge';
import { MedicationIcon } from './MedicationIcon';

interface DoseCardProps {
  item: JoinedDose;
  onTake: (id: string) => void;
  onPostpone: (id: string, minutes: number) => void;
  onSkip: (id: string, reason?: string) => void;
}

const SKIP_REASONS = [
  'Me sentí mal',
  'El médico lo indicó',
  'Ya la había tomado',
  'Se me acabó el medicamento',
];

export function DoseCard({ item, onTake, onPostpone, onSkip }: DoseCardProps) {
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState<string>(SKIP_REASONS[0]);

  const { dose, treatment, status, minutesLate } = item;
  const stockLevel = getStockLevel(treatment);
  const stockPercent =
    treatment.totalPills === 0 ? 0 : treatment.pillsRemaining / treatment.totalPills;

  const statusMessage =
    status === 'late'
      ? `Atrasada ${formatMinutesDuration(minutesLate)}. Tómala lo antes posible.`
      : status === 'missed'
        ? 'No se registró esta toma. Aún puedes registrarla o consultar a tu médico.'
        : status === 'due'
          ? 'Es la hora de tu toma.'
          : 'Toma programada.';

  const messageColor =
    status === 'late' || status === 'missed' ? colors.danger : colors.info;

  const handleTake = () => {
    successFeedback();
    onTake(dose.id);
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <Badge label={formatTime(dose.scheduledAt)} icon="time-outline" tone="neutral" />
          <DoseStatusBadge status={status} />
        </View>

        <View style={styles.medRow}>
          <MedicationIcon form={treatment.form} color={treatment.color} />
          <View style={styles.medText}>
            <AppText variant="h2" weight="bold" numberOfLines={2}>
              {treatment.name}
            </AppText>
            <AppText variant="body" color={colors.inkSoft}>
              {treatment.strength} · {doseAmountLabel(treatment.form, treatment.unitsPerDose)}
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {formatFrequency(treatment.frequencyHours)}
            </AppText>
          </View>
        </View>

        <View style={[styles.message, { backgroundColor: `${messageColor}0F` }]}>
          <Ionicons
            name={status === 'late' || status === 'missed' ? 'alert-circle' : 'information-circle'}
            size={18}
            color={messageColor}
          />
          <AppText variant="caption" color={messageColor} weight="semibold" style={styles.messageText}>
            {statusMessage}
          </AppText>
        </View>

        <View style={styles.stockWrap}>
          <View style={styles.stockHeader}>
            <View style={styles.stockLabel}>
              <Ionicons name="layers-outline" size={16} color={colors.inkMuted} />
              <AppText variant="caption" color={colors.inkMuted} weight="semibold">
                Quedan {treatment.pillsRemaining}{' '}
                {stockNoun(treatment.form, treatment.pillsRemaining)}
              </AppText>
            </View>
            {stockLevel !== 'ok' ? (
              <Badge
                label={stockLevel === 'empty' ? 'Sin stock' : 'Reponer pronto'}
                tone={stockLevel === 'empty' ? 'danger' : 'warning'}
                icon="warning-outline"
                size="sm"
              />
            ) : null}
          </View>
          <ProgressBar
            value={stockPercent}
            height={7}
            color={stockLevel === 'ok' ? colors.primary : colors.danger}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Tomar ahora"
            icon="checkmark"
            fullWidth
            onPress={handleTake}
            accessibilityLabel={`Registrar toma de ${treatment.name}`}
          />
          <View style={styles.secondaryRow}>
            <Button
              label="Posponer"
              icon="time-outline"
              variant="secondary"
              size="md"
              style={styles.flex}
              onPress={() => setPostponeOpen(true)}
            />
            <Button
              label="Omitir"
              icon="close"
              variant="dangerSoft"
              size="md"
              style={styles.flex}
              onPress={() => setSkipOpen(true)}
            />
          </View>
        </View>
      </Card>

      <Sheet
        visible={postponeOpen}
        onClose={() => setPostponeOpen(false)}
        title="Posponer esta toma"
        description="Elige cuánto tiempo más necesitas. Te lo recordaremos de nuevo."
      >
        <View style={styles.postponeGrid}>
          {[10, 15, 30, 60].map((minutes) => (
            <Button
              key={minutes}
              label={`+${minutes} min`}
              variant="secondary"
              size="md"
              style={styles.postponeButton}
              onPress={() => {
                setPostponeOpen(false);
                onPostpone(dose.id, minutes);
              }}
            />
          ))}
        </View>
        <Button
          label="Cancelar"
          variant="ghost"
          size="md"
          style={styles.sheetCancel}
          onPress={() => setPostponeOpen(false)}
        />
      </Sheet>

      <Sheet
        visible={skipOpen}
        onClose={() => setSkipOpen(false)}
        title="¿Omitir esta dosis?"
        description="Tu cuidador verá que no se registró. Si fue por indicación médica, puedes anotar el motivo."
      >
        <View style={styles.reasonList}>
          {SKIP_REASONS.map((reason) => {
            const selected = reason === skipReason;
            return (
              <Button
                key={reason}
                label={reason}
                variant={selected ? 'secondary' : 'ghost'}
                size="md"
                icon={selected ? 'radio-button-on' : 'radio-button-off'}
                fullWidth
                onPress={() => setSkipReason(reason)}
                style={styles.reasonButton}
              />
            );
          })}
        </View>
        <Button
          label="Confirmar y omitir"
          variant="danger"
          icon="close-circle"
          style={styles.confirmButton}
          onPress={() => {
            setSkipOpen(false);
            onSkip(dose.id, skipReason);
          }}
        />
        <Button
          label="Mejor no"
          variant="ghost"
          size="md"
          style={styles.sheetCancel}
          onPress={() => setSkipOpen(false)}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    borderWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  medRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  medText: { flex: 1, gap: 2 },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  messageText: { flex: 1, lineHeight: 19 },
  stockWrap: { gap: 6 },
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stockLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  actions: { gap: spacing.sm },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  postponeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  postponeButton: { flexBasis: '45%', flexGrow: 1 },
  sheetCancel: { marginTop: spacing.sm, alignSelf: 'center' },
  reasonList: { gap: 4 },
  reasonButton: { justifyContent: 'flex-start' },
  confirmButton: { marginTop: spacing.lg },
});
