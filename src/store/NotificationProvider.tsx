import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  getNotificationPermissionState,
  NotificationPermissionState,
  openNotificationSettings,
  requestExactAlarmPermission,
  requestNotificationPermission,
} from '@/lib/notifications';

interface NotificationContextValue {
  permission: NotificationPermissionState;
  loading: boolean;
  refresh: () => Promise<NotificationPermissionState>;
  request: () => Promise<NotificationPermissionState>;
  requestExact: () => Promise<boolean>;
  openSettings: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const INITIAL: NotificationPermissionState = {
  status: 'undetermined',
  canAskAgain: true,
  exactAlarm: false,
  exactAlarmCanAsk: false,
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermissionState>(INITIAL);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getNotificationPermissionState();
    setPermission(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refresh]);

  const request = useCallback(async () => {
    setLoading(true);
    try {
      const next = await requestNotificationPermission();
      setPermission(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  // Al abrir la app instalada se pide el permiso de inmediato, sin tener que
  // buscarlo en los ajustes del teléfono.
  const askedOnLaunch = useRef(false);
  useEffect(() => {
    const shouldAsk =
      !loading &&
      !askedOnLaunch.current &&
      permission.status === 'undetermined' &&
      permission.canAskAgain;
    if (!shouldAsk) return;
    askedOnLaunch.current = true;
    const timer = setTimeout(() => void request(), 0);
    return () => clearTimeout(timer);
  }, [loading, permission.canAskAgain, permission.status, request]);

  const requestExact = useCallback(async () => {
    const granted = await requestExactAlarmPermission();
    const next = await getNotificationPermissionState();
    setPermission(next);
    return granted;
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      permission,
      loading,
      refresh,
      request,
      requestExact,
      openSettings: openNotificationSettings,
    }),
    [permission, loading, refresh, request, requestExact],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de <NotificationProvider>');
  }
  return context;
}
