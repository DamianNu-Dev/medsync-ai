package expo.modules.alarmoverlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Recibe la alarma exacta programada con AlarmManager y arranca el servicio
 * que hace sonar el teléfono y pinta el aviso a pantalla completa por encima
 * de cualquier otra aplicación.
 */
class AlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_FIRE = "expo.modules.alarmoverlay.ALARM_FIRE"
  }

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent == null) return
    if (intent.action != ACTION_FIRE) return

    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: ""
    val treatmentId = intent.getStringExtra(AlarmScheduler.EXTRA_TREATMENT_ID) ?: ""
    val name = intent.getStringExtra(AlarmScheduler.EXTRA_NAME) ?: "Medicamento"
    val strength = intent.getStringExtra(AlarmScheduler.EXTRA_STRENGTH) ?: ""
    val doseLabel = intent.getStringExtra(AlarmScheduler.EXTRA_DOSE_LABEL) ?: ""

    // Rearmar primero: si el sistema mata el proceso, la siguiente alarma
    // ya quedó programada.
    try {
      AlarmScheduler.armNext(context)
    } catch (e: Exception) {
      // Se reintenta al abrir la app.
    }

    AlarmForegroundService.start(
      context = context,
      doseId = id,
      treatmentId = treatmentId,
      treatmentName = name,
      strength = strength,
      doseLabel = doseLabel,
      showUi = true,
      openApp = true,
    )
  }
}
