import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';

import { colors } from '@/constants/theme';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'primary' | 'soft' | 'dark';
  style?: StyleProp<ViewStyle>;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({ name, size = 48, tone = 'soft', style }: AvatarProps) {
  const backgroundColor =
    tone === 'primary' ? colors.primary : tone === 'dark' ? colors.ink : colors.primarySoft;
  const color = tone === 'soft' ? colors.primaryStrong : colors.white;

  return (
    <View
      accessible
      accessibilityLabel={`Perfil de ${name}`}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      <AppText
        weight="bold"
        color={color}
        style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
