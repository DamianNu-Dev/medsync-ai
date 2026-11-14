import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { useNotifications } from '@/store/NotificationProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlarmTestButtons } from '@/components/notifications/AlarmTestButtons';

interface NotificationPermissionCardProps {
  compact?: boolean;
  showWhenGranted?: boolean;
}

export function NotificationPermissionCard({
  compact = false,
  showWhenGranted = false,
}: NotificationPermissionCardProps) {
  const { permission, loading, request, requestExact, openSettings } = useNotifications();

  if (Platform.OS === 'web') return null;

  const granted = permission.status === 'granted';
  const needsExactAlarm = granted && !permission.exactAlarm;
  // En el inicio basta con avisar mientras falta el permiso. Una vez
  // concedido, los detalles y las pruebas viven en el perfil.
  if (granted && !showWhenGranted) return null;

  const tone = granted ? 'successSoft' : permission.status === 'denied' ? 'warningSoft' : 'infoSoft';
  const icon = granted ? 'notifications' : permission.status === 'denied' ? 'notifications-off' : 'notifications-outline';
  const title = granted
    ? needsExactAlarm
      ? permission.exactAlarmCanAsk
        ? 'Alarmas exactas'
        : 'Aviso con la pantalla bloqueada'
      : 'Recordatorios activos'
    : permission.status === 'denied'
      ? 'Notificaciones bloqueadas'
      : 'Activa los recordatorios';

  const detail = granted
    ? needsExactAlarm
      ? permission.exactAlarmCanAsk
        ? 'Para que el aviso suene a la hora exacta, permite las alarmas exactas en Android.'
        : 'Tu teléfono puede retrasar el aviso unos minutos. En la app instalada la alarma exacta se activa automáticamente.'
      : 'Tu teléfono te avisará a la hora de cada toma. La alarma interna seguirá pidiendo la verificación con la cámara.'
    : permission.status === 'denied'
      ? 'El sistema bloqueó los avisos. Puedes activarlos desde los ajustes del teléfono.'
      : 'Permite que tu teléfono te avise a la hora de la toma. La alarma interna seguirá funcionando igual.';

  return (
    <Card tone={tone} style={[styles.card, compact ? styles.compact : null]}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons
            name={icon}
            size={compact ? 19 : 22}
            color={granted ? colors.success : permission.status === 'denied' ? colors.warning : colors.info}
          />
        </View>
        <View style={styles.text}>
          <AppText variant={compact ? 'bodyStrong' : 'bodyStrong'}>{title}</AppText>
          <AppText variant="caption" color={colors.inkSoft} style={styles.detail}>
            {detail}
          </AppText>
        </View>
      </View>

      {granted ? (
        <>
          {needsExactAlarm ? (
            permission.exactAlarmCanAsk ? (
              <Button
                label="Permitir alarmas exactas"
                icon="alarm-outline"
                variant="outline"
                size="md"
                fullWidth
                onPress={() => void requestExact()}
              />
            ) : null
          ) : (
            <Button
              label="Abrir ajustes de notificaciones"
              icon="settings-outline"
              variant="ghost"
              size="sm"
              onPress={() => void openSettings()}
            />
          )}
          <AlarmTestButtons />
        </>
      ) : permission.status === 'denied' && !permission.canAskAgain ? (
        <Button
          label="Abrir ajustes del teléfono"
          icon="settings-outline"
          variant="outline"
          size="md"
          fullWidth
          onPress={() => void openSettings()}
        />
      ) : (
        <Button
          label="Permitir notificaciones"
          icon="notifications-outline"
          size="md"
          fullWidth
          loading={loading}
          onPress={() => void request()}
        />
      )}
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
  text: { flex: 1, gap: 2 },
  detail: { lineHeight: 17 },
});
