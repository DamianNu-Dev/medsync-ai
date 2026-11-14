import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Vibration, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { configurePlayer } from '@/lib/audio';
import { scheduleTestAlarmNotification } from '@/lib/notifications';
import { useApp } from '@/store/AppProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';

/**
 * Botones para comprobar que el teléfono realmente suena y vibra.
 * El aviso programado sirve para probar con la pantalla bloqueada.
 */
export function AlarmTestButtons() {
  const { actions } = useApp();
  const player = useAudioPlayer(require('../../../assets/alarm.wav'));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Vibration.cancel();
    },
    [],
  );

  if (Platform.OS === 'web') return null;

  const playNow = async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      configurePlayer(player, { loop: false, volume: 1, restart: true });
      player.play();
      Vibration.vibrate([0, 800, 350, 800]);
      setPlaying(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          player.pause();
        } catch {
          // no-op
        }
        Vibration.cancel();
        setPlaying(false);
      }, 5000);
    } catch {
      actions.showToast('No se pudo reproducir el sonido de prueba', 'error');
    }
  };

  const notifyLater = async () => {
    const scheduled = await scheduleTestAlarmNotification(10);
    actions.showToast(
      scheduled
        ? 'Aviso en 10 segundos. Bloquea el teléfono para probarlo.'
        : 'Primero permite las notificaciones del teléfono.',
      scheduled ? 'success' : 'error',
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
        </View>
        <AppText variant="caption" color={colors.inkSoft} style={styles.text}>
          Comprueba que el teléfono suena y vibra. El aviso de 10 segundos también
          funciona con la pantalla bloqueada.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label={playing ? 'Sonando…' : 'Probar sonido'}
          icon="volume-high-outline"
          variant="outline"
          size="sm"
          style={styles.flex}
          onPress={() => void playNow()}
        />
        <Button
          label="Aviso en 10 s"
          icon="notifications-outline"
          variant="outline"
          size="sm"
          style={styles.flex}
          onPress={() => void notifyLater()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
});
