import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { BrandMark } from '@/components/ui/BrandMark';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://medsync-ai-3.onrender.com';

export function SplashScreen() {
  const [status, setStatus] = useState<'checking' | 'awake' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts] = useState(12);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const checkServer = async () => {
      setAttempt((prev) => prev + 1);

      try {
        const response = await fetch(`${BACKEND_URL}/api/health`, {
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          setStatus('awake');
          timer = setTimeout(() => {
            router.replace('/auth');
          }, 1000);
          return;
        }
      } catch {
        // Servidor probablemente dormido (plan gratuito de Render)
      }

      if (attempt >= maxAttempts) {
        setStatus('error');
        setError('El servidor no responde. Intenta de nuevo o usa modo local.');
        return;
      }

      timer = setTimeout(checkServer, 5000);
    };

    checkServer();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [attempt, maxAttempts]);

  const retry = () => {
    setStatus('checking');
    setAttempt(0);
    setError(null);
  };

  const goLocal = () => {
    router.replace('/auth?local=true');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <BrandMark size={80} showWordmark={true} />
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>

        {status === 'checking' && (
          <>
            <AppText variant="body" color={colors.inkSoft} style={styles.text}>
              Despertando servidor…
            </AppText>
            <AppText variant="caption" color={colors.inkMuted} style={styles.subtext}>
              Intento {attempt} de {maxAttempts} · puede tardar hasta 60 segundos
            </AppText>
          </>
        )}

        {status === 'awake' && (
          <AppText variant="body" color={colors.success} style={styles.text}>
            Servidor listo. Conectando…
          </AppText>
        )}

        {status === 'error' && error && (
          <View style={styles.errorContainer}>
            <AppText variant="body" color={colors.danger} style={styles.text}>
              {error}
            </AppText>
            <View style={styles.buttonRow}>
              <Button
                label="Intentar de nuevo"
                icon="refresh-outline"
                variant="outline"
                size="md"
                onPress={() => void retry()}
              />
              <Button
                label="Modo local (sin servidor)"
                icon="cloud-outline"
                variant="ghost"
                size="md"
                onPress={() => void goLocal()}
              />
            </View>
          </View>
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
  subtext: { marginTop: 8, textAlign: 'center', lineHeight: 18 },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
});
