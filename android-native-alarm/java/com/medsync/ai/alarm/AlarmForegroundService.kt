package com.medsync.ai.alarm

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.medsync.ai.MainActivity
import com.medsync.ai.R

/**
 * Servicio de Android en foreground que mantiene la alarma sonando aunque el
 * usuario saque la aplicación de segundos plano, bloquee el pantalla o quita
 * la app de las recientes. Usa un wake lock parcial para mantener la CPU
 * activa y una notificación persistente como servicio de foreground.
 */
class AlarmForegroundService : Service() {

    companion object {
        const val ACTION_START_ALARM = "com.medsync.ai.alarm.START_ALARM"
        const val ACTION_STOP_ALARM = "com.medsync.ai.alarm.STOP_ALARM"
        const val CHANNEL_ID = "medsync-alarm-service"
        const val NOTIFICATION_ID = 1001
        const val EXTRA_DOSE_ID = "doseId"
        const val EXTRA_TREATMENT_ID = "treatmentId"
        const val EXTRA_TREATMENT_NAME = "treatmentName"
        const val EXTRA_TREATMENT_STRENGTH = "treatmentStrength"
    }

    private lateinit var wakeLock: PowerManager.WakeLock
    private var isAlarmActive = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        when (action) {
            ACTION_START_ALARM -> {
                startAlarm(intent)
            }
            ACTION_STOP_ALARM -> {
                stopAlarm()
            }
        }

        return START_STICKY
    }

    private fun startAlarm(intent: Intent?) {
        if (isAlarmActive) return
        isAlarmActive = true

        // Wake lock parcial para mantener la CPU activa aunque el teléfono esté bloqueado
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MedSync:AlarmWakeLock"
        )
        wakeLock.acquire(15 * 60 * 1000) // 15 minutos máximo

        // Notificación de foreground persistente
        val notification = buildNotification(intent)
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun stopAlarm() {
        isAlarmActive = false
        wakeLock?.release()
        stopForeground(true)
        stopSelf()
    }

    private fun buildNotification(intent: Intent?): Notification {
        val doseName = intent?.getStringExtra(EXTRA_TREATMENT_NAME) ?: "Medicamento"
        val doseStrength = intent?.getStringExtra(EXTRA_TREATMENT_STRENGTH) ?: ""

        // Abrir MainActivity al tocar la notificación
        val openIntent = Intent(this, MainActivity::class.java).apply {
            action = "com.medsync.ai.alarm.SHOW"
            putExtra(EXTRA_DOSE_ID, intent?.getStringExtra(EXTRA_DOSE_ID) ?: "")
            putExtra(EXTRA_TREATMENT_ID, intent?.getStringExtra(EXTRA_TREATMENT_ID) ?: "")
            putExtra(EXTRA_TREATMENT_NAME, doseName)
            putExtra(EXTRA_TREATMENT_STRENGTH, doseStrength)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingOpen = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Abrir overlay al tocar la acción de verificar
        val verifyIntent = Intent(this, AlarmOverlayActivity::class.java).apply {
            putExtra(EXTRA_DOSE_ID, intent?.getStringExtra(EXTRA_DOSE_ID) ?: "")
            putExtra(EXTRA_TREATMENT_ID, intent?.getStringExtra(EXTRA_TREATMENT_ID) ?: "")
            putExtra(EXTRA_TREATMENT_NAME, doseName)
            putExtra(EXTRA_TREATMENT_STRENGTH, doseStrength)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingVerify = PendingIntent.getActivity(
            this, 1, verifyIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Hora de $doseName")
            .setContentText("$doseStrength · Toca para verificar tu toma con la cámara")
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF0B6B57)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pendingVerify, true) // <-- Abre pantalla encima de todo
            .addAction(NotificationCompat.Action(
                R.drawable.ic_notification,
                "Verificar ahora",
                pendingVerify
            ))
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(false)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        wakeLock?.release()
        isAlarmActive = false
    }
}
