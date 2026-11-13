import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from '@/components/ui/AppText';

interface SuggestionChipsProps {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onPick, disabled }: SuggestionChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onPick(suggestion)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={suggestion}
          style={({ pressed }) => [
            styles.chip,
            disabled ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ai} />
          <AppText variant="caption" color={colors.ai} weight="semibold">
            {suggestion}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.aiSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
