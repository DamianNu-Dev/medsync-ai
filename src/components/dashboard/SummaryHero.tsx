import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { DashboardData } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface SummaryHeroProps {
  data: DashboardData;
}

export function SummaryHero({ data }: SummaryHeroProps) {
  const { summary, nextDose } = data;
  const progress = summary.total === 0 ? 0 : summary.taken / summary.total;

  return (
    <LinearGradient
      colors={['#0C755F', '#06483B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.topRow}>
        <View style={styles.pill}>
          <AppText variant="overline" color={colors.white}>
            Hoy
          </AppText>
        </View>
        {summary.actionable > 0 ? (
          <View style={styles.alertPill}>
            <Ionicons name="alarm" size={13} color="#7A1A14" />
            <AppText variant="caption" weight="bold" color="#7A1A14">
              {summary.actionable} por registrar
            </AppText>
          </View>
        ) : (
          <View style={styles.okPill}>
            <Ionicons name="checkmark-circle" size={14} color="#D8F6E9" />
            <AppText variant="caption" weight="semibold" color="#D8F6E9">
              Al día
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.countRow}>
        <AppText variant="display" color={colors.white}>
          {summary.taken}
        </AppText>
        <AppText variant="h3" color="rgba(255,255,255,0.62)" style={styles.total}>
          / {summary.total}
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.8)" style={styles.countLabel}>
          tomas registradas
        </AppText>
      </View>

      <ProgressBar
        value={progress}
        height={9}
        color={colors.white}
        trackColor="rgba(255,255,255,0.22)"
        style={styles.progress}
      />

      <View style={styles.footer}>
        <View style={styles.metric}>
          <AppText variant="caption" color="rgba(255,255,255,0.65)">
            Adherencia de hoy
          </AppText>
          <AppText variant="title" color={colors.white} weight="bold">
            {summary.adherence}%
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.next}>
          <AppText variant="caption" color="rgba(255,255,255,0.65)">
            Próxima toma
          </AppText>
          <View style={styles.nextRow}>
            <Ionicons name="time-outline" size={15} color={colors.white} style={styles.nextIcon} />
            <AppText variant="bodyStrong" color={colors.white} numberOfLines={1} style={styles.nextText}>
              {nextDose ? formatTime(nextDose.dose.scheduledAt) : 'Sin tomas pendientes'}
            </AppText>
          </View>
          {nextDose ? (
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.72)"
              numberOfLines={1}
              style={styles.nextName}
            >
              {nextDose.treatment.name}
            </AppText>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD9D3',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  okPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  total: {
    marginBottom: 7,
    marginLeft: 2,
  },
  countLabel: {
    marginBottom: 9,
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  progress: { marginTop: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  metric: { minWidth: 96 },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  next: { flex: 1, gap: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  nextIcon: { marginTop: 3 },
  nextText: { flex: 1 },
  nextName: { marginLeft: 20 },
});
