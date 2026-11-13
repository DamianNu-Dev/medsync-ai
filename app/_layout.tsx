import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { AIProvider } from '@/store/AIProvider';
import { AppProvider } from '@/store/AppProvider';
import { AppText } from '@/components/ui/AppText';
import { AuthProvider, useAuth } from '@/store/AuthProvider';
import { NotificationProvider } from '@/store/NotificationProvider';
import { DoseAlarm } from '@/components/alarm/DoseAlarm';
import { NotificationSync } from '@/components/notifications/NotificationSync';
import { BrandMark } from '@/components/ui/BrandMark';
import { SplashScreen } from '@/components/splash';
import { ToastHost } from '@/components/ui/Toast';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <NotificationProvider>
            <AIProvider>
              <StatusBar style="dark" />
              <RootNavigator />
              <DoseAlarm />
              <NotificationSync />
              <ToastHost />
            </AIProvider>
          </NotificationProvider>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { ready, mode } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const authenticated = mode === 'account' || mode === 'local';

  if (!ready) return <LoadingScreen />;

  // Si ya pasó el splash, mostrar navegación normal
  if (splashDone) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={authenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="treatment/new"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="treatment/[id]" />
          <Stack.Screen
            name="ai-settings"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack.Protected>

        <Stack.Protected guard={!authenticated}>
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    );
  }

  // Mientras no termine el splash, mostrar pantalla de carga
  return (
    <SplashScreen onComplete={() => setSplashDone(true)} />
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <BrandMark size={76} showWordmark={false} />
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
});
