import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/constants/theme';
import { formatDateLong, greeting } from '@/lib/date';
import { Profile } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';

interface GreetingHeaderProps {
  profile: Profile;
  now: Date;
  onSettings: () => void;
  onScan?: () => void;
}

export function GreetingHeader({ profile, now, onSettings, onScan }: GreetingHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Avatar name={profile.name} size={52} />
        <View style={styles.texts}>
          <AppText variant="caption" color={colors.inkMuted} weight="semibold">
            {greeting(now)}
          </AppText>
          <AppText variant="h2" weight="extrabold" numberOfLines={1}>
            {profile.firstName}
          </AppText>
        </View>
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Perfil y ajustes"
          style={({ pressed }) => [styles.settings, pressed ? styles.pressed : null]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.inkSoft} />
        </Pressable>
        {onScan ? (
          <Pressable
            onPress={onScan}
            accessibilityRole="button"
            accessibilityLabel="Escanear receta"
            style={({ pressed }) => [styles.settings, pressed ? styles.pressed : null]}
          >
            <Ionicons name="scan-outline" size={22} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.dateRow}>
        <Ionicons name="calendar-clear-outline" size={15} color={colors.inkMuted} />
        <AppText variant="caption" color={colors.inkMuted}>
          {formatDateLong(now)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, marginBottom: spacing.xl },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  texts: { flex: 1 },
  settings: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  pressed: { opacity: 0.65 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
});
