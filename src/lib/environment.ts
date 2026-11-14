import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo Go no aplica los config plugins, así que no incluye el servicio de
 * reproducción en segundo plano de expo-audio ni declara permisos extra.
 * En la app instalada (development/preview/production) sí están disponibles.
 */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

/** Controles de pantalla bloqueada: solo en builds instalados y fuera de web. */
export const supportsLockScreenControls = Platform.OS !== 'web' && !isExpoGo;
