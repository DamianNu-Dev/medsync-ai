import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { NativeAlarm } from '@/lib/nativeAlarm';
import { useAlarmAccess } from '@/hooks/useAlarmAccess';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AlarmAccessCardProps {
  compact?: boolean;
  showWhenGranted?: boolean;
}

interface AccessRow {
  key: string;
  ok: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  actionLabel: string;
  action: () => Promise<void>;
}

/**
 * Guía los permisos especiales de Android que la alarma necesita para
 * aparecer encima de cualquier app y sonar a la hora exacta. Cada permiso se
 * abre directo en su pantalla de ajustes, uno detrás del otro.
 */
export function AlarmAccessCard({
  compact = false,
  showWhenGranted = false,
}: AlarmAccessCardProps) {
  const { status, loading } = useAlarmAccess();

  if (Platform.OS !== 'android') return null;
  if (!NativeAlarm.available) return null;

  const allOk =
    status.overlay &&
    status.exactAlarm &&
    status.fullScreenIntent &&
    !status.batteryOptimized;

  if (!showWhenGranted && (loading || allOk)) return null;

  const rows: AccessRow[] = [
    {
      key: 'overlay',
      ok: status.overlay,
      icon: 'layers-outline',
      title: 'Alarma sobre otras apps',
      detail:
        'Sin este permiso la alarma solo se ve al abrir MedSync. Con él aparece encima de juegos y de cualquier aplicación.',
      actionLabel: 'Permitir',
      action: NativeAlarm.openOverlaySettings,
    },
    {
      key: 'exact',
      ok: status.exactAlarm,
      icon: 'alarm-outline',
      title: 'Alarmas a la hora exacta',
      detail:
        'Android necesita este permiso para no retrasar la alarma cuando el teléfono está en reposo.',
      actionLabel: 'Permitir',
      action: NativeAlarm.openExactAlarmSettings,
    },
    {
      key: 'fullscreen',
      ok: status.fullScreenIntent,
      icon: 'phone-portrait-outline',
      title: 'Aviso a pantalla completa',
      detail:
        'Permite que la alarma ocupe toda la pantalla y encienda el teléfono aunque esté bloqueado.',
      actionLabel: 'Permitir',
      action: NativeAlarm.openFullScreenIntentSettings,
    },
    {
      key: 'battery',
      ok: !status.batteryOptimized,
      icon: 'battery-half-outline',
      title: 'Sin ahorro de batería',
      detail:
        'Evita que el sistema suspenda la alarma cuando el teléfono lleva horas sin usarse.',
      actionLabel: 'Revisar',
      action: NativeAlarm.openBatteryOptimizationSettings,
    },
  ];

  const pending = rows.filter((row) => !row.ok);
  const visible = showWhenGranted ? rows : pending;

  if (visible.length === 0 && !showWhenGranted) return null;

  const title = allOk
    ? 'Alarma completa activa'
    : pending.length === 1
      ? 'Falta 1 permiso para la alarma'
      : `Faltan ${pending.length} permisos para la alarma`;

  return (
    <Card tone={allOk ? 'successSoft' : 'warningSoft'} style={[styles.card, compact ? styles.compact : null]}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons
            name={allOk ? 'shield-checkmark' : 'alarm'}
            size={compact ? 19 : 22}
            color={allOk ? colors.success : colors.warning}
          />
        </View>
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color={colors.inkSoft} style={styles.detail}>
            {allOk
              ? 'La alarma sonará y se abrirá encima de cualquier app hasta que verifiques tu toma.'
              : 'Actívalos en orden. Android los pide aparte de las notificaciones.'}
          </AppText>
        </View>
      </View>

      {!allOk && pending.length > 0 ? (
        <Button
          label={`Activar paso ${rows.length - pending.length + 1} de ${rows.length}`}
          icon="arrow-forward-circle-outline"
          fullWidth
          onPress={() => void pending[0].action()}
        />
      ) : null}

      <View style={styles.rows}>
        {visible.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Ionicons
                name={row.ok ? 'checkmark-circle' : row.icon}
                size={18}
                color={row.ok ? colors.success : colors.warning}
              />
              <AppText variant="caption" weight="bold" style={styles.rowTitle}>
                {row.title}
              </AppText>
            </View>
            {row.ok ? null : (
              <>
                <AppText variant="caption" color={colors.inkMuted} style={styles.rowDetail}>
                  {row.detail}
                </AppText>
                <Button
                  label={row.actionLabel}
                  icon="open-outline"
                  variant="outline"
                  size="sm"
                  fullWidth
                  onPress={() => void row.action()}
                />
              </>
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  compact: { gap: spacing.sm, padding: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  detail: { lineHeight: 17 },
  rows: { gap: spacing.sm },
  row: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: { flex: 1 },
  rowDetail: { lineHeight: 17 },
});
