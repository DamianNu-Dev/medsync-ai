package expo.modules.alarmoverlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Puente entre la app y la alarma nativa de Android.
 *
 * La lógica pesada vive en [AlarmForegroundService] y [AlarmScheduler]; este
 * módulo solo expone funciones seguras para que React Native pueda iniciar y
 * detener la alarma, programar las alarmas exactas del sistema y consultar o
 * abrir los permisos especiales que Android exige.
 */
class AlarmOverlayModule : Module() {

  private val context: Context?
    get() = appContext.reactContext ?: appContext.currentActivity

  override fun definition() = ModuleDefinition {
    Name("AlarmOverlay")

    // payloadJson: { "doseId": "...", "treatmentId": "...", "name": "...",
    //                "strength": "...", "doseLabel": "..." }
    AsyncFunction("startAlarm") { payloadJson: String, showUi: Boolean, openApp: Boolean ->
      val ctx = context
      val payload = AlarmScheduler.parsePayload(payloadJson)
      if (ctx == null || payload == null) {
        false
      } else {
        AlarmForegroundService.start(
          context = ctx,
          doseId = payload.id,
          treatmentId = payload.treatmentId,
          treatmentName = payload.name,
          strength = payload.strength,
          doseLabel = payload.doseLabel,
          showUi = showUi,
          openApp = openApp,
        )
        true
      }
    }

    AsyncFunction("stopAlarm") {
      val ctx = context
      if (ctx == null) {
        false
      } else {
        AlarmForegroundService.stop(ctx)
        true
      }
    }

    AsyncFunction("scheduleAlarms") { alarmsJson: String ->
      val ctx = context
      if (ctx == null) false else AlarmScheduler.saveAndArm(ctx, alarmsJson)
    }

    AsyncFunction("cancelAlarms") {
      val ctx = context
      if (ctx == null) false else AlarmScheduler.cancelAll(ctx)
    }

    AsyncFunction("scheduleTestAlarm") { delaySeconds: Int ->
      val ctx = context
      if (ctx == null) false else AlarmScheduler.scheduleTestAlarm(ctx, delaySeconds)
    }

    AsyncFunction("cancelTestAlarm") {
      val ctx = context
      if (ctx == null) false else AlarmScheduler.cancelTestAlarm(ctx)
    }

    AsyncFunction("isOverlayPermissionGranted") {
      val ctx = context
      if (ctx == null) false else Settings.canDrawOverlays(ctx)
    }

    AsyncFunction("isAlarmRunning") {
      AlarmForegroundService.isRunning()
    }

    AsyncFunction("getStatus") {
      val ctx = context
      if (ctx == null) {
        mapOf<String, Any>()
      } else {
        val power = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        val exact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val manager = ctx.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
          manager.canScheduleExactAlarms()
        } else {
          true
        }
        val fullScreen = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
          manager.canUseFullScreenIntent()
        } else {
          true
        }
        mapOf<String, Any>(
          "overlay" to Settings.canDrawOverlays(ctx),
          "exactAlarm" to exact,
          "fullScreenIntent" to fullScreen,
          "batteryOptimized" to !power.isIgnoringBatteryOptimizations(ctx.packageName),
          "alarmRunning" to AlarmForegroundService.isRunning(),
          "scheduledCount" to AlarmScheduler.scheduledCount(ctx),
        )
      }
    }

    AsyncFunction("openOverlaySettings") {
      openSystemSettings(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context?.packageName}"),
        ),
      )
    }

    AsyncFunction("openExactAlarmSettings") {
      openSystemSettings(
        Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context?.packageName}"),
        ),
      )
    }

    AsyncFunction("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSystemSettings(
          Intent(
            Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
            Uri.parse("package:${context?.packageName}"),
          ),
        )
      } else {
        openSystemSettings(
          Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${context?.packageName}"),
          ),
        )
      }
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      openSystemSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    AsyncFunction("openAppSettings") {
      openSystemSettings(
        Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${context?.packageName}"),
        ),
      )
    }
  }

  private fun openSystemSettings(intent: Intent) {
    val ctx = context ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        ctx.startActivity(intent)
      }
    } catch (e: Exception) {
      try {
        val fallback = Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${ctx.packageName}"),
        )
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(fallback)
      } catch (ignored: Exception) {
        // Sin efecto.
      }
    }
  }
}
