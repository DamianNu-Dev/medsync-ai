package com.medsync.ai.alarm

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import com.medsync.ai.R

/**
 * Activity que se abre en pantalla completa encima de cualquier otra app o juego.
 * Usa FLAG_SHOW_WHEN_LOCKED, FLAG_TURN_SCREEN_ON, FLAG_KEEP_SCREEN_ON y
 * FLAG_DISMISS_KEYGUARD para encender la pantalla y mostrar la alarma aunque
 * el teléfono esté bloqueado o el usuario esté en otra aplicación.
 */
class AlarmOverlayActivity : Activity() {

    companion object {
        const val EXTRA_DOSE_ID = "doseId"
        const val EXTRA_TREATMENT_ID = "treatmentId"
        const val EXTRA_TREATMENT_NAME = "treatmentName"
        const val EXTRA_TREATMENT_STRENGTH = "treatmentStrength"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Overlay total sobre cualquier aplicación
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        val intent = intent
        val doseId = intent.getStringExtra(EXTRA_DOSE_ID) ?: ""
        val treatmentId = intent.getStringExtra(EXTRA_TREATMENT_ID) ?: ""
        val treatmentName = intent.getStringExtra(EXTRA_TREATMENT_NAME) ?: "Medicamento"
        val treatmentStrength = intent.getStringExtra(EXTRA_TREATMENT_STRENGTH) ?: ""

        // Lanzar MainActivity con los datos de la alarma para que el JS
        // muestre la pantalla de verificación con cámara
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = "com.medsync.ai.alarm.SHOW"
            putExtra(EXTRA_DOSE_ID, doseId)
            putExtra(EXTRA_TREATMENT_ID, treatmentId)
            putExtra(EXTRA_TREATMENT_NAME, treatmentName)
            putExtra(EXTRA_TREATMENT_STRENGTH, treatmentStrength)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        startActivity(launchIntent)
        finish()
    }

    override fun onBackPressed() {
        // No permitir cerrar con el botón atrás mientras la alarma está activa.
        // El usuario debe verificar con la cámara o la alarma sigue sonando.
        moveTaskToBack(true)
    }

    override fun onUserLeaveHint() {
        // El usuario presionó el botón Home: mantener la actividad visible.
        moveTaskToBack(false)
    }
}
