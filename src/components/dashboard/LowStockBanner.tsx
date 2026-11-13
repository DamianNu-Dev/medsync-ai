import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { stockNoun } from '@/constants/medication';
import { colors, radius, spacing } from '@/constants/theme';
import { getStockLevel } from '@/lib/schedule';
import { Treatment } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';

interface LowStockBannerProps {
  treatments: Treatment[];
  onPress: () => void;
}

export function LowStockBanner({ treatments, onPress }: LowStockBannerProps) {
  if (treatments.length === 0) return null;

  const first = treatments[0];
  const empty = treatments.some((treatment) => getStockLevel(treatment) === 'empty');
  const name =
    treatments.length === 1 ? first.name : `${first.name} y ${treatments.length - 1} más`;

  return (
    <Card
      tone={empty ? 'dangerSoft' : 'warningSoft'}
      onPress={onPress}
      accessibilityLabel={`Alerta de inventario: ${name}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: empty ? colors.danger : colors.warning }]}>
          <Ionicons
            name={empty ? 'alert-circle' : 'warning-outline'}
            size={22}
            color={colors.white}
          />
        </View>
        <View style={styles.texts}>
          <AppText variant="bodyStrong" color={empty ? colors.danger : colors.warning}>
            {empty ? 'Te quedaste sin dosis' : 'Te quedan pocas dosis'}
          </AppText>
          <AppText variant="caption" color={colors.inkSoft} style={styles.detail}>
            {treatments.length === 1
              ? `${first.name}: quedan ${first.pillsRemaining} ${stockNoun(
                  first.form,
                  first.pillsRemaining,
                )}. Repón para no interrumpir el tratamiento.`
              : `${name} necesitan reposición pronto.`}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  detail: { lineHeight: 18 },
});
