import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  ensureExactAlarmPermissionOnce,
  syncDoseNotifications,
} from '@/lib/notifications';
import { useApp } from '@/store/AppProvider';
import { useAuth } from '@/store/AuthProvider';
import { useNotifications } from '@/store/NotificationProvider';
import { Dose, Treatment } from '@/types';

/**
 * Mantiene las notificaciones locales alineadas con las tomas pendientes.
 *
 * - Pide el permiso de notificaciones una sola vez al entrar como paciente.
 * - Pide una vez el permiso de alarmas exactas en la app instalada (Android 12+).
 * - Vuelve a programar las alarmas al abrir la app o volver del segundo plano.
 */
export function NotificationSync() {
  const { state } = useApp();
  const { mode } = useAuth();
  const { permission, request, refresh } = useNotifications();
  const askedPermissionRef = useRef(false);

  const isAuthenticated = mode === 'account' || mode === 'local';
  const isPatient =
    isAuthenticated &&
    state.roleChosen &&
    state.role === 'patient' &&
    state.alarmEnabled;

  // Permiso de notificaciones: una sola vez, después de entrar como paciente.
  useEffect(() => {
    if (!isPatient) return;
    if (permission.status !== 'undetermined' || !permission.canAskAgain) return;
    if (askedPermissionRef.current) return;

    askedPermissionRef.current = true;
    const timer = setTimeout(() => {
      void request();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isPatient, permission.canAskAgain, permission.status, request]);

  // Alarmas exactas: solo una vez, para que el aviso llegue a la hora.
  useEffect(() => {
    if (!isPatient || permission.status !== 'granted') return;
    if (permission.exactAlarm || !permission.exactAlarmCanAsk) return;
    void ensureExactAlarmPermissionOnce().then(() => refresh());
  }, [
    isPatient,
    permission.exactAlarm,
    permission.exactAlarmCanAsk,
    permission.status,
    refresh,
  ]);

  // Programa y refresca las notificaciones.
  useEffect(() => {
    if (!isPatient || permission.status !== 'granted') return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const treatments = new Map(state.treatments.map((item) => [item.id, item]));
      const items = state.doses
        .filter((dose) => dose.status === 'pending')
        .map((dose) => ({ dose, treatment: treatments.get(dose.treatmentId) }))
        .filter(
          (item): item is { dose: Dose; treatment: Treatment } =>
            Boolean(item.treatment?.active),
        );

      void syncDoseNotifications(items).catch(() => undefined);
    };

    const timeout = setTimeout(run, 1000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      void refresh();
      run();
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [
    isPatient,
    permission.status,
    refresh,
    state.doses,
    state.treatments,
  ]);

  return null;
}
