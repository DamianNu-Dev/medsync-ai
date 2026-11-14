const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('expo/config-plugins');

const NATIVE_ALARM_DIR = path.join(__dirname, '..', 'android-native-alarm');

/**
 * Config plugin de Expo para inyectar el código nativo de la alarma de MedSync.
 *
 * Durante el build de EAS este plugin:
 * 1. Modifica AndroidManifest.xml con permisos, actividad overlay y servicio foreground.
 * 2. Copia los archivos Kotlin nativos al directorio android generado.
 * 3. Modifica MainApplication.kt para registrar AlarmReactPackage.
 */
function withNativeAlarm(config) {
  config = withAndroidManifest(config, (config) => {
    const root = config.projectRoot || process.cwd();
    const androidDir = path.join(root, 'android');
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    // ============ MODIFICAR MANIFIESTO ============

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

    // ============ COPIAR ARCHIVOS KOTLIN NATIVOS ============
    try {
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
          console.log(`[MedSyncAlarm] Copiado: ${file}`);
        } else {
          console.warn(`[MedSyncAlarm] No encontrado: ${src}`);
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
        console.log('[MedSyncAlarm] Copiado: ic_notification.xml');
      }

      // Modificar MainApplication.kt directamente desde el sistema de archivos
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

      if (fs.existsSync(mainAppPath)) {
        let fileContents = fs.readFileSync(mainAppPath, 'utf8');

        // Agregar import si no existe
        if (!fileContents.includes('import com.medsync.ai.alarm.AlarmReactPackage')) {
          fileContents = fileContents.replace(
            /^import expo\.modules\./m,
            'import com.medsync.ai.alarm.AlarmReactPackage\n$&'
          );
        }

        // Agregar add(AlarmReactPackage()) si no existe
        if (!fileContents.includes('add(AlarmReactPackage())')) {
          fileContents = fileContents.replace(
            /(\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\n)(\s*)\/\/ add\(MyReactNativePackage\(\)\)/,
            '$1$2add(AlarmReactPackage())'
          );
          if (!fileContents.includes('add(AlarmReactPackage())')) {
            fileContents = fileContents.replace(
              /\/\/ add\(MyReactNativePackage\(\)\)/,
              'add(AlarmReactPackage())'
            );
          }
        }

        fs.writeFileSync(mainAppPath, fileContents, 'utf8');
        console.log('[MedSyncAlarm] MainApplication.kt modificado');
      }
    } catch (e) {
      console.warn('[MedSyncAlarm] Error injecting native alarm code:', e.message);
    }

    return config;
  });

  return config;
}

module.exports = withNativeAlarm;
