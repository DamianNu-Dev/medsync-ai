import { Platform } from 'react-native';

import { isExpoGo } from '@/lib/environment';
import { Dose, Treatment } from '@/types';

type NotifeeModule = typeof import('@notifee/react-native');

const CHANNEL_ID = 'medsync-alarm';
const ALARM_SOUND = 'alarm';
const MAX_TRIGGERS = 45;

let cachedModule: NotifeeModule | null | undefined;

/**
 * Notifee no está incluido en Expo Go. El require se hace en tiempo de
 * ejecución para que Expo Go siga arrancando sin el módulo nativo.
 */
function loadNotifee(): NotifeeModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS !== 'android' || isExpoGo) {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('@notifee/react-native') as NotifeeModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * Las alarmas con pantalla completa solo existen en Android y en un build
 * instalado. En Expo Go y en iOS se usa expo-notifications.
 */
export function supportsFullScreenAlarm(): boolean {
  return Platform.OS === 'android' && !isExpoGo && loadNotifee() !== null;
}

export interface OverlayDose {
  dose: Dose;
  treatment: Treatment;
}

async function ensureChannel(): Promise<void> {
  const mod = loadNotifee();
  if (!mod) return;
  const { AndroidImportance, AndroidVisibility } = mod;
  try {
    await mod.default.createChannel({
      id: CHANNEL_ID,
      name: 'Alarmas de toma',
      description: 'Alarma que abre la pantalla para tomar el medicamento.',
      importance: AndroidImportance.HIGH,
      sound: ALARM_SOUND,
      vibration: true,
      vibrationPattern: [0, 800, 350, 800],
      lights: true,
      lightColor: '#0B6B57',
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
    });
  } catch {
    // El canal puede existir ya (creado por expo-notifications).
  }
}

function notificationFor(item: OverlayDose) {
  return {
    id: `dose-${item.dose.id}`,
    title: `Hora de ${item.treatment.name}`,
    body: `${item.treatment.strength} · Abre MedSync y verifica tu toma con la cámara.`,
    data: {
      doseId: item.dose.id,
      treatmentId: item.treatment.id,
      url: `/treatment/${item.treatment.id}`,
    },
  };
}

/**
 * Programa alarmas con AlarmManager (tipo reloj) y full-screen intent.
 * Cuando llega la hora, Android abre MedSync por encima de la app actual y
 * la alarma interna exige la verificación con la cámara.
 */
export async function scheduleOverlayAlarms(items: OverlayDose[]): Promise<number> {
  const mod = loadNotifee();
  if (!mod) return 0;

  const { AndroidCategory, AndroidImportance, AndroidVisibility, AlarmType } = mod;
  const notifee = mod.default;
  await ensureChannel();

  const now = Date.now();
  const pending = items
    .filter((item) => item.dose.status === 'pending' && item.treatment.active)
    .filter((item) => new Date(item.dose.scheduledAt).getTime() > now + 1000)
    .sort(
      (a, b) =>
        new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
    )
    .slice(0, MAX_TRIGGERS);

  try {
    await notifee.cancelTriggerNotifications();
  } catch {
    // Si no había alarmas programadas, el sistema puede devolver un error.
  }

  let scheduled = 0;
  for (let index = 0; index < pending.length; index += 10) {
    const batch = pending.slice(index, index + 10);
    const results = await Promise.allSettled(
      batch.map((item) =>
        notifee.createTriggerNotification(
          {
            ...notificationFor(item),
            android: {
              channelId: CHANNEL_ID,
              category: AndroidCategory.ALARM,
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              sound: ALARM_SOUND,
              loopSound: true,
              ongoing: true,
              autoCancel: false,
              showTimestamp: true,
              lightUpScreen: true,
              pressAction: { id: 'default' },
              fullScreenAction: { id: 'default' },
            },
          },
          {
            type: mod.TriggerType.TIMESTAMP,
            timestamp: new Date(item.dose.scheduledAt).getTime(),
            alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
          },
        ),
      ),
    );
    scheduled += results.filter((result) => result.status === 'fulfilled').length;
  }

  return scheduled;
}

/** Detiene el sonido en bucle de la notificación que ya se mostró. */
export async function cancelDisplayedAlarms(): Promise<void> {
  const mod = loadNotifee();
  if (!mod) return;
  try {
    await mod.default.cancelDisplayedNotifications();
  } catch {
    // no-op
  }
}

export async function cancelTriggeredAlarms(): Promise<void> {
  const mod = loadNotifee();
  if (!mod) return;
  try {
    await mod.default.cancelTriggerNotifications();
  } catch {
    // no-op
  }
}

/** Aviso de prueba con pantalla completa y sonido en bucle. */
export async function scheduleOverlayTest(delaySeconds = 10): Promise<boolean> {
  const mod = loadNotifee();
  if (!mod) return false;
  const { AndroidCategory, AndroidImportance, AndroidVisibility, AlarmType } = mod;
  const notifee = mod.default;
  await ensureChannel();

  try {
    await notifee.createTriggerNotification(
      {
        id: `test-${Date.now()}`,
        title: 'Prueba de alarma MedSync',
        body: 'La pantalla debe abrirse y sonar hasta que abras la app. Bloquea el teléfono para probarlo.',
        data: { test: '1' },
        android: {
          channelId: CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: ALARM_SOUND,
          loopSound: true,
          ongoing: true,
          autoCancel: false,
          lightUpScreen: true,
          pressAction: { id: 'default' },
          fullScreenAction: { id: 'default' },
        },
      },
      {
        type: mod.TriggerType.TIMESTAMP,
        timestamp: Date.now() + Math.max(2, delaySeconds) * 1000,
        alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
      },
    );
    return true;
  } catch {
    return false;
  }
}
