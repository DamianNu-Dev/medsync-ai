package expo.modules.alarmoverlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Vuelve a armar las alarmas después de reiniciar el teléfono, actualizar la
 * app o cambiar la hora/zona horaria. Sin esto, Android borra las alarmas
 * pendientes al apagar el dispositivo.
 */
class BootReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    try {
      AlarmScheduler.armNext(context)
    } catch (e: Exception) {
      // Sin efecto: la app rearma al abrirse.
    }
  }
}
