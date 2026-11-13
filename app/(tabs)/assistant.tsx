import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DISCLAIMER } from '@/constants/config';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { formatTime } from '@/lib/date';
import {
  AssistantContext,
  sendChatMessage,
} from '@/lib/ai';
import { getDoseLabel } from '@/lib/schedule';
import { useNow } from '@/hooks/useNow';
import { useAI } from '@/store/AIProvider';
import { useApp } from '@/store/AppProvider';
import { getDashboardData } from '@/store/selectors';
import { ChatMessage } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PulseDot } from '@/components/ui/PulseDot';
import { Sheet } from '@/components/ui/Sheet';
import { ChatBubble } from '@/components/assistant/ChatBubble';
import { ChatComposer } from '@/components/assistant/ChatComposer';
import { SuggestionChips } from '@/components/assistant/SuggestionChips';
import { TypingIndicator } from '@/components/assistant/TypingIndicator';

const SUGGESTIONS = [
  '¿Qué hago si olvidé una dosis?',
  '¿Cuántas pastillas me quedan?',
  '¿Puedo tomarlo con comida?',
];

export default function AssistantScreen() {
  const { state, actions } = useApp();
  const { settings } = useAI();
  const now = useNow(60_000);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [typing, setTyping] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const dashboard = useMemo(() => getDashboardData(state, now), [state, now]);

  const context = useMemo<AssistantContext>(
    () => ({
      profileName: state.profile.firstName,
      treatments: state.treatments
        .filter((treatment) => treatment.active)
        .map((treatment) => ({
          name: treatment.name,
          strength: treatment.strength,
          frequencyHours: treatment.frequencyHours,
          pillsRemaining: treatment.pillsRemaining,
          unitsPerDose: treatment.unitsPerDose,
          form: treatment.form,
        })),
      todayDoses: dashboard.today.map((item) => ({
        treatmentName: item.treatment.name,
        time: formatTime(item.dose.scheduledAt),
        status: getDoseLabel(item.status),
      })),
      adherence: dashboard.summary.adherence,
      nextDose: dashboard.nextDose
        ? `${dashboard.nextDose.treatment.name} a las ${formatTime(
            dashboard.nextDose.dose.scheduledAt,
          )}`
        : undefined,
    }),
    [state.treatments, state.profile.firstName, dashboard],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;

    const userMessage: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    actions.addMessage('user', text);
    setTyping(true);

    try {
      const reply = await sendChatMessage([...state.messages, userMessage], context, settings);
      actions.addMessage('assistant', reply, 'ai');
    } catch {
      actions.showToast('No se pudo conectar con la IA', 'error');
      actions.addMessage(
        'assistant',
        `No pude conectar con la nube, intenta de nuevo en un momento.`,
        'ai',
      );
    } finally {
      setTyping(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={['#2B7ED0', '#1D5FA8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mediAvatar}
          >
            <Ionicons name="sparkles" size={22} color={colors.white} />
          </LinearGradient>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <AppText variant="h3" weight="bold">
                Medi
              </AppText>
              <Badge
                label="IA activa"
                tone="ai"
                size="sm"
              />
            </View>
            <Pressable
              onPress={() => router.push('/ai-settings')}
              accessibilityRole="button"
              accessibilityLabel="Ajustes de inteligencia artificial"
              style={styles.statusRow}
            >
              <PulseDot
                color={colors.success}
                size={7}
              />
              <AppText variant="caption" color={colors.inkMuted}>
                Asistente de salud en línea
              </AppText>
              <Ionicons name="chevron-forward" size={13} color={colors.inkMuted} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/scan')}
            accessibilityRole="button"
            accessibilityLabel="Escanear receta"
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name="scan-outline" size={21} color={colors.ai} />
          </Pressable>
          <Pressable
            onPress={() => setClearOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Borrar conversación"
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.info} />
          <AppText variant="caption" color={colors.inkSoft} style={styles.noticeText}>
            {DISCLAIMER}
          </AppText>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {state.messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {typing ? <TypingIndicator /> : null}

          {!typing ? (
            <View style={styles.suggestions}>
              <SuggestionChips
                suggestions={SUGGESTIONS}
                onPick={(suggestion) => {
                  void sendMessage(suggestion);
                }}
              />
            </View>
          ) : null}

          {state.messages.length <= 4 ? (
            <Card
              tone="primarySoft"
              onPress={() => router.push('/scan')}
              style={styles.scanCard}
              accessibilityLabel="Escanear una receta médica"
            >
              <View style={styles.scanRow}>
                <View style={styles.scanIcon}>
                  <Ionicons name="camera" size={21} color={colors.white} />
                </View>
                <View style={styles.scanText}>
                  <AppText variant="bodyStrong" color={colors.primaryStrong}>
                    Escanea tu receta
                  </AppText>
                  <AppText variant="caption" color={colors.inkSoft}>
                    Autocompleta el tratamiento en segundos.
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primaryStrong} />
              </View>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.composer,
            { paddingBottom: keyboardVisible ? spacing.md : insets.bottom + 94 },
          ]}
        >
          <ChatComposer
            onSend={(text) => {
              void sendMessage(text);
            }}
            onScan={() => router.push('/scan')}
            disabled={typing}
          />
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Empezar de nuevo"
        description="Se borrará la conversación de este dispositivo. Tus tratamientos no se modifican."
      >
        <Button
          label="Borrar conversación"
          variant="danger"
          icon="trash-outline"
          onPress={() => {
            actions.clearChat();
            setClearOpen(false);
          }}
        />
        <Button
          label="Cancelar"
          variant="ghost"
          size="md"
          style={styles.cancel}
          onPress={() => setClearOpen(false)}
        />
      </Sheet>
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
  mediAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  headerText: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    marginBottom: spacing.sm,
  },
  noticeText: { flex: 1, lineHeight: 16 },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    backgroundColor: colors.aiSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  connectText: { flex: 1, lineHeight: 16 },
  messages: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  suggestions: { marginTop: spacing.xs },
  scanCard: { marginTop: spacing.sm, padding: spacing.md },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scanIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: { flex: 1, gap: 1 },
  composer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  cancel: { alignSelf: 'center', marginTop: spacing.sm },
});
