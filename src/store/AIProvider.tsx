import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AISettings,
  clearAISettings,
  defaultAISettings,
  loadAISettings,
  persistAISettings,
} from '@/lib/aiSettings';

interface AIContextValue {
  settings: AISettings;
  ready: boolean;
  configured: boolean;
  update: (settings: AISettings) => Promise<void>;
  reset: () => Promise<void>;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(() => defaultAISettings());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadAISettings()
      .then((stored) => {
        if (alive && stored) setSettings(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(async (next: AISettings) => {
    setSettings(next);
    await persistAISettings(next);
  }, []);

  const reset = useCallback(async () => {
    const defaults = defaultAISettings();
    setSettings(defaults);
    await clearAISettings();
  }, []);

  const value = useMemo<AIContextValue>(
    () => ({
      settings,
      ready,
      configured: settings.apiKey.trim().length > 0,
      update,
      reset,
    }),
    [settings, ready, update, reset],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI debe usarse dentro de <AIProvider>');
  return context;
}
