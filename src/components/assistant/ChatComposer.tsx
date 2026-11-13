import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { tapFeedback } from '@/lib/haptics';
import { AppText } from '@/components/ui/AppText';

interface ChatComposerProps {
  onSend: (text: string) => void;
  onScan: () => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, onScan, disabled }: ChatComposerProps) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !disabled;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    tapFeedback();
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Escanear una receta"
        style={({ pressed }) => [styles.circle, pressed ? styles.pressed : null]}
      >
        <Ionicons name="scan-outline" size={22} color={colors.ai} />
      </Pressable>

      <View style={styles.inputWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe tu duda…"
          placeholderTextColor={colors.inkFaint}
          multiline
          maxLength={500}
          selectionColor={colors.primary}
          accessibilityLabel="Mensaje para Medi"
          style={styles.input}
        />
      </View>

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        accessibilityState={{ disabled: !canSend }}
        style={({ pressed }) => [
          styles.circle,
          styles.send,
          !canSend ? styles.sendDisabled : null,
          pressed && canSend ? styles.pressed : null,
        ]}
      >
        <Ionicons name="arrow-up" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  circle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    backgroundColor: colors.ai,
    borderColor: colors.ai,
  },
  sendDisabled: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.surfaceSunken,
  },
  pressed: { opacity: 0.7 },
  inputWrap: {
    flex: 1,
    minHeight: 50,
    maxHeight: 116,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    padding: 0,
    maxHeight: 92,
  },
});
