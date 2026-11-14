const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withMainApplication } = require('expo/config-plugins');

const NATIVE_ALARM_DIR = path.join(__dirname, '..', 'android-native-alarm');

/**
 * Config plugin de Expo para inyectar el código nativo de la alarma de MedSync.
 *
 * Durante el build de EAS este plugin:
 * 1. Modifica AndroidManifest.xml con permisos, actividad overlay y servicio foreground.
 * 2. Modifica MainApplication.kt para registrar AlarmReactPackage y copia los archivos Kotlin nativos.
 */
function withNativeAlarm(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    // --- Permisos ---
    const permissions = manifest['uses-permission'] || [];
    const requiredPermissions = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ];

    const existingNames = new Set(
      permissions.map((p) => p.$?.['android:name']).filter(Boolean)
    );

    for (const perm of requiredPermissions) {
      if (!existingNames.has(perm)) {
        permissions.push({ $: { 'android:name': perm } });
        existingNames.add(perm);
      }
    }
    manifest['uses-permission'] = permissions;

    // --- Servicios ---
    const services = application?.service || [];
    const hasForegroundService = services.some(
      (s) => s.$?.['android:name'] === '.alarm.AlarmForegroundService'
    );
    if (!hasForegroundService) {
      services.push({
        $: {
          'android:name': '.alarm.AlarmForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }
    application.service = services;

    // --- Actividades ---
    const activities = application?.activity || [];
    const hasOverlayActivity = activities.some(
      (a) => a.$?.['android:name'] === '.alarm.AlarmOverlayActivity'
    );
    if (!hasOverlayActivity) {
      activities.push({
        $: {
          'android:name': '.alarm.AlarmOverlayActivity',
          'android:exported': 'true',
          'android:theme': '@style/Theme.App.SplashScreen',
          'android:screenOrientation': 'portrait',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:launchMode': 'singleInstance',
          'android:taskAffinity': '',
          'android:excludeFromRecents': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.medsync.ai.alarm.SHOW_OVERLAY' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          },
        ],
      });
    }
    application.activity = activities;

    return config;
  });

  /**
   * Copia archivos nativos y modifica MainApplication.kt después de que
   * expo prebuild genere el directorio android/. Usamos withMainApplication
   * como punto de entrada para acceder al sistema de archivos.
   */
  config = withMainApplication(config, (contents) => {
    const root = config.projectRoot || process.cwd();
    const androidDir = path.join(root, 'android');
    const targetJavaDir = path.join(
      androidDir,
      'app',
      'src',
      'main',
      'java',
      'com',
      'medsync',
      'ai',
      'alarm'
    );
    const targetDrawableDir = path.join(
      androidDir,
      'app',
      'src',
      'main',
      'res',
      'drawable'
    );
    const mainAppPath = path.join(
      androidDir,
      'app',
      'src',
      'main',
      'java',
      'com',
      'medsync',
      'ai',
      'MainApplication.kt'
    );

    try {
      // Copiar archivos Kotlin nativos
      const kotlinFiles = [
        'AlarmOverlayActivity.kt',
        'AlarmForegroundService.kt',
        'AlarmBridgeModule.kt',
        'AlarmReactPackage.kt',
      ];

      if (!fs.existsSync(targetJavaDir)) {
        fs.mkdirSync(targetJavaDir, { recursive: true });
      }

      for (const file of kotlinFiles) {
        const src = path.join(
          NATIVE_ALARM_DIR,
          'java',
          'com',
          'medsync',
          'ai',
          'alarm',
          file
        );
        const dest = path.join(targetJavaDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // Copiar drawable de notificación
      if (!fs.existsSync(targetDrawableDir)) {
        fs.mkdirSync(targetDrawableDir, { recursive: true });
      }
      const drawableSrc = path.join(
        NATIVE_ALARM_DIR,
        'res',
        'drawable',
        'ic_notification.xml'
      );
      const drawableDest = path.join(targetDrawableDir, 'ic_notification.xml');
      if (fs.existsSync(drawableSrc)) {
        fs.copyFileSync(drawableSrc, drawableDest);
      }

      // Modificar MainApplication.kt para registrar AlarmReactPackage
      let nextContents = contents;

      // Agregar import si no existe
      if (!nextContents.includes('import com.medsync.ai.alarm.AlarmReactPackage')) {
        nextContents = nextContents.replace(
          /^import expo\.modules\./m,
          'import com.medsync.ai.alarm.AlarmReactPackage\n$&'
        );
      }

      // Agregar add(AlarmReactPackage()) si no existe
      if (!nextContents.includes('add(AlarmReactPackage())')) {
        nextContents = nextContents.replace(
          /(\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\n)(\s*)\/\/ add\(MyReactNativePackage\(\)\)/,
          '$1$2add(AlarmReactPackage())'
        );
        if (!nextContents.includes('add(AlarmReactPackage())')) {
          nextContents = nextContents.replace(
            /\/\/ add\(MyReactNativePackage\(\)\)/,
            'add(AlarmReactPackage())'
          );
        }
      }

      // También escribir el archivo modificado al sistema de archivos
      // (contenido ya será escrito por expo, pero nos aseguramos)
      if (fs.existsSync(mainAppPath)) {
        fs.writeFileSync(mainAppPath, nextContents, 'utf8');
      }

      return nextContents;
    } catch (e) {
      console.warn('[MedSyncAlarm] Error injecting native alarm code:', e.message);
      return contents;
    }
  });

  return config;
}

module.exports = withNativeAlarm;
