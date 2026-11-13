import React, { useEffect } from 'react';

import { syncDoseNotifications } from '@/lib/notifications';
import { useApp } from '@/store/AppProvider';
import { useNotifications } from '@/store/NotificationProvider';

/**
 * Mantiene las notificaciones locales alineadas con las tomas pendientes.
 * Solo programa si la persona ya concedió el permiso; nunca abre el diálogo
 * del sistema por sorpresa.
 */
export function NotificationSync() {
  const { state } = useApp();
  const { permission } = useNotifications();

  useEffect(() => {
    if (permission.status !== 'granted') return;
    if (!state.roleChosen || state.role !== 'patient') return;

    const treatments = new Map(state.treatments.map((item) => [item.id, item]));
    const items = state.doses
      .filter((dose) => dose.status === 'pending')
      .map((dose) => ({ dose, treatment: treatments.get(dose.treatmentId) }))
      .filter((item): item is { dose: typeof item.dose; treatment: NonNullable<typeof item.treatment> } =>
        Boolean(item.treatment?.active),
      );

    const timeout = setTimeout(() => {
      void syncDoseNotifications(items).catch(() => undefined);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [
    permission.status,
    state.doses,
    state.role,
    state.roleChosen,
    state.treatments,
  ]);

  return null;
}
