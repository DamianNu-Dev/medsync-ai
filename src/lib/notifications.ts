import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
  AndroidNotificationVisibility,
  IosAuthorizationStatus,
} from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { Dose, Treatment } from '@/types';

const CHANNEL_ID = 'medsync-alarm';
const ALARM_SOUND = 'alarm.wav';
const HORIZON_DAYS = 30;
const MAX_SCHEDULED = 200;
const EXACT_ALARM_PROMPT_KEY = '@medsync-ai/exact-alarm-prompted/v1';

/**
 * Expo Go no incluye los archivos de sonido personalizados ni declara el
 * permiso de alarmas exactas en su propio manifiesto. En la app instalada
 * (development/production build) sí se usan.
 */
const isExpoGo = Constants.executionEnvironment === 'storeClient';

function alarmSound(): string | undefined {
  return isExpoGo ? undefined : ALARM_SOUND;
}

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
  exactAlarmCanAsk: boolean;
};

export interface ScheduledDose {
  dose: Dose;
  treatment: Treatment;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Alarmas de toma',
    description: 'Avisos para tomar tus medicamentos a la hora indicada.',
    importance: AndroidImportance.MAX,
    sound: alarmSound() ?? 'default',
    vibrationPattern: [0, 800, 350, 800],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#0B6B57',
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: AndroidAudioUsage.ALARM,
      contentType: AndroidAudioContentType.SONIFICATION,
    },
  });
}

function isGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  return (
    settings.granted ||
    settings.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    settings.ios?.status === IosAuthorizationStatus.EPHEMERAL
  );
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported',
      canAskAgain: false,
      exactAlarm: false,
      exactAlarmCanAsk: false,
    };
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    let exactAlarm = true;
    let exactAlarmCanAsk = true;
    if (Platform.OS === 'android') {
      try {
        const exact = await Notifications.getExactAlarmPermissionsAsync();
        exactAlarm = exact.granted;
        exactAlarmCanAsk = exact.canAskAgain;
      } catch {
        exactAlarm = false;
        exactAlarmCanAsk = false;
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
      exactAlarmCanAsk,
    };
  } catch {
    return {
      status: 'undetermined',
      canAskAgain: true,
      exactAlarm: false,
      exactAlarmCanAsk: false,
    };
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported',
      canAskAgain: false,
      exactAlarm: false,
      exactAlarmCanAsk: false,
    };
  }

  // En Android 13+ el canal debe existir antes de pedir el permiso.
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

/**
 * Pide una sola vez el permiso de alarmas exactas en la app instalada.
 * En Expo Go el permiso no está declarado, así que no se intenta.
 */
export async function ensureExactAlarmPermissionOnce(): Promise<void> {
  if (Platform.OS !== 'android' || isExpoGo) return;
  try {
    const current = await Notifications.getExactAlarmPermissionsAsync();
    if (current.granted || !current.canAskAgain) return;
    const alreadyAsked = await AsyncStorage.getItem(EXACT_ALARM_PROMPT_KEY);
    if (alreadyAsked) return;
    await AsyncStorage.setItem(EXACT_ALARM_PROMPT_KEY, '1');
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {
    // Si el permiso no está declarado, se ignora silenciosamente.
  }
}

export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // En web no existe una pantalla equivalente.
  }
}

function deliveryForAlarm(): 'alarmClock' | 'bestEffort' {
  // En Expo Go el permiso exacto no está declarado; el sistema lo degrada solo.
  return 'alarmClock';
}

function contentForDose(item: ScheduledDose): Notifications.NotificationContentInput {
  const sound = alarmSound() ?? 'default';
  return {
    title: `Hora de ${item.treatment.name}`,
    body: `${item.treatment.strength} · Abre MedSync para verificar tu toma con la cámara.`,
    sound,
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: [0, 800, 350, 800],
    color: '#0B6B57',
    categoryIdentifier: 'medsync-dose',
    ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
    data: {
      doseId: item.dose.id,
      treatmentId: item.treatment.id,
      url: `/treatment/${item.treatment.id}`,
    },
  };
}

async function scheduleDose(item: ScheduledDose): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: contentForDose(item),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(item.dose.scheduledAt),
      channelId: CHANNEL_ID,
      delivery: deliveryForAlarm(),
    },
  });
}

/**
 * Programa alarmas locales para las próximas dosis. No sustituye la alarma
 * interna: la notificación abre la app, y la app exige la verificación visual.
 *
 * Por defecto no pide permisos: la solicitud se hace desde una tarjeta
 * explícita o al iniciar sesión como paciente.
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
  const horizon = now + HORIZON_DAYS * 24 * 60 * 60 * 1000;

  const pending = items
    .filter((item) => item.dose.status === 'pending' && item.treatment.active)
    .filter((item) => {
      const at = new Date(item.dose.scheduledAt).getTime();
      return at > now + 1000 && at <= horizon;
    })
    .sort(
      (a, b) =>
        new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
    )
    .slice(0, MAX_SCHEDULED);

  let scheduled = 0;
  for (let index = 0; index < pending.length; index += 10) {
    const batch = pending.slice(index, index + 10);
    const results = await Promise.allSettled(batch.map((item) => scheduleDose(item)));
    scheduled += results.filter((result) => result.status === 'fulfilled').length;
  }

  return scheduled;
}

/** Aviso de prueba para comprobar que el teléfono suena con la app bloqueada. */
export async function scheduleTestAlarmNotification(
  delaySeconds = 10,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const permission = await getNotificationPermissionState();
  if (permission.status !== 'granted') return false;

  await ensureAndroidChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Prueba de alarma MedSync',
        body: 'Si ves y escuchas este aviso, tus recordatorios funcionan. Bloquea el teléfono para probarlo.',
        sound: alarmSound() ?? 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 800, 350, 800],
        color: '#0B6B57',
        ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
        data: { test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + Math.max(2, delaySeconds) * 1000),
        channelId: CHANNEL_ID,
        delivery: deliveryForAlarm(),
      },
    });
    return true;
  } catch {
    return false;
  }
}
