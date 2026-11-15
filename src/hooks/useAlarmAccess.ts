import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  AlarmAccessStatus,
  EMPTY_ALARM_STATUS,
  NativeAlarm,
} from '@/lib/nativeAlarm';

/**
 * Estado de los accesos especiales de Android que permiten que la alarma se
 * muestre encima de otras apps y suene a la hora exacta. Se refresca al volver
 * de los ajustes del sistema.
 */
export function useAlarmAccess() {
  const [status, setStatus] = useState<AlarmAccessStatus>(EMPTY_ALARM_STATUS);
  const [loading, setLoading] = useState(Platform.OS === 'android');

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setLoading(false);
      return EMPTY_ALARM_STATUS;
    }
    const next = await NativeAlarm.getStatus();
    setStatus(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const timer = setTimeout(() => void refresh(), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refresh]);

  return { status, loading, refresh };
}
