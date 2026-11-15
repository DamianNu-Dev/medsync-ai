import { NativeModule, requireNativeModule } from 'expo';

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

declare class AlarmOverlayModule extends NativeModule<Record<string, never>> {
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
}

export default requireNativeModule<AlarmOverlayModule>('AlarmOverlay');
