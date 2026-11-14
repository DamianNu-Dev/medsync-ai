import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { warningFeedback } from '@/lib/haptics';
import { verifyPillInMouth } from '@/lib/verification';
import { useAI } from '@/store/AIProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PillVerifyModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
}

type Phase = 'camera' | 'checking' | 'failed';

export function PillVerifyModal({
  visible,
  onClose,
  onVerified,
}: PillVerifyModalProps) {
  const { settings } = useAI();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<React.ComponentRef<typeof CameraView>>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPhase('camera');
    setPhoto(null);
    setMessage(null);
    setBusy(false);
  }, [visible]);

  const reset = () => {
    setPhase('camera');
    setPhoto(null);
    setMessage(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const shot = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.45,
      });
      if (!shot?.base64) {
        setMessage('No pudimos leer la foto. Intenta de nuevo con más luz.');
        setBusy(false);
        return;
      }
      setPhoto({ uri: shot.uri, base64: shot.base64 });
      setPhase('checking');
      const result = await verifyPillInMouth(shot.base64, 'image/jpeg', settings);
      if (result.verified) {
        onVerified();
        reset();
      } else {
        warningFeedback();
        setMessage(result.reason);
        setPhase('failed');
      }
    } catch (error) {
      warningFeedback();
      const text =
        error instanceof Error
          ? error.message
          : 'No pudimos verificar la foto.';
      setMessage(text);
      setPhase('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="caption" color={colors.inkMuted} weight="semibold">
              Verificación de toma
            </AppText>
            <AppText variant="h3" weight="bold">
              Muestra la pastilla en tu boca
            </AppText>
          </View>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Cerrar verificación"
            style={styles.close}
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
              {phase === 'checking' ? (
                <View style={styles.checkingOverlay}>
                  <ActivityIndicator color={colors.white} size="large" />
                  <AppText variant="bodyStrong" color={colors.white}>
                    Verificando con IA…
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : permission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.image}
                facing="front"
                mute
              />
              <View style={styles.frame}>
                <View style={styles.faceGuide} />
                <View style={styles.hintPill}>
                  <Ionicons name="scan-outline" size={14} color={colors.white} />
                  <AppText variant="caption" color={colors.white} weight="semibold">
                    Boca abierta y pastilla visible
                  </AppText>
                </View>
              </View>
            </View>
          ) : (
            <Card style={styles.permissionCard}>
              <Ionicons name="camera-outline" size={30} color={colors.primary} />
              <AppText variant="bodyStrong" align="center">
                Necesitamos la cámara frontal
              </AppText>
              <AppText variant="caption" color={colors.inkMuted} align="center">
                La foto se usa solo para confirmar que la pastilla está en tu boca.
              </AppText>
              <Button
                label="Permitir cámara"
                icon="camera"
                onPress={() => void requestPermission()}
              />
              {permission && !permission.canAskAgain && Platform.OS !== 'web' ? (
                <Button
                  label="Abrir ajustes del teléfono"
                  icon="settings-outline"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    void Linking.openSettings().catch(() => undefined);
                  }}
                />
              ) : null}
              {Platform.OS === 'web' ? (
                <AppText variant="caption" color={colors.inkMuted} align="center">
                  Si el navegador bloqueó la cámara, actívala desde el ícono de la barra de
                  direcciones y vuelve a intentarlo.
                </AppText>
              ) : null}
            </Card>
          )}

          {phase === 'failed' ? (
            <Card tone="dangerSoft" style={styles.manualCard}>
              <View style={styles.manualHeader}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <AppText variant="bodyStrong" color={colors.danger}>
                  No pudimos verificar la toma
                </AppText>
              </View>
              <AppText variant="caption" color={colors.inkSoft} style={styles.manualText}>
                {message ??
                  'La imagen no muestra con claridad la pastilla en la boca. Intenta otra vez.'}
              </AppText>
            </Card>
          ) : null}

          <View style={styles.actions}>
            {phase === 'camera' && permission?.granted ? (
              <Button
                label={busy ? 'Tomando foto…' : 'Tomar foto y verificar'}
                icon="camera"
                size="lg"
                fullWidth
                loading={busy}
                onPress={() => void takePhoto()}
              />
            ) : null}

            {phase === 'failed' ? (
              <>
                <Button
                  label="Intentar otra vez"
                  icon="camera"
                  size="lg"
                  fullWidth
                  onPress={reset}
                />
                <Button
                  label="Volver a la alarma"
                  variant="ghost"
                  size="md"
                  onPress={close}
                />
              </>
            ) : null}
          </View>

          <View style={styles.note}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.inkMuted} />
            <AppText variant="caption" color={colors.inkMuted} style={styles.noteText}>
              La verificación visual es una ayuda: no confirma la ingestión, solo que la pastilla se ve en la boca.
            </AppText>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 1 },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  preview: {
    flex: 1,
    minHeight: 320,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#081512',
  },
  cameraContainer: {
    flex: 1,
    minHeight: 320,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#081512',
    position: 'relative',
  },
  image: { flex: 1, width: '100%' },
  frame: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  faceGuide: {
    width: '62%',
    height: '58%',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hintPill: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  checkingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,32,27,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  permissionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  manualCard: { gap: spacing.sm },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualText: { lineHeight: 18 },
  actions: { gap: spacing.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingBottom: spacing.sm,
  },
  noteText: { flex: 1, lineHeight: 16 },
});
