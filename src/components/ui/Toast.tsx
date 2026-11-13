import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/constants/medication';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useApp } from '@/store/AppProvider';
import { AppText } from './AppText';

const toneMap = {
  success: { bg: colors.success, icon: 'checkmark-circle' as IconName },
  error: { bg: colors.danger, icon: 'alert-circle' as IconName },
  info: { bg: colors.ink, icon: 'information-circle' as IconName },
};

export function ToastHost() {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const toast = state.toast;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!toast) return;

    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => actions.hideToast(toast.id));
    }, 2800);

    return () => clearTimeout(timer);
  }, [toast?.id, actions, opacity, translateY]);

  if (!toast) return null;

  const tone = toneMap[toast.tone === 'error' ? 'error' : toast.tone];

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          bottom: insets.bottom + 98,
          opacity,
          transform: [{ translateY }],
          backgroundColor: tone.bg,
        },
      ]}
    >
      <Ionicons name={tone.icon} size={20} color={colors.white} />
      <AppText
        color={colors.white}
        style={styles.text}
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}
      >
        {toast.message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 90,
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.floating,
  },
  text: {
    flex: 1,
    fontFamily: typography.bodyStrong.fontFamily,
    fontSize: 15,
    lineHeight: 20,
  },
});
