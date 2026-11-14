const { withAndroidManifest } = require('expo/config-plugins');

const FULL_SCREEN_ACTIVITY = '.MainActivity';

/**
 * Prepara la actividad principal para que Android pueda mostrarla encima de
 * la pantalla bloqueada y encender la pantalla cuando llega una alarma
 * (full-screen intent). Los atributos son inofensivos si el permiso
 * USE_FULL_SCREEN_INTENT no está concedido.
 */
function withFullScreenAlarm(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const activities = application?.activity ?? [];
    const mainActivity = activities.find((activity) => {
      const name = activity.$?.['android:name'];
      return name === FULL_SCREEN_ACTIVITY || Boolean(name?.endsWith(FULL_SCREEN_ACTIVITY));
    });

    if (mainActivity) {
      mainActivity.$['android:showWhenLocked'] = 'true';
      mainActivity.$['android:turnScreenOn'] = 'true';
    }

    return config;
  });
}

module.exports = withFullScreenAlarm;
