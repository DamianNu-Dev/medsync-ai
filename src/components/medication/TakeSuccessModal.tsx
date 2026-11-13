import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { doseAmountLabel, stockNoun } from '@/constants/medication';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { getStockLevel } from '@/lib/schedule';
import { JoinedDose } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { SuccessCheck } from '@/components/ui/SuccessCheck';

interface TakeSuccessModalProps {
  item: JoinedDose | null;
  remaining: number;
  onClose: () => void;
  onUndo: () => void;
}

export function TakeSuccessModal({
  item,
  remaining,
  onClose,
  onUndo,
}: TakeSuccessModalProps) {
  if (!item) return null;

  const { treatment, dose } = item;
  const lowStock = remaining < treatment.lowStockThreshold;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar confirmación"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <SuccessCheck size={78} />
          <AppText variant="h2" align="center" weight="bold" style={styles.title}>
            ¡Toma registrada!
          </AppText>
          <AppText variant="body" align="center" color={colors.inkSoft}>
            {treatment.name} · {doseAmountLabel(treatment.form, treatment.unitsPerDose)}
          </AppText>
          <AppText variant="caption" align="center" color={colors.inkMuted}>
            Registrada a las {formatTime(dose.takenAt ?? new Date())}
          </AppText>

          <View style={[styles.stock, lowStock ? styles.stockLow : null]}>
            <Ionicons
              name={lowStock ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={lowStock ? colors.warning : colors.success}
            />
            <AppText
              variant="caption"
              weight="semibold"
              color={lowStock ? colors.warning : colors.success}
              style={styles.stockText}
            >
              Quedan {remaining} {stockNoun(treatment.form, remaining)}
              {lowStock ? ' · Conviene reponer' : ''}
            </AppText>
          </View>

          <Button label="Listo" fullWidth onPress={onClose} style={styles.primary} />
          <Button
            label="Deshacer registro"
            variant="ghost"
            size="md"
            icon="arrow-undo"
            onPress={onUndo}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.floating,
  },
  title: { marginTop: spacing.sm },
  stock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  stockLow: { backgroundColor: colors.warningSoft },
  stockText: { flexShrink: 1 },
  primary: { marginTop: spacing.md },
});
