import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
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
