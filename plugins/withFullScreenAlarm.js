const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Prepara la actividad principal para que Android pueda mostrarla encima de
 * la pantalla bloqueada y encender la pantalla cuando llega una alarma.
 * stopWithTask="false" evita que el proceso se detenga al quitar la app
 * de las recientes (swipe away).
 */
function withFullScreenAlarm(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const activities = application?.activity ?? [];
    const mainActivity = activities.find((activity) => {
      const name = activity.$?.['android:name'];
      return name === '.MainActivity' || Boolean(name?.endsWith('.MainActivity'));
    });

    if (mainActivity) {
      mainActivity.$['android:showWhenLocked'] = 'true';
      mainActivity.$['android:turnScreenOn'] = 'true';
      mainActivity.$['android:stopWithTask'] = 'false';
      mainActivity.$['android:launchMode'] = 'singleTask';
    }

    return config;
  });
}

module.exports = withFullScreenAlarm;
