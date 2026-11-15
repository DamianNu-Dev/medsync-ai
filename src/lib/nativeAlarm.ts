import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * Tipos compartidos con el módulo nativo `modules/alarm-overlay`.
 * Se declaran aquí (y no se importan del módulo) para que Expo Go, iOS y la
 * web nunca evalúen el `requireNativeModule` del módulo nativo.
 */
export type AlarmAccessStatus = {
  overlay: boolean;
  exactAlarm: boolean;
  fullScreenIntent: boolean;
  batteryOptimized: boolean;
  alarmRunning: boolean;
  scheduledCount: number;
};

export type NativeAlarmPayload = {
  doseId: string;
  treatmentId: string;
  name: string;
  strength: string;
  doseLabel: string;
};

export type NativeScheduledAlarm = NativeAlarmPayload & {
  id: string;
  at: number;
};

export const EMPTY_ALARM_STATUS: AlarmAccessStatus = {
  overlay: false,
  exactAlarm: false,
  fullScreenIntent: false,
  batteryOptimized: true,
  alarmRunning: false,
  scheduledCount: 0,
};

type AlarmNativeModule = {
  startAlarm(
    payloadJson: string,
    showUi: boolean,
    openApp: boolean,
  ): Promise<boolean>;
  stopAlarm(): Promise<boolean>;
  scheduleAlarms(alarmsJson: string): Promise<boolean>;
  cancelAlarms(): Promise<boolean>;
  scheduleTestAlarm(delaySeconds: number): Promise<boolean>;
  cancelTestAlarm(): Promise<boolean>;
  isOverlayPermissionGranted(): Promise<boolean>;
  isAlarmRunning(): Promise<boolean>;
  getStatus(): Promise<AlarmAccessStatus>;
  openOverlaySettings(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openBatteryOptimizationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
};

/**
 * El módulo nativo solo existe en Android y en builds instalados. En Expo Go,
 * iOS y web `requireOptionalNativeModule` devuelve null y todas las funciones
 * se vuelven no-ops seguros.
 */
const native: AlarmNativeModule | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<AlarmNativeModule>('AlarmOverlay')
    : null;

export const isNativeAlarmAvailable = native !== null;

export const NativeAlarm = {
  available: isNativeAlarmAvailable,

  /** Inicia la alarma nativa (sonido + vibración + overlay opcional). */
  async startAlarm(
    payload: NativeAlarmPayload,
    options: { showUi?: boolean; openApp?: boolean } = {},
  ): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.startAlarm(
        JSON.stringify(payload),
        options.showUi ?? true,
        options.openApp ?? false,
      );
    } catch {
      return false;
    }
  },

  /** Detiene el sonido, la vibración, la notificación y el overlay. */
  async stopAlarm(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.stopAlarm();
    } catch {
      return false;
    }
  },

  /** Programa las alarmas exactas del sistema (sobreviven a cerrar la app). */
  async scheduleAlarms(alarms: NativeScheduledAlarm[]): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.scheduleAlarms(JSON.stringify(alarms));
    } catch {
      return false;
    }
  },

  async cancelAlarms(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.cancelAlarms();
    } catch {
      return false;
    }
  },

  /** Alarma de prueba real (overlay + sonido) dentro de unos segundos. */
  async scheduleTestAlarm(delaySeconds = 10): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.scheduleTestAlarm(Math.max(2, Math.round(delaySeconds)));
    } catch {
      return false;
    }
  },

  async cancelTestAlarm(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.cancelTestAlarm();
    } catch {
      return false;
    }
  },

  async getStatus(): Promise<AlarmAccessStatus> {
    if (!native) return EMPTY_ALARM_STATUS;
    try {
      return await native.getStatus();
    } catch {
      return EMPTY_ALARM_STATUS;
    }
  },

  async isAlarmRunning(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isAlarmRunning();
    } catch {
      return false;
    }
  },

  async isOverlayPermissionGranted(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isOverlayPermissionGranted();
    } catch {
      return false;
    }
  },

  async openOverlaySettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openOverlaySettings();
    } catch {
      // Sin efecto.
    }
  },

  async openExactAlarmSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openExactAlarmSettings();
    } catch {
      // Sin efecto.
    }
  },

  async openFullScreenIntentSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openFullScreenIntentSettings();
    } catch {
      // Sin efecto.
    }
  },

  async openBatteryOptimizationSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openBatteryOptimizationSettings();
    } catch {
      // Sin efecto.
    }
  },

  async openAppSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openAppSettings();
    } catch {
      // Sin efecto.
    }
  },
};

export default NativeAlarm;
