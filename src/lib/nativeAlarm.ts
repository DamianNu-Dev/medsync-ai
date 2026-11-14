import { Platform } from 'react-native';
import { NativeModules } from 'react-native';

const { AlarmBridge } = NativeModules;

/**
 * Bridge con el servicio nativo de alarma en Android.
 * Permite iniciar/detener el ForegroundService que mantiene la alarma
 * sonando aunque el usuario saque la app de segundos plano o bloquee el teléfono.
 */
export const NativeAlarm = {
  /** Verifica si el permiso "Dibujar sobre otras apps" está concedido. */
  isOverlayPermissionGranted: async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || !AlarmBridge) return false;
    try {
      return await AlarmBridge.isOverlayPermissionGranted();
    } catch {
      return false;
    }
  },

  /** Inicia el servicio de foreground de alarma. */
  startForegroundAlarm: async (
    doseId: string,
    treatmentId: string,
    treatmentName: string,
    treatmentStrength: string
  ): Promise<void> => {
    if (Platform.OS !== 'android' || !AlarmBridge) return;
    try {
      await AlarmBridge.startForegroundAlarm(
        doseId,
        treatmentId,
        treatmentName,
        treatmentStrength
      );
    } catch {
      // El servicio ya puede estar corriendo.
    }
  },

  /** Detiene el servicio de foreground de alarma. */
  stopForegroundAlarm: async (): Promise<void> => {
    if (Platform.OS !== 'android' || !AlarmBridge) return;
    try {
      await AlarmBridge.stopForegroundAlarm();
    } catch {
      // no-op
    }
  },

  /** Abre Ajustes para conceder el permiso de dibujo sobre otras apps. */
  openOverlaySettings: async (): Promise<void> => {
    if (Platform.OS !== 'android' || !AlarmBridge) return;
    try {
      await AlarmBridge.openOverlaySettings();
    } catch {
      // no-op
    }
  },

  /** Abre Ajustes para conceder alarmas exactas. */
  openExactAlarmSettings: async (): Promise<void> => {
    if (Platform.OS !== 'android' || !AlarmBridge) return;
    try {
      await AlarmBridge.openExactAlarmSettings();
    } catch {
      // no-op
    }
  },
};

export default NativeAlarm;
