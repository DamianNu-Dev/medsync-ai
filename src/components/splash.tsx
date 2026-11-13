import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { BrandMark } from '@/components/ui/BrandMark';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://medsync-ai-3.onrender.com';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<'checking' | 'awake' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const maxAttempts = 20;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const timeoutPromise = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const fetchWithTimeout = async (url: string, ms: number) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  };

  const checkServer = async () => {
    attemptRef.current += 1;

    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/health`, 15000);
      if (response.ok) {
        setStatus('awake');
        timerRef.current = setTimeout(() => {
          onComplete();
        }, 1500);
        return;
      }
    } catch {
      // Servidor probablemente dormido (plan gratuito de Render)
    }

    if (attemptRef.current >= maxAttempts) {
      setStatus('error');
      setError('El servidor no responde. Intenta de nuevo o usa modo local.');
      setShowRetry(true);
      return;
    }

    timerRef.current = setTimeout(checkServer, 5000);
  };

  useEffect(() => {
    void checkServer();
  }, []);

  const retry = () => {
    attemptRef.current = 0;
    setStatus('checking');
    setError(null);
    setShowRetry(false);
    void checkServer();
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
              Intento {attemptRef.current} de {maxAttempts} ·
              puede tardar hasta 2 minutos
            </AppText>
          </>
        )}

        {status === 'awake' && (
          <AppText variant="body" color={colors.success} style={styles.text}>
            Servidor listo. Conectando…
          </AppText>
        )}

        {status === 'error' && error && showRetry && (
          <View style={styles.errorContainer}>
            <AppText variant="body" color={colors.danger} style={styles.text}>
              {error}
            </AppText>
            <View style={styles.buttonRow}>
              <Button
                label="Forzar reconexión"
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
