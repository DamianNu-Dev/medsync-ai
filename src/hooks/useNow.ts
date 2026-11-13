import { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

/**
 * Reloj compartido para recalcular estados de dosis ("atrasada", "en 20 min")
 * sin recargar la app. Se actualiza también al volver del segundo plano.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    const subscription = RNAppState.addEventListener('change', (status) => {
      if (status === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
