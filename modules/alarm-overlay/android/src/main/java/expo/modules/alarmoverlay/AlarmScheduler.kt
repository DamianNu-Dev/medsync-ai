package expo.modules.alarmoverlay

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Programa alarmas exactas en el sistema operativo usando AlarmManager.
 *
 * Las alarmas viven fuera del proceso de React Native: suenan aunque la app
 * esté cerrada, el teléfono bloqueado o el usuario haya sacado la app de las
 * aplicaciones recientes. Cada vez que una alarma se dispara se vuelve a armar
 * la siguiente, de modo que la agenda sobrevive a reinicios y a horas sin abrir
 * la app. El estado se guarda en SharedPreferences para rearmarlo tras un
 * reinicio del teléfono.
 */
object AlarmScheduler {

  private const val PREFS = "medsync_native_alarms"
  private const val KEY_LIST = "alarms_v1"
  private const val KEY_ARMED = "armed_v1"

  /** Cuántas alarmas se mantienen armadas a la vez (las más próximas). */
  private const val MAX_ARMED = 48

  const val EXTRA_ID = "alarm_id"
  const val EXTRA_AT = "alarm_at"
  const val EXTRA_TREATMENT_ID = "alarm_treatment_id"
  const val EXTRA_NAME = "alarm_name"
  const val EXTRA_STRENGTH = "alarm_strength"
  const val EXTRA_DOSE_LABEL = "alarm_dose_label"

  data class Alarm(
    val id: String,
    val at: Long,
    val treatmentId: String,
    val name: String,
    val strength: String,
    val doseLabel: String,
  )

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveAndArm(context: Context, json: String): Boolean {
    prefs(context).edit().putString(KEY_LIST, json).apply()
    return armNext(context)
  }

  /**
   * Programa una alarma de prueba en unos segundos para comprobar que el
   * aviso aparece encima de otras apps y con la pantalla bloqueada.
   */
  fun scheduleTestAlarm(context: Context, delaySeconds: Int): Boolean {
    val delay = if (delaySeconds < 2) 2 else delaySeconds
    val at = System.currentTimeMillis() + delay * 1000L
    val list = read(context).toMutableList()
    list.removeAll { it.id.startsWith("medsync_test_") }
    list.add(
      Alarm(
        id = "medsync_test_$at",
        at = at,
        treatmentId = "",
        name = "Alarma de prueba",
        strength = "MedSync AI",
        doseLabel = "Prueba de overlay",
      )
    )
    val array = JSONArray()
    for (alarm in list) {
      array.put(serialize(alarm))
    }
    prefs(context).edit().putString(KEY_LIST, array.toString()).apply()
    return armNext(context)
  }

  fun cancelTestAlarm(context: Context): Boolean {
    val manager = context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val list = read(context)
    for (alarm in list.filter { it.id.startsWith("medsync_test_") }) {
      try {
        manager.cancel(firePendingIntent(context, alarm.id))
      } catch (e: Exception) {
        // Sin efecto.
      }
    }
    val rest = list.filterNot { it.id.startsWith("medsync_test_") }
    val array = JSONArray()
    for (alarm in rest) {
      array.put(serialize(alarm))
    }
    prefs(context).edit().putString(KEY_LIST, array.toString()).apply()
    return armNext(context)
  }

  private fun serialize(alarm: Alarm): JSONObject {
    return JSONObject().apply {
      put("id", alarm.id)
      put("at", alarm.at)
      put("treatmentId", alarm.treatmentId)
      put("name", alarm.name)
      put("strength", alarm.strength)
      put("doseLabel", alarm.doseLabel)
    }
  }

  /** Convierte el objeto de una dosis enviado desde JS. */
  fun parsePayload(json: String): Alarm? {
    return try {
      val item = JSONObject(json)
      Alarm(
        id = item.optString("doseId", ""),
        at = item.optLong("at", 0L),
        treatmentId = item.optString("treatmentId", ""),
        name = item.optString("name", "Medicamento"),
        strength = item.optString("strength", ""),
        doseLabel = item.optString("doseLabel", ""),
      )
    } catch (e: Exception) {
      null
    }
  }

  fun read(context: Context): List<Alarm> {
    val raw = prefs(context).getString(KEY_LIST, null) ?: return emptyList()
    val alarms = mutableListOf<Alarm>()
    try {
      val array = JSONArray(raw)
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val id = item.optString("id", "")
        val at = item.optLong("at", 0L)
        if (id.isEmpty() || at <= 0L) continue
        alarms.add(
          Alarm(
            id = id,
            at = at,
            treatmentId = item.optString("treatmentId", ""),
            name = item.optString("name", "Medicamento"),
            strength = item.optString("strength", ""),
            doseLabel = item.optString("doseLabel", ""),
          )
        )
      }
    } catch (e: Exception) {
      return emptyList()
    }
    return alarms
  }

  fun scheduledCount(context: Context): Int {
    val now = System.currentTimeMillis()
    return read(context).count { it.at > now }
  }

  /**
   * Arma las alarmas más próximas y cancela las que ya no corresponden.
   * Devuelve true si quedó al menos una alarma activa.
   */
  fun armNext(context: Context): Boolean {
    val manager = context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val now = System.currentTimeMillis()
    val all = read(context)
    val upcoming = all
      .filter { it.at > now + 1500L }
      .sortedBy { it.at }
      .take(MAX_ARMED)
    val upcomingIds = upcoming.map { it.id }.toHashSet()

    val previouslyArmed = prefs(context).getStringSet(KEY_ARMED, emptySet()) ?: emptySet()
    for (id in previouslyArmed) {
      if (upcomingIds.contains(id)) continue
      try {
        manager.cancel(firePendingIntent(context, id))
      } catch (e: Exception) {
        // La alarma ya no existía.
      }
    }

    var armed = 0
    for (alarm in upcoming) {
      if (armOne(context, manager, alarm)) armed += 1
    }

    prefs(context).edit().putStringSet(KEY_ARMED, upcomingIds).apply()
    return armed > 0
  }

  fun cancelAll(context: Context): Boolean {
    val manager = context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (alarm in read(context)) {
      try {
        manager.cancel(firePendingIntent(context, alarm.id))
      } catch (e: Exception) {
        // Sin efecto.
      }
    }
    prefs(context).edit().remove(KEY_LIST).remove(KEY_ARMED).apply()
    return true
  }

  private fun armOne(context: Context, manager: AlarmManager, alarm: Alarm): Boolean {
    val pending = PendingIntent.getBroadcast(
      context,
      requestCode(alarm.id),
      buildFireIntent(context, alarm),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    try {
      if (canScheduleExact(manager)) {
        val show = PendingIntent.getActivity(
          context,
          requestCode(alarm.id) + 11,
          buildLaunchIntent(context, alarm),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(alarm.at, show), pending)
      } else {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.at, pending)
      }
      return true
    } catch (security: SecurityException) {
      return try {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.at, pending)
        true
      } catch (e: Exception) {
        false
      }
    } catch (e: Exception) {
      return false
    }
  }

  private fun canScheduleExact(manager: AlarmManager): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return try {
      manager.canScheduleExactAlarms()
    } catch (e: Exception) {
      false
    }
  }

  fun requestCode(id: String): Int {
    val code = id.hashCode()
    return if (code < 0) -code else code
  }

  private fun firePendingIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmReceiver.ACTION_FIRE
      putExtra(EXTRA_ID, id)
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode(id),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun buildFireIntent(context: Context, alarm: Alarm): Intent {
    return Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmReceiver.ACTION_FIRE
      putExtra(EXTRA_ID, alarm.id)
      putExtra(EXTRA_AT, alarm.at)
      putExtra(EXTRA_TREATMENT_ID, alarm.treatmentId)
      putExtra(EXTRA_NAME, alarm.name)
      putExtra(EXTRA_STRENGTH, alarm.strength)
      putExtra(EXTRA_DOSE_LABEL, alarm.doseLabel)
    }
  }

  /** Intent que abre la app cuando el usuario toca la alarma del sistema. */
  fun buildLaunchIntent(context: Context, alarm: Alarm?): Intent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).apply { setPackage(context.packageName) }
    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP
    )
    launch.putExtra("medsyncAlarm", true)
    if (alarm != null) {
      launch.putExtra("medsyncAlarmDoseId", alarm.id)
      launch.putExtra("medsyncAlarmTreatmentId", alarm.treatmentId)
      launch.putExtra("medsyncAlarmName", alarm.name)
      launch.putExtra(EXTRA_AT, alarm.at)
    }
    return launch
  }

  /** Vista previa del JSON recibido (para diagnóstico desde JS). */
  fun toDiagnostics(context: Context): JSONObject {
    val now = System.currentTimeMillis()
    val alarms = read(context)
    return JSONObject().apply {
      put("total", alarms.size)
      put("pending", alarms.count { it.at > now })
      put("next", alarms.filter { it.at > now }.minByOrNull { it.at }?.at ?: 0L)
    }
  }

  @Suppress("unused")
  private fun rawArray(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_LIST, "[]") ?: "[]"
    return try {
      JSONArray(raw)
    } catch (e: Exception) {
      JSONArray()
    }
  }
}
