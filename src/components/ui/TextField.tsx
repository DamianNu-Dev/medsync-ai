import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function TextField({
  label,
  hint,
  error,
  right,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  multiline,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.borderStrong;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="label" color={colors.inkSoft} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor },
          focused ? styles.fieldFocused : null,
          multiline ? styles.fieldMultiline : null,
        ]}
      >
        <TextInput
          {...rest}
          multiline={multiline}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.primary}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            right ? styles.inputWithRight : null,
            inputStyle,
          ]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <AppText variant="caption" color={colors.danger} weight="semibold">
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color={colors.inkMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  label: { marginLeft: 2 },
  field: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fieldFocused: {
    backgroundColor: colors.surface,
  },
  fieldMultiline: {
    minHeight: 108,
    paddingVertical: spacing.md,
    justifyContent: 'flex-start',
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    padding: 0,
  },
  inputMultiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  inputWithRight: {
    paddingRight: 44,
  },
  right: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 2,
  },
});
