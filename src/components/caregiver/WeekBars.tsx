import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { AdherenceDay } from '@/types';
import { AppText } from '@/components/ui/AppText';

interface WeekBarsProps {
  days: AdherenceDay[];
  height?: number;
}

export function WeekBars({ days, height = 64 }: WeekBarsProps) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const barColor =
          day.total === 0
            ? colors.surfaceSunken
            : day.percent >= 85
              ? colors.success
              : day.percent >= 50
                ? colors.primaryMuted
                : colors.danger;
        const barHeight = Math.max(6, Math.round((day.percent / 100) * height));

        return (
          <View
            key={day.date}
            style={styles.column}
            accessible
            accessibilityLabel={`${day.label}: ${day.percent}% de adherencia, ${day.taken} de ${day.total} tomas`}
          >
            <View style={[styles.track, { height }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: day.total === 0 ? 4 : barHeight,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <AppText
              variant="caption"
              color={day.isToday ? colors.primaryStrong : colors.inkMuted}
              weight={day.isToday ? 'bold' : 'medium'}
            >
              {day.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  track: {
    width: '100%',
    maxWidth: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: radius.xs,
  },
});
