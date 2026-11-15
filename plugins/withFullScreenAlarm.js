const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Prepara MainActivity para que la alarma pueda abrirse a pantalla completa
 * cuando el teléfono está bloqueado o el usuario está dentro de otra app:
 *
 * - showWhenLocked / turnScreenOn: enciende la pantalla y se muestra sobre el
 *   bloqueo.
 * - launchMode singleTask: evita crear pantallas duplicadas al abrir la alarma.
 *
 * El overlay sobre otras apps y el servicio en primer plano viven en el módulo
 * nativo `modules/alarm-overlay` (autolink), no en este plugin.
 */
function withFullScreenAlarm(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    const activities = application.activity ?? [];
    const main = activities.find(
      (activity) => activity.$?.['android:name'] === '.MainActivity',
    );

    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
      main.$['android:launchMode'] = 'singleTask';
      main.$['android:excludeFromRecents'] = 'false';
    }

    return config;
  });
}

module.exports = withFullScreenAlarm;
