import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/constants/medication';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { tapFeedback } from '@/lib/haptics';
import { useApp } from '@/store/AppProvider';
import { getCaregiverData } from '@/store/selectors';
import { AppText } from '@/components/ui/AppText';

const TABS: Record<string, { label: string; icon: IconName; iconOutline: IconName }> = {
  index: { label: 'Inicio', icon: 'home', iconOutline: 'home-outline' },
  treatments: { label: 'Tratamientos', icon: 'medkit', iconOutline: 'medkit-outline' },
  caregiver: { label: 'Cuidador', icon: 'people', iconOutline: 'people-outline' },
  assistant: { label: 'Medi AI', icon: 'sparkles', iconOutline: 'sparkles-outline' },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { state: appState } = useApp();
  const now = useNow(60_000);
  const caregiver = getCaregiverData(appState, now);

  const visible = state.routes.filter((route) => {
    if (appState.role === 'caregiver') {
      return route.name === 'caregiver' || route.name === 'treatments' || route.name === 'assistant';
    }
    return true;
  });
  const activeKey = state.routes[state.index]?.key;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={styles.bar}>
        {visible.map((route) => {
          const item = TABS[route.name];
          if (!item) return null;
          const focused = activeKey === route.key;
          const label =
            route.name === 'caregiver' && appState.role === 'caregiver'
              ? 'Panel'
              : item.label;

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              tapFeedback();
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.item,
                focused ? styles.itemActive : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View>
                <Ionicons
                  name={focused ? item.icon : item.iconOutline}
                  size={23}
                  color={focused ? colors.primaryStrong : colors.inkMuted}
                />
                {appState.role === 'patient' && route.name === 'caregiver' && caregiver.severity === 'danger' ? (
                  <View style={styles.dot} />
                ) : null}
              </View>
              <AppText
                style={styles.label}
                color={focused ? colors.primaryStrong : colors.inkMuted}
                weight={focused ? 'bold' : 'semibold'}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    ...shadows.floating,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.lg,
    minHeight: 54,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.7 },
  label: {
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
