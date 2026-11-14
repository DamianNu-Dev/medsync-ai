package com.medsync.ai.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AlarmBridgeModule.NAME)
class AlarmBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AlarmBridge"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun isOverlayPermissionGranted(promise: Promise) {
        try {
            val granted = Settings.canDrawOverlays(reactApplicationContext)
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("E_ALARM_BRIDGE", e.message ?: "Error checking overlay permission")
        }
    }

    @ReactMethod
    fun startForegroundAlarm(
        doseId: String,
        treatmentId: String,
        treatmentName: String,
        treatmentStrength: String
    ) {
        try {
            val intent = Intent(reactApplicationContext, AlarmForegroundService::class.java).apply {
                action = AlarmForegroundService.ACTION_START_ALARM
                putExtra(AlarmForegroundService.EXTRA_DOSE_ID, doseId)
                putExtra(AlarmForegroundService.EXTRA_TREATMENT_ID, treatmentId)
                putExtra(AlarmForegroundService.EXTRA_TREATMENT_NAME, treatmentName)
                putExtra(AlarmForegroundService.EXTRA_TREATMENT_STRENGTH, treatmentStrength)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
        } catch (e: Exception) {
            // Error silencioso, se maneja desde JS
        }
    }

    @ReactMethod
    fun stopForegroundAlarm() {
        try {
            val intent = Intent(reactApplicationContext, AlarmForegroundService::class.java).apply {
                action = AlarmForegroundService.ACTION_STOP_ALARM
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.stopService(intent)
        } catch (e: Exception) {
            // Error silencioso
        }
    }

    @ReactMethod
    fun openOverlaySettings() {
        try {
            val currentActivity = currentActivity
            if (currentActivity == null) return
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactApplicationContext.packageName}"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            currentActivity.startActivity(intent)
        } catch (e: Exception) {
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            fallback.data = Uri.parse("package:${reactApplicationContext.packageName}")
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            currentActivity?.startActivity(fallback)
        }
    }

    @ReactMethod
    fun openExactAlarmSettings() {
        try {
            val currentActivity = currentActivity
            if (currentActivity == null) return
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            currentActivity.startActivity(intent)
        } catch (e: Exception) {
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            fallback.data = Uri.parse("package:${reactApplicationContext.packageName}")
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            currentActivity?.startActivity(fallback)
        }
    }
}
