import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { Dose, Treatment } from '@/types';

const CHANNEL_ID = 'medsync-alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationPermissionState = {
  status: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  canAskAgain: boolean;
  exactAlarm: boolean;
};

export interface ScheduledDose {
  dose: Dose;
  treatment: Treatment;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Alarmas de toma',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function isGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', canAskAgain: false, exactAlarm: false };
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    let exactAlarm = true;
    if (Platform.OS === 'android') {
      try {
        const exact = await Notifications.getExactAlarmPermissionsAsync();
        exactAlarm = exact.granted;
      } catch {
        exactAlarm = false;
      }
    }
    const granted = isGranted(settings);
    return {
      status: granted
        ? 'granted'
        : settings.status === 'denied'
          ? 'denied'
          : 'undetermined',
      canAskAgain: settings.canAskAgain,
      exactAlarm,
    };
  } catch {
    return { status: 'undetermined', canAskAgain: true, exactAlarm: false };
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', canAskAgain: false, exactAlarm: false };
  }

  await ensureAndroidChannel();
  try {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  } catch {
    // Algunos dispositivos no permiten volver a mostrar el diálogo.
  }
  return getNotificationPermissionState();
}

export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const current = await Notifications.getExactAlarmPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestExactAlarmPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // En web no existe una pantalla equivalente.
  }
}

/**
 * Programa alarmas locales para las próximas dosis. No sustituye la alarma
 * interna: la notificación abre la app, y la app exige la verificación visual.
 *
 * Por defecto no pide permisos: la solicitud se hace desde una tarjeta
 * explícita para no sorprender a la persona con un diálogo del sistema.
 */
export async function syncDoseNotifications(
  items: ScheduledDose[],
  options: { requestPermission?: boolean } = {},
): Promise<number> {
  if (Platform.OS === 'web') return 0;

  let permission = await getNotificationPermissionState();
  if (permission.status !== 'granted' && options.requestPermission) {
    permission = await requestNotificationPermission();
  }
  if (permission.status !== 'granted') return 0;

  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const horizon = now + 7 * 24 * 60 * 60 * 1000;
  let scheduled = 0;

  const pending = items
    .filter((item) => item.dose.status === 'pending')
    .filter((item) => {
      const at = new Date(item.dose.scheduledAt).getTime();
      return at > now + 1000 && at <= horizon;
    })
    .sort(
      (a, b) =>
        new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
    )
    .slice(0, 60);

  for (const item of pending) {
    const at = new Date(item.dose.scheduledAt).getTime();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Hora de ${item.treatment.name}`,
        body: `${item.treatment.strength} · Abre MedSync para verificar tu toma con la cámara.`,
        sound: 'default',
        data: { doseId: item.dose.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        channelId: CHANNEL_ID,
      },
    });
    scheduled += 1;
  }

  return scheduled;
}
