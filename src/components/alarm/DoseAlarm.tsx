import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import { successFeedback } from '@/lib/haptics';
import { useNow } from '@/hooks/useNow';
import { useAuth } from '@/store/AuthProvider';
import { useApp } from '@/store/AppProvider';
import { getDashboardData } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PillVerifyModal } from '@/components/alarm/PillVerifyModal';

const ALARM_WINDOW_MINUTES = 120;

export function DoseAlarm() {
  const { state, actions } = useApp();
  const { mode } = useAuth();
  const now = useNow(5_000);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [completed, setCompleted] = useState<{
    name: string;
    strength: string;
  } | null>(null);
  const player = useAudioPlayer(require('../../../assets/alarm.wav'));
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmReadyRef = useRef(false);
  const [alarmBlocked, setAlarmBlocked] = useState(false);

  const isAuthenticated = mode === 'account' || mode === 'local';

  const data = useMemo(() => getDashboardData(state, now), [state, now]);

  const target = useMemo(() => {
    return data.actionable.find((item) => {
      const minutes = (now.getTime() - new Date(item.dose.scheduledAt).getTime()) / 60000;
      return minutes <= ALARM_WINDOW_MINUTES;
    });
  }, [data.actionable, now]);

  const active =
    isAuthenticated &&
    state.roleChosen &&
    state.role === 'patient' &&
    state.alarmEnabled &&
    Boolean(target) &&
    !completed &&
    alarmReadyRef.current &&
    !alarmBlocked;

  useEffect(() => {
    if (!isAuthenticated) {
      setAlarmBlocked(true);
      return;
    }
    // Pequeño retraso antes de activar la alarma al cargar la app
    // para que el usuario vea la pantalla primero
    const timer = setTimeout(() => {
      alarmReadyRef.current = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!active) {
      try {
        player.pause();
      } catch {
        // no-op
      }
      Vibration.cancel();
      return;
    }

    try {
      player.loop = true;
      player.volume = 1;
      player.seekTo(0);
      player.play();
    } catch {
      // El navegador puede bloquear el audio hasta una interacción.
    }
    Vibration.vibrate([0, 700, 300, 700], true);

    return () => {
      try {
        player.pause();
      } catch {
        // no-op
      }
      Vibration.cancel();
    };
  }, [active, player]);

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [active]);

  useEffect(() => {
    if (!completed) return;
    successTimer.current = setTimeout(() => setCompleted(null), 2400);
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [completed]);

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      Vibration.cancel();
    },
    [],
  );

  if (!active && !completed) return null;

  const handleVerified = () => {
    if (!target) return;
    setVerifyOpen(false);
    setCompleted({
      name: target.treatment.name,
      strength: target.treatment.strength,
    });
    successFeedback();
    actions.takeDose(target.dose.id);
  };

  const shareHelp = async () => {
    try {
      await Share.share({
        message: `Necesito ayuda con mi toma de ${target?.treatment.name ?? 'medicamento'}. Abre MedSync AI para revisar mi tratamiento.`,
      });
    } catch {
      // no-op
    }
  };

  if (completed) {
    return (
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#0C755F', '#06483B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          <SafeAreaView style={styles.successSafe} edges={['top', 'bottom']}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={54} color={colors.primary} />
            </View>
            <AppText variant="h1" color={colors.white} weight="extrabold" align="center">
              Toma verificada
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.82)" align="center">
              {completed.name} · {completed.strength}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.7)" align="center">
              Tu cuidador ya puede ver el registro.
            </AppText>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  if (!target) return null;

  const minutesLate = Math.max(0, target.minutesLate);
  const lateLabel =
    minutesLate >= 60
      ? `${Math.floor(minutesLate / 60)} h ${minutesLate % 60} min`
      : `${minutesLate} min`;

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['#8E1B15', '#4A0C09']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topRow}>
            <View style={styles.livePill}>
              <View style={styles.dot} />
              <AppText variant="caption" color={colors.white} weight="bold">
                Alarma activa
              </AppText>
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.7)">
              {formatTime(target.dose.scheduledAt)}
            </AppText>
          </View>

          <View style={styles.hero}>
            <View style={styles.bell}>
              <Ionicons name="alarm" size={34} color={colors.white} />
            </View>
            <AppText variant="h1" color={colors.white} weight="extrabold" align="center">
              Es hora de tu toma
            </AppText>
            <AppText variant="h2" color={colors.white} weight="bold" align="center">
              {target.treatment.name}
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.82)" align="center">
              {target.treatment.strength} ·{' '}
              {target.treatment.unitsPerDose}{' '}
              {target.treatment.unitsPerDose === 1 ? 'unidad' : 'unidades'}
            </AppText>
            {minutesLate > 0 ? (
              <AppText variant="caption" color="rgba(255,255,255,0.7)" align="center">
                Llevas {lateLabel} de retraso
              </AppText>
            ) : null}
          </View>

          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Ionicons name="scan-outline" size={22} color={colors.white} />
              <AppText variant="bodyStrong" color={colors.white}>
                Para apagar la alarma
              </AppText>
            </View>
            <AppText variant="body" color="rgba(255,255,255,0.85)" style={styles.instructionText}>
              Toma tu pastilla y muestra la boca abierta con la pastilla visible a la cámara
              frontal. La alarma seguirá sonando hasta verificarlo.
            </AppText>
            <View style={styles.steps}>
              <Step number="1" text="Toma la pastilla" />
              <Step number="2" text="Abre la boca frente a la cámara" />
              <Step number="3" text="Espera la verificación" />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Verificar con la cámara"
              icon="camera"
              size="lg"
              fullWidth
              foreground={colors.danger}
              onPress={() => setVerifyOpen(true)}
              style={styles.verifyButton}
            />
            <View style={styles.secondaryRow}>
              <Button
                label="Llamar a mi cuidador"
                icon="call-outline"
                variant="outline"
                size="md"
                onPress={() => {
                  void Linking.openURL(
                    `tel:${state.profile.phone.replace(/\s+/g, '')}`,
                  ).catch(() => undefined);
                }}
                style={styles.secondaryButton}
              />
              <Button
                label="Pedir ayuda"
                icon="share-social-outline"
                variant="ghost"
                size="md"
                foreground={colors.white}
                onPress={() => void shareHelp()}
                style={styles.secondaryButton}
              />
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.55)" align="center">
              Si no puedes tomar la pastilla, llama a tu médico o a tu cuidador.
            </AppText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <PillVerifyModal
        visible={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onVerified={handleVerified}
      />
    </View>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <AppText variant="caption" color={colors.white} weight="bold">
          {number}
        </AppText>
      </View>
      <AppText variant="caption" color="rgba(255,255,255,0.85)" style={styles.stepText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  fill: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFB4A9',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bell: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  instructionCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructionText: { lineHeight: 22 },
  steps: { gap: 7, marginTop: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  actions: { gap: spacing.sm },
  verifyButton: {
    backgroundColor: colors.white,
  },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1 },
  successSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  successIcon: {
    width: 108,
    height: 108,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
