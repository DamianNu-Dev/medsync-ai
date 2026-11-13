import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { doseAmountLabel, formLabel, stockNoun } from '@/constants/medication';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import {
  combineDateTime,
  formatTime,
  toDateKey,
} from '@/lib/date';
import { successFeedback } from '@/lib/haptics';
import { analyzePrescription } from '@/lib/prescription';
import { useAI } from '@/store/AIProvider';
import { useApp } from '@/store/AppProvider';
import { PrescriptionExtraction } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

const FRAME_HEIGHT = 260;
const STAGES = ['Leyendo la imagen', 'Identificando el medicamento', 'Validando dosis y horarios'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Phase = 'idle' | 'processing' | 'result' | 'error';

interface SelectedImage {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

export default function ScanScreen() {
  const { actions } = useApp();
  const { settings } = useAI();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState(0);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [sampleMode, setSampleMode] = useState(false);
  const [result, setResult] = useState<PrescriptionExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    },
    [],
  );

  const runAnalysis = async (selected: SelectedImage | null, demo: boolean) => {
    setPhase('processing');
    setStage(0);
    setError(null);
    setResult(null);
    setImage(selected);
    setSampleMode(demo);

    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, 800);

    const started = Date.now();
    try {
      const extraction = await analyzePrescription(
        {
          base64: selected?.base64 ?? undefined,
          mimeType: selected?.mimeType,
          useSample: demo,
        },
        settings,
      );
      const minimumTime = 2200;
      const remaining = minimumTime - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      setResult(extraction);
      setPhase('result');
      successFeedback();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'No pudimos leer la receta. Intenta con una foto más clara.';
      setError(message);
      setPhase('error');
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      await pickFromLibrary();
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      actions.showToast('Activa el permiso de cámara para tomar la foto', 'error');
      return;
    }
    const response = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.65,
      base64: true,
    });
    if (!response.canceled && response.assets[0]) {
      const asset = response.assets[0];
      await runAnalysis(
        {
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType,
        },
        false,
      );
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      actions.showToast('Activa el permiso de fotos para elegir la receta', 'error');
      return;
    }
    const response = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.65,
      base64: true,
    });
    if (!response.canceled && response.assets[0]) {
      const asset = response.assets[0];
      await runAnalysis(
        {
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType,
        },
        false,
      );
    }
  };

  const reset = () => {
    setPhase('idle');
    setImage(null);
    setResult(null);
    setError(null);
    setSampleMode(false);
    setStage(0);
    setShowJson(false);
  };

  const continueToWizard = () => {
    if (!result) return;
    actions.setScanDraft(result);
    router.replace('/treatment/new');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar escáner"
          style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <AppText variant="h3" weight="bold">
            Escanear receta
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Foto o galería · lectura automática
          </AppText>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card tone="infoSoft" style={styles.demoNote}>
          <View style={styles.demoHeader}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.info} />
            <AppText variant="caption" color={colors.inkSoft} style={styles.demoText}>
              La imagen se envía a tu proveedor de IA ({settings.visionModel}) para
              extraer los datos. En producción, procesa la imagen desde tu backend.
            </AppText>
          </View>
        </Card>

        <ScanFrame
          image={image}
          scanning={phase === 'processing'}
          sample={sampleMode}
        />

        {phase === 'idle' ? (
          <View style={styles.actions}>
            <Button
              label="Tomar foto"
              icon="camera"
              fullWidth
              onPress={() => {
                void takePhoto();
              }}
            />
            <Button
              label="Elegir de galería"
              icon="images-outline"
              variant="outline"
              fullWidth
              onPress={() => {
                void pickFromLibrary();
              }}
            />
            <AppText variant="caption" color={colors.inkFaint} align="center" style={styles.hint}>
              Procura buena luz y que el texto se vea completo. Nunca compartas recetas
              de otras personas.
            </AppText>
          </View>
        ) : null}

        {phase === 'processing' ? (
          <Card style={styles.processingCard}>
            <View style={styles.processingHeader}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="bodyStrong">Analizando receta…</AppText>
            </View>
            <View style={styles.stages}>
              {STAGES.map((label, index) => {
                const done = index < stage;
                const current = index === stage;
                return (
                  <View key={label} style={styles.stageRow}>
                    <View
                      style={[
                        styles.stageDot,
                        done ? styles.stageDone : current ? styles.stageCurrent : null,
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={13} color={colors.white} />
                      ) : current ? (
                        <View style={styles.stagePulse} />
                      ) : null}
                    </View>
                    <AppText
                      variant="caption"
                      color={done || current ? colors.inkSoft : colors.inkFaint}
                      weight={current ? 'semibold' : 'regular'}
                    >
                      {label}
                    </AppText>
                  </View>
                );
              })}
            </View>
            <ProgressBar value={(stage + 1) / STAGES.length} height={6} />
          </Card>
        ) : null}

        {phase === 'error' ? (
          <Card tone="dangerSoft" style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger}>
              No pudimos leer la receta
            </AppText>
            <AppText variant="caption" color={colors.inkSoft}>
              {error ?? 'Intenta de nuevo con una foto más clara.'}
            </AppText>
            <View style={styles.errorActions}>
              <Button
                label="Intentar otra vez"
                size="md"
                variant="dangerSoft"
                icon="refresh"
                onPress={reset}
                style={styles.flex}
              />
              <Button
                label="Revisar ajustes de IA"
                size="md"
                variant="outline"
                onPress={() => router.push('/ai-settings')}
                style={styles.flex}
              />
            </View>
          </Card>
        ) : null}

        {phase === 'result' && result ? (
          <View style={styles.result}>
            <Card style={styles.resultCard}>
              <View style={styles.resultTop}>
                <View style={styles.resultTitle}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <AppText variant="h3" weight="bold">
                    Receta leída
                  </AppText>
                </View>
                <Badge
                  label={
                    result.source === 'ai'
                      ? `${Math.round(result.confidence * 100)}% confianza`
                      : 'Demostración'
                  }
                  tone={result.source === 'ai' ? 'success' : 'warning'}
                />
              </View>

              <View style={styles.medRow}>
                <View style={styles.medIcon}>
                  <Ionicons name="document-text" size={24} color={colors.white} />
                </View>
                <View style={styles.medText}>
                  <AppText variant="h2" weight="bold">
                    {result.medicationName}
                  </AppText>
                  <AppText variant="body" color={colors.inkSoft}>
                    {result.strength} · {doseAmountLabel(result.form, result.unitsPerDose)}
                  </AppText>
                  {result.patientName ? (
                    <AppText variant="caption" color={colors.inkMuted}>
                      Paciente: {result.patientName}
                    </AppText>
                  ) : null}
                </View>
              </View>

              <View style={styles.grid}>
                <ResultItem
                  icon="repeat"
                  label="Frecuencia"
                  value={`Cada ${result.frequencyHours} h`}
                />
                <ResultItem
                  icon="time-outline"
                  label="Primera toma"
                  value={formatTime(
                    combineDateTime(toDateKey(new Date()), result.startTime),
                  )}
                />
                <ResultItem
                  icon="calendar-outline"
                  label="Duración"
                  value={`${result.durationDays} días`}
                />
                <ResultItem
                  icon="layers-outline"
                  label="Inventario"
                  value={`${result.totalPills} ${stockNoun(
                    result.form,
                    result.totalPills,
                  )}`}
                />
                <ResultItem
                  icon="medkit-outline"
                  label="Forma"
                  value={formLabel(result.form)}
                />
              </View>

              {result.notes ? (
                <View style={styles.notes}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.inkMuted} />
                  <AppText variant="caption" color={colors.inkSoft} style={styles.notesText}>
                    {result.notes}
                  </AppText>
                </View>
              ) : null}
            </Card>

            {result.warnings.length > 0 ? (
              <Card tone="warningSoft" style={styles.warnings}>
                <View style={styles.warningTitle}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                  <AppText variant="bodyStrong" color={colors.warning}>
                    Revisa antes de guardar
                  </AppText>
                </View>
                {result.warnings.map((warning) => (
                  <AppText
                    key={warning}
                    variant="caption"
                    color={colors.inkSoft}
                    style={styles.warningText}
                  >
                    • {warning}
                  </AppText>
                ))}
              </Card>
            ) : null}

            <Pressable
              onPress={() => setShowJson((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Ver JSON estructurado"
              style={({ pressed }) => [styles.jsonToggle, pressed ? styles.pressed : null]}
            >
              <Ionicons name="code-slash" size={16} color={colors.inkMuted} />
              <AppText variant="caption" color={colors.inkMuted} weight="semibold">
                {showJson ? 'Ocultar JSON estructurado' : 'Ver JSON estructurado'}
              </AppText>
              <Ionicons
                name={showJson ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.inkMuted}
              />
            </Pressable>
            {showJson ? (
              <Card tone="dark" style={styles.jsonCard}>
                <AppText style={styles.jsonText} color="#D9F2E7">
                  {JSON.stringify(result, null, 2)}
                </AppText>
              </Card>
            ) : null}

            <Button
              label="Revisar y continuar"
              icon="arrow-forward"
              fullWidth
              onPress={continueToWizard}
            />
            <Button
              label="Escanear otra receta"
              icon="refresh"
              variant="outline"
              fullWidth
              onPress={reset}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanFrame({
  image,
  scanning,
  sample,
}: {
  image: SelectedImage | null;
  scanning: boolean;
  sample: boolean;
}) {
  const line = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(line, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(line, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [line, scanning]);

  return (
    <View style={styles.frame}>
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.framePlaceholder}>
          <View style={styles.documentIcon}>
            <Ionicons
              name={sample ? 'document-text' : 'camera-outline'}
              size={36}
              color={colors.primary}
            />
          </View>
          <AppText variant="bodyStrong" color={colors.white}>
            {sample ? 'Receta de ejemplo' : 'La receta aparecerá aquí'}
          </AppText>
          <AppText variant="caption" color="#B9D6CC" align="center">
            {sample
              ? 'Enalapril 10 mg · cada 12 horas'
              : 'Encuadra la receta completa y evita sombras.'}
          </AppText>
        </View>
      )}

      {scanning ? (
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [
                {
                  translateY: line.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, FRAME_HEIGHT - 12],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <View style={styles.frameLabel}>
        <Ionicons name="sparkles" size={13} color={colors.white} />
        <AppText variant="caption" color={colors.white} weight="semibold">
          {scanning ? 'Leyendo con IA' : 'Escáner MedSync'}
        </AppText>
      </View>
    </View>
  );
}

function ResultItem({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.resultItem}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <View style={styles.resultItemText}>
        <AppText variant="caption" color={colors.inkMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
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
  headerText: { flex: 1, gap: 1 },
  pressed: { opacity: 0.6 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  demoNote: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoText: { lineHeight: 18 },
  frame: {
    height: FRAME_HEIGHT,
    borderRadius: radius.xl,
    backgroundColor: '#0E2A24',
    overflow: 'hidden',
    marginTop: spacing.sm,
    ...shadows.card,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  framePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  documentIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#4BE3B8',
    shadowColor: '#4BE3B8',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#4BE3B8',
  },
  cornerTL: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  frameLabel: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6, 30, 25, 0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  hint: { lineHeight: 17, marginTop: spacing.xs },
  processingCard: { gap: spacing.md },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stages: { gap: spacing.sm },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDone: { backgroundColor: colors.success },
  stageCurrent: { backgroundColor: colors.primarySoft },
  stagePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  errorCard: { gap: spacing.sm },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flex: { flex: 1 },
  result: { gap: spacing.md, paddingBottom: spacing.xl },
  resultCard: { gap: spacing.lg },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  medIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medText: { flex: 1, gap: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    flexBasis: '46%',
    flexGrow: 1,
  },
  resultItemText: { flex: 1, gap: 0 },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  notesText: { flex: 1, lineHeight: 18 },
  warnings: { gap: 4 },
  warningTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  warningText: { lineHeight: 18, paddingLeft: 2 },
  jsonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  jsonCard: { padding: spacing.md, borderRadius: radius.md },
  jsonText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11.5,
    lineHeight: 17,
  },
});
