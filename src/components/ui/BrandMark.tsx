import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { AppText } from './AppText';

interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
  light?: boolean;
}

export function BrandMark({ size = 56, showWordmark = true, light = false }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={['#0E8A70', '#075243']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.mark,
          { width: size, height: size, borderRadius: size * 0.3 },
        ]}
      >
        <Ionicons name="pulse" size={size * 0.5} color={colors.white} />
      </LinearGradient>
      {showWordmark ? (
        <View>
          <AppText
            variant="title"
            weight="extrabold"
            color={light ? colors.white : colors.ink}
            style={styles.wordmark}
          >
            MedSync <AppText variant="title" weight="extrabold" color={colors.primary}>AI</AppText>
          </AppText>
          <AppText variant="caption" color={light ? colors.primaryMuted : colors.inkMuted}>
            Tu salud, en orden
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  wordmark: {
    letterSpacing: -0.4,
  },
});
