package expo.modules.alarmoverlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt
import org.json.JSONObject

/**
 * Servicio en primer plano que mantiene la alarma viva y audible.
 *
 * - Suena con el tono de alarma del sistema en bucle, usando el canal de audio
 *   de ALARM (suena incluso con el teléfono en silencio).
 * - Vibra en bucle.
 * - Pinta una ventana TYPE_APPLICATION_OVERLAY a pantalla completa por encima
 *   de cualquier app o juego (requiere el permiso "Aparecer encima de otras
 *   apps").
 * - Publica una notificación con full-screen intent, así que también abre la
 *   app cuando el teléfono está bloqueado.
 * - Sigue vivo si el usuario saca la app de las recientes (`stopWithTask=false`).
 */
class AlarmForegroundService : Service() {

  companion object {
    const val ACTION_START = "expo.modules.alarmoverlay.START_ALARM"
    const val ACTION_STOP = "expo.modules.alarmoverlay.STOP_ALARM"

    const val EXTRA_DOSE_ID = "alarm_dose_id"
    const val EXTRA_TREATMENT_ID = "alarm_treatment_id"
    const val EXTRA_NAME = "alarm_name"
    const val EXTRA_STRENGTH = "alarm_strength"
    const val EXTRA_DOSE_LABEL = "alarm_dose_label"
    const val EXTRA_SHOW_UI = "alarm_show_ui"
    const val EXTRA_OPEN_APP = "alarm_open_app"

    private const val CHANNEL_ID = "medsync-native-alarm-v1"
    private const val NOTIFICATION_ID = 4711
    private const val TIMEOUT_MS = 10 * 60 * 1000L
    private const val PREFS_ACTIVE = "medsync_active_alarm"
    private const val KEY_ACTIVE = "active_v1"
    private const val ACTIVE_TTL_MS = 15 * 60 * 1000L

    @Volatile
    private var running = false

    fun isRunning(): Boolean = running

    fun start(
      context: Context,
      doseId: String,
      treatmentId: String,
      treatmentName: String,
      strength: String,
      doseLabel: String,
      showUi: Boolean,
      openApp: Boolean,
    ) {
      val intent = Intent(context, AlarmForegroundService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_DOSE_ID, doseId)
        putExtra(EXTRA_TREATMENT_ID, treatmentId)
        putExtra(EXTRA_NAME, treatmentName)
        putExtra(EXTRA_STRENGTH, strength)
        putExtra(EXTRA_DOSE_LABEL, doseLabel)
        putExtra(EXTRA_SHOW_UI, showUi)
        putExtra(EXTRA_OPEN_APP, openApp)
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        // Android puede bloquear el arranque en segundo plano; se reintenta
        // cuando el usuario abre la app.
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, AlarmForegroundService::class.java))
      } catch (e: Exception) {
        // Sin efecto.
      }
    }
  }

  private data class AlarmInfo(
    val doseId: String,
    val treatmentId: String,
    val name: String,
    val strength: String,
    val doseLabel: String,
  )

  private var player: MediaPlayer? = null
  private var ringtone: Ringtone? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null

  private val handler = Handler(Looper.getMainLooper())
  private val timeoutRunnable = Runnable { shutdown() }

  private var info: AlarmInfo? = null
  private var uiShown = false
  private var appOpened = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) {
      // El sistema reinició el servicio tras matarlo por falta de memoria.
      // Si había una alarma activa hace pocos minutos se retoma tal cual.
      val restored = restoreActive()
      if (restored == null || running) {
        if (restored == null) shutdown()
        return START_NOT_STICKY
      }
      beginAlarm(restored.first, restored.second, false)
      return START_STICKY
    }

    if (intent.action == ACTION_STOP) {
      shutdown()
      return START_NOT_STICKY
    }

    if (intent.action != ACTION_START) {
      return START_NOT_STICKY
    }

    val next = AlarmInfo(
      doseId = intent.getStringExtra(EXTRA_DOSE_ID) ?: "",
      treatmentId = intent.getStringExtra(EXTRA_TREATMENT_ID) ?: "",
      name = intent.getStringExtra(EXTRA_NAME) ?: "Medicamento",
      strength = intent.getStringExtra(EXTRA_STRENGTH) ?: "",
      doseLabel = intent.getStringExtra(EXTRA_DOSE_LABEL) ?: "",
    )
    val showUi = intent.getBooleanExtra(EXTRA_SHOW_UI, true)
    val openApp = intent.getBooleanExtra(EXTRA_OPEN_APP, false)

    if (running) {
      // El servicio ya está sonando: solo se ajusta la interfaz.
      info = next
      persistActive(next, showUi)
      if (showUi && !uiShown) {
        showOverlay(next)
        startSound()
        startVibration()
      } else if (!showUi && uiShown) {
        removeOverlay()
        stopSound()
      }
      if (running) {
        updateNotification(showUi)
      }
      if (openApp && !appOpened) {
        appOpened = true
        openApp()
      }
      return START_STICKY
    }

    beginAlarm(next, showUi, openApp)
    return START_STICKY
  }

  private fun beginAlarm(next: AlarmInfo, showUi: Boolean, openApp: Boolean) {
    running = true
    info = next
    appOpened = openApp
    persistActive(next, showUi)

    ensureChannel()
    startForeground(NOTIFICATION_ID, buildNotification(next, showUi))
    acquireWakeLock()

    // Con la app en primer plano el sonido lo controla React Native (evita
    // que suenen dos pistas a la vez). El servicio toma el relevo en cuanto la
    // persona sale de la app, bloquea el teléfono o llega la alarma del sistema.
    if (showUi) {
      startSound()
      startVibration()
      showOverlay(next)
    }
    if (openApp) {
      openApp()
    }

    handler.removeCallbacks(timeoutRunnable)
    handler.postDelayed(timeoutRunnable, TIMEOUT_MS)
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // La alarma debe seguir sonando aunque el usuario cierre la app desde las
    // aplicaciones recientes. Si el sonido lo llevaba React Native, el servicio
    // lo retoma y pinta el aviso a pantalla completa.
    if (running && !uiShown) {
      val current = info
      if (current != null) {
        startSound()
        startVibration()
        showOverlay(current)
        persistActive(current, true)
        updateNotification(true)
      }
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    releaseResources()
    super.onDestroy()
  }

  private fun shutdown() {
    releaseResources()
    stopSelf()
  }

  /**
   * Guarda la alarma en curso. Si Android mata el servicio por falta de
   * memoria lo reinicia con `intent == null` y la alarma continúa sonando.
   */
  private fun persistActive(current: AlarmInfo, showUi: Boolean) {
    try {
      val json = JSONObject().apply {
        put("doseId", current.doseId)
        put("treatmentId", current.treatmentId)
        put("name", current.name)
        put("strength", current.strength)
        put("doseLabel", current.doseLabel)
        put("showUi", showUi)
        put("savedAt", System.currentTimeMillis())
      }
      getSharedPreferences(PREFS_ACTIVE, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_ACTIVE, json.toString())
        .apply()
    } catch (e: Exception) {
      // Sin efecto.
    }
  }

  private fun restoreActive(): Pair<AlarmInfo, Boolean>? {
    return try {
      val raw = getSharedPreferences(PREFS_ACTIVE, Context.MODE_PRIVATE)
        .getString(KEY_ACTIVE, null) ?: return null
      val json = JSONObject(raw)
      val savedAt = json.optLong("savedAt", 0L)
      if (savedAt <= 0L || System.currentTimeMillis() - savedAt > ACTIVE_TTL_MS) return null
      Pair(
        AlarmInfo(
          doseId = json.optString("doseId", ""),
          treatmentId = json.optString("treatmentId", ""),
          name = json.optString("name", "Medicamento"),
          strength = json.optString("strength", ""),
          doseLabel = json.optString("doseLabel", ""),
        ),
        json.optBoolean("showUi", true),
      )
    } catch (e: Exception) {
      null
    }
  }

  private fun clearActive() {
    try {
      getSharedPreferences(PREFS_ACTIVE, Context.MODE_PRIVATE)
        .edit()
        .remove(KEY_ACTIVE)
        .apply()
    } catch (e: Exception) {
      // Sin efecto.
    }
  }

  private fun releaseResources() {
    running = false
    clearActive()
    handler.removeCallbacks(timeoutRunnable)
    removeOverlay()
    try {
      player?.stop()
    } catch (e: Exception) {
      // Sin efecto.
    }
    try {
      player?.release()
    } catch (e: Exception) {
      // Sin efecto.
    }
    player = null
    try {
      ringtone?.stop()
    } catch (e: Exception) {
      // Sin efecto.
    }
    ringtone = null
    try {
      vibrator?.cancel()
    } catch (e: Exception) {
      // Sin efecto.
    }
    vibrator = null
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (e: Exception) {
      // Sin efecto.
    }
    wakeLock = null
    try {
      stopForeground(true)
    } catch (e: Exception) {
      // Sin efecto.
    }
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.cancel(NOTIFICATION_ID)
    } catch (e: Exception) {
      // Sin efecto.
    }
    info = null
    uiShown = false
    appOpened = false
  }

  // ---------------------------------------------------------------- sonido --

  private fun startSound() {
    // Subir el volumen del canal de alarma para que se escuche siempre.
    try {
      val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      if (audio.getStreamVolume(AudioManager.STREAM_ALARM) < max) {
        audio.setStreamVolume(AudioManager.STREAM_ALARM, max, 0)
      }
    } catch (e: Exception) {
      // Algunos equipos bloquean el cambio de volumen.
    }

    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: Settings.System.DEFAULT_NOTIFICATION_URI

    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    try {
      player = MediaPlayer().apply {
        setAudioAttributes(attributes)
        setDataSource(this@AlarmForegroundService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      player = null
    }

    if (player == null) {
      try {
        ringtone = RingtoneManager.getRingtone(this, uri)?.apply {
          audioAttributes = attributes
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            isLooping = true
          }
          play()
        }
      } catch (e: Exception) {
        ringtone = null
      }
    }
  }

  private fun stopSound() {
    try {
      player?.stop()
    } catch (e: Exception) {
      // Sin efecto.
    }
    try {
      player?.release()
    } catch (e: Exception) {
      // Sin efecto.
    }
    player = null
    try {
      ringtone?.stop()
    } catch (e: Exception) {
      // Sin efecto.
    }
    ringtone = null
    try {
      vibrator?.cancel()
    } catch (e: Exception) {
      // Sin efecto.
    }
    vibrator = null
  }

  private fun startVibration() {
    try {
      val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        manager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
      device.cancel()
      val pattern = longArrayOf(0, 700, 300, 700)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        device.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        @Suppress("DEPRECATION")
        device.vibrate(pattern, 0)
      }
      vibrator = device
    } catch (e: Exception) {
      vibrator = null
    }
  }

  private fun acquireWakeLock() {
    try {
      val power = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MedSync::AlarmWakeLock").apply {
        setReferenceCounted(false)
        acquire(TIMEOUT_MS + 60_000L)
      }
    } catch (e: Exception) {
      wakeLock = null
    }
  }

  // --------------------------------------------------------- notificaciones --

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Alarma de medicamento",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Alarma que suena hasta verificar la toma."
        // El sonido lo controla el servicio con MediaPlayer para poder
        // repetirlo sin cortes; el canal queda en silencio.
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    } catch (e: Exception) {
      // Sin efecto: la notificación se publica igual.
    }
  }

  private fun updateNotification(showUi: Boolean) {
    val current = info ?: return
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification(current, showUi))
    } catch (e: Exception) {
      // Sin efecto.
    }
  }

  private fun buildNotification(current: AlarmInfo, showUi: Boolean): Notification {
    val launchIntent = AlarmScheduler.buildLaunchIntent(this, null)
    val contentIntent = PendingIntent.getActivity(
      this,
      9001,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val detail = listOf(current.strength, current.doseLabel)
      .filter { it.isNotEmpty() }
      .joinToString(" · ")

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    builder
      .setContentTitle("Hora de ${current.name}")
      .setContentText(
        if (detail.isEmpty()) "Verifica tu toma con la cámara" else "$detail · Verifica tu toma"
      )
      .setSmallIcon(R.drawable.ic_medsync_alarm)
      .setColor(Color.parseColor("#8E1B15"))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(System.currentTimeMillis())
      .addAction(0, "Verificar ahora", contentIntent)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_MAX)
    }

    if (showUi) {
      builder.setFullScreenIntent(contentIntent, true)
    }

    return builder.build()
  }

  // --------------------------------------------------------------- overlay --

  private fun showOverlay(current: AlarmInfo) {
    if (!Settings.canDrawOverlays(this)) return
    removeOverlay()
    try {
      val manager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val view = buildOverlayView(current)
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }
      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        type,
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
        PixelFormat.TRANSLUCENT,
      )
      params.gravity = Gravity.TOP or Gravity.START
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        params.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
      manager.addView(view, params)
      overlayView = view
      windowManager = manager
      uiShown = true
    } catch (e: Exception) {
      overlayView = null
      windowManager = null
      uiShown = false
    }
  }

  private fun removeOverlay() {
    val view = overlayView ?: return
    try {
      windowManager?.removeView(view)
    } catch (e: Exception) {
      // La ventana ya no estaba agregada.
    }
    overlayView = null
    windowManager = null
    uiShown = false
  }

  private fun buildOverlayView(current: AlarmInfo): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(28), dp(56), dp(28), dp(40))
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor("#8E1B15"), Color.parseColor("#4A0C09")),
      )
    }

    root.addView(
      textView("⏰", 54f, Color.WHITE, bold = false, centered = true),
      margins(top = 0),
    )
    root.addView(
      textView("ALARMA ACTIVA", 13f, Color.parseColor("#FFD7D2"), bold = true, centered = true),
      margins(top = 14),
    )
    root.addView(
      textView("Es hora de tu toma", 32f, Color.WHITE, bold = true, centered = true),
      margins(top = 10),
    )
    root.addView(
      textView(current.name, 28f, Color.WHITE, bold = true, centered = true),
      margins(top = 10),
    )
    val detail = listOf(current.strength, current.doseLabel)
      .filter { it.isNotEmpty() }
      .joinToString(" · ")
    if (detail.isNotEmpty()) {
      root.addView(
        textView(detail, 18f, Color.parseColor("#F6D2CE"), bold = false, centered = true),
        margins(top = 8),
      )
    }
    root.addView(
      textView(
        "La alarma seguirá sonando hasta que verifiques tu toma con la cámara.",
        16f,
        Color.parseColor("#F6D2CE"),
        bold = false,
        centered = true,
      ),
      margins(top = 26),
    )

    val button = textView(
      "Verificar con la cámara",
      19f,
      Color.parseColor("#8E1B15"),
      bold = true,
      centered = true,
    ).apply {
      setPadding(dp(20), dp(18), dp(20), dp(18))
      background = GradientDrawable().apply {
        cornerRadius = dp(18).toFloat()
        setColor(Color.WHITE)
      }
      isClickable = true
      isFocusable = true
      setOnClickListener {
        openApp()
        removeOverlay()
      }
    }
    root.addView(
      button,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = dp(34) },
    )

    return root
  }

  private fun textView(
    value: String,
    size: Float,
    color: Int,
    bold: Boolean,
    centered: Boolean,
  ): TextView {
    return TextView(this).apply {
      text = value
      textSize = size
      setTextColor(color)
      if (bold) typeface = Typeface.DEFAULT_BOLD
      if (centered) gravity = Gravity.CENTER
      setLineSpacing(0f, 1.15f)
    }
  }

  private fun margins(top: Int, bottom: Int = 0): LinearLayout.LayoutParams {
    return LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(top)
      bottomMargin = dp(bottom)
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).roundToInt()
  }

  // ------------------------------------------------------------- abrir app --

  private fun openApp() {
    try {
      val launch = AlarmScheduler.buildLaunchIntent(this, null)
      startActivity(launch)
    } catch (e: Exception) {
      // Android puede bloquear el inicio en segundo plano; el usuario puede
      // tocar la notificación.
    }
  }
}
