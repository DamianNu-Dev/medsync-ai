import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { AISettings, defaultAISettings } from '@/lib/aiSettings';
import { testAIConnection } from '@/lib/ai';
import { useAI } from '@/store/AIProvider';
import { useApp } from '@/store/AppProvider';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';

interface Preset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  visionModel: string;
}

const PRESETS: Preset[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'qwen/qwen3.8-27b',
    visionModel: 'qwen/qwen-vl',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    visionModel: 'openai/gpt-4o-mini',
  },
];

type TestState =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value);
}

export default function AISettingsScreen() {
  const { settings, ready, configured, update, reset } = useAI();
  const { actions } = useApp();
  const [fields, setFields] = useState<AISettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!ready || hydrated.current) return;
    hydrated.current = true;
    setFields(settings);
  }, [ready, settings]);

  const currentBase = normalizeUrl(fields.baseUrl);
  const activePreset = PRESETS.find((preset) => preset.baseUrl === currentBase);

  const change = (patch: Partial<AISettings>) => {
    setFields((current) => ({ ...current, ...patch }));
    setTest({ kind: 'idle' });
    setError(null);
  };

  const applyPreset = (preset: Preset) => {
    setFields((current) => ({
      ...current,
      baseUrl: preset.baseUrl,
      model: preset.model,
      visionModel: preset.visionModel,
    }));
    setTest({ kind: 'idle' });
    setError(null);
  };

  const validate = (): string | null => {
    if (!isHttpUrl(normalizeUrl(fields.baseUrl))) {
      return 'La URL debe empezar con https:// (o http:// en desarrollo).';
    }
    if (fields.model.trim().length === 0) {
      return 'Escribe el modelo de texto que usarás para el chat.';
    }
    if (fields.visionModel.trim().length === 0) {
      return 'Escribe el modelo de visión para leer recetas y verificar la pastilla.';
    }
    return null;
  };

  const runTest = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    if (fields.apiKey.trim().length === 0) {
      setError('Escribe una clave de API para probar la conexión.');
      return;
    }
    setError(null);
    setTest({ kind: 'idle' });
    setTesting(true);
    try {
      const reply = await testAIConnection({
        ...fields,
        baseUrl: normalizeUrl(fields.baseUrl),
      });
      setTest({
        kind: 'ok',
        message: reply.length > 120 ? `${reply.slice(0, 120)}…` : reply,
      });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.name === 'AbortError'
          ? 'La prueba tardó demasiado. Revisa tu conexión o la URL.'
          : caught instanceof Error
            ? caught.message
            : 'No se pudo probar la conexión.';
      setTest({ kind: 'error', message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await update({
        baseUrl: normalizeUrl(fields.baseUrl),
        apiKey: fields.apiKey.trim(),
        model: fields.model.trim(),
        visionModel: fields.visionModel.trim(),
      });
      actions.showToast(
        fields.apiKey.trim().length > 0
          ? 'IA configurada en este dispositivo'
          : 'Configuración guardada sin clave de IA',
        fields.apiKey.trim().length > 0 ? 'success' : 'info',
      );
      router.back();
    } catch {
      setError('No pudimos guardar la configuración en este dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    await reset();
    const defaults = defaultAISettings();
    setFields(defaults);
    setConfirmReset(false);
    setTest({ kind: 'idle' });
    setShowKey(false);
    actions.showToast('Configuración de IA restablecida', 'info');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar configuración de IA"
            style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerText}>
            <AppText variant="h3" weight="bold">
              Inteligencia artificial
            </AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              Lectura de recetas y verificación visual
            </AppText>
          </View>
          <Badge
            label="Activa"
            tone="success"
          />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card tone="infoSoft" style={styles.intro}>
            <View style={styles.introHeader}>
              <Ionicons name="sparkles" size={20} color={colors.ai} />
              <AppText variant="bodyStrong" color={colors.ai}>
                IA activa
              </AppText>
            </View>
            <AppText variant="caption" color={colors.inkSoft} style={styles.introText}>
              MedSync usa inteligencia artificial para leer recetas, responder dudas sobre
              tus tomas y verificar que la pastilla esté en tu boca. Todo ya está
              configurado y listo para usar.
            </AppText>
          </Card>

          <View style={styles.section}>
            <AppText variant="label" color={colors.inkSoft}>
              Proveedor
            </AppText>
            <View style={styles.presets}>
              {PRESETS.map((preset) => {
                const selected = activePreset?.id === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => applyPreset(preset)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Proveedor ${preset.label}`}
                    style={({ pressed }) => [
                      styles.preset,
                      selected ? styles.presetSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <AppText
                      variant="caption"
                      weight="bold"
                      color={selected ? colors.primaryStrong : colors.inkSoft}
                    >
                      {preset.label}
                    </AppText>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
              <View
                style={[
                  styles.preset,
                  !activePreset ? styles.presetSelected : null,
                  styles.presetStatic,
                ]}
              >
                <AppText
                  variant="caption"
                  weight="bold"
                  color={!activePreset ? colors.primaryStrong : colors.inkMuted}
                >
                  {activePreset ? 'Personalizado' : 'Otro'}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color={colors.inkMuted}>
              Al elegir un proveedor se completan la URL y los modelos sugeridos. Puedes
              editarlos.
            </AppText>
          </View>

          <TextField
            label="URL del proveedor"
            value={fields.baseUrl}
            onChangeText={(value) => change({ baseUrl: value })}
            placeholder="https://api.groq.com/openai/v1"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Debe terminar en /v1 o en la ruta de tu API compatible."
          />

          <TextField
            label="Clave de API"
            value={fields.apiKey}
            onChangeText={(value) => change({ apiKey: value })}
            placeholder="gsk_..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showKey}
            hint="Se guarda solo en este dispositivo. Nunca la compartas."
            right={
              <Pressable
                onPress={() => setShowKey((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                hitSlop={12}
              >
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                  color={colors.inkMuted}
                />
              </Pressable>
            }
          />

          <TextField
            label="Modelo de texto (chat)"
            value={fields.model}
            onChangeText={(value) => change({ model: value })}
            placeholder="llama-3.3-70b-versatile"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Se usa para las respuestas de Medi."
          />

          <TextField
            label="Modelo de visión (recetas y pastilla)"
            value={fields.visionModel}
            onChangeText={(value) => change({ visionModel: value })}
            placeholder="meta-llama/llama-4-scout-17b-16e-instruct"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Debe aceptar imágenes en el endpoint /chat/completions."
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <AppText variant="caption" color={colors.danger} style={styles.errorText}>
                {error}
              </AppText>
            </View>
          ) : null}

          {test.kind !== 'idle' ? (
            <Card
              tone={test.kind === 'ok' ? 'successSoft' : 'dangerSoft'}
              style={styles.testCard}
            >
              <View style={styles.testHeader}>
                <Ionicons
                  name={test.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={test.kind === 'ok' ? colors.success : colors.danger}
                />
                <AppText
                  variant="bodyStrong"
                  color={test.kind === 'ok' ? colors.success : colors.danger}
                >
                  {test.kind === 'ok' ? 'Conexión exitosa' : 'La prueba falló'}
                </AppText>
              </View>
              <AppText variant="caption" color={colors.inkSoft} style={styles.testText}>
                {test.message}
              </AppText>
            </Card>
          ) : null}

          <View style={styles.actions}>
            <Button
              label="Probar conexión"
              icon="pulse-outline"
              variant="outline"
              fullWidth
              loading={testing}
              onPress={() => void runTest()}
            />
            <Button
              label="Guardar configuración"
              icon="checkmark"
              fullWidth
              loading={saving}
              onPress={() => void save()}
            />
          </View>

          {confirmReset ? (
            <Card tone="dangerSoft" style={styles.resetCard}>
              <AppText variant="bodyStrong" color={colors.danger}>
                ¿Borrar la configuración guardada?
              </AppText>
              <AppText variant="caption" color={colors.inkSoft}>
                Se eliminarán la URL, la clave y los modelos de este dispositivo. La app
                volverá al modo sin IA.
              </AppText>
              <View style={styles.resetActions}>
                <Button
                  label="Cancelar"
                  variant="outline"
                  size="md"
                  onPress={() => setConfirmReset(false)}
                  style={styles.flex}
                />
                <Button
                  label="Sí, restablecer"
                  variant="dangerSoft"
                  size="md"
                  onPress={() => void doReset()}
                  style={styles.flex}
                />
              </View>
            </Card>
          ) : (
            <Button
              label="Restablecer configuración"
              icon="refresh-outline"
              variant="ghost"
              size="md"
              fullWidth
              onPress={() => setConfirmReset(true)}
            />
          )}

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
            <AppText variant="caption" color={colors.inkSoft} style={styles.noteText}>
              La inteligencia artificial de MedSync está activa. Puede leer recetas,
              responder dudas sobre tus tomas y verificar que la pastilla esté en tu boca.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
  pressed: { opacity: 0.65 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  intro: { gap: spacing.sm },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  introText: { lineHeight: 19 },
  section: { gap: spacing.sm },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  presetStatic: { opacity: 0.85 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, lineHeight: 18 },
  testCard: { gap: spacing.xs },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testText: { lineHeight: 19 },
  actions: { gap: spacing.sm },
  resetCard: { gap: spacing.sm },
  resetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: spacing.xs,
  },
  noteText: { flex: 1, lineHeight: 18 },
});
