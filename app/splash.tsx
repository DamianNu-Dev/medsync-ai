import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { BrandMark } from '@/components/ui/BrandMark';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://medsync-ai-backend.onrender.com';

export default function SplashScreen() {
  const [status, setStatus] = useState<'checking' | 'awake' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const checkServer = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${BACKEND_URL}/api/health`, {
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          setStatus('awake');
          return;
        }
      } catch {
        // Servidor probablemente dormido
      }

      if (attempts >= 3) {
        setStatus('error');
        setError('El servidor tarda en despertar. Intenta de nuevo.');
        return;
      }

      setStatus('checking');
      timer = setTimeout(checkServer, 5000);
    };

    checkServer();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const goToAuth = () => {
    router.replace('/auth');
  };

  const retry = () => {
    setStatus('checking');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <BrandMark size={80} showWordmark={true} />
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>

        {status === 'checking' && (
          <AppText variant="body" color={colors.inkSoft} style={styles.text}>
            Despertando servidor…
          </AppText>
        )}

        {status === 'error' && error && (
          <View style={styles.errorContainer}>
            <AppText variant="body" color={colors.danger} style={styles.text}>
              {error}
            </AppText>
            <Button
              label="Intentar de nuevo"
              icon="refresh-outline"
              variant="outline"
              size="md"
              onPress={() => void retry()}
            />
          </View>
        )}

        {status === 'awake' && (
          <AppText variant="body" color={colors.success} style={styles.text}>
            Servidor listo. Conectando…
          </AppText>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  spinner: { marginVertical: 24 },
  text: { marginTop: 16, textAlign: 'center', lineHeight: 20 },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
});
