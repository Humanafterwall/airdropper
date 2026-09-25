package com.example.mediatomp3

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps the process alive (foreground service + progress notification) while a conversion runs,
 * so switching to another app does not kill a long conversion.
 */
class ConversionService : Service() {

    private val listener: (ConversionManager.State) -> Unit = { update(it) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ConversionManager.addListener(listener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val n = build(ConversionManager.state)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, n)
            }
        } catch (e: Exception) {
            // Foreground start can be refused by the system; the conversion still runs in-process.
        }
        if (!ConversionManager.isBusy) finish()
        return START_NOT_STICKY
    }

    private fun update(state: ConversionManager.State) {
        if (state is ConversionManager.State.Converting) {
            runCatching { getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, build(state)) }
        } else {
            finish()
        }
    }

    private fun finish() {
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        stopSelf()
    }

    private fun build(state: ConversionManager.State): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val progress = (state as? ConversionManager.State.Converting)?.progress ?: -1f
        return Notification.Builder(this, App.CHANNEL_CONVERSION)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle("Converting to MP3…")
            .setContentText(ConversionManager.selectedName ?: "")
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(1000, (progress.coerceAtLeast(0f) * 1000).toInt(), progress < 0f)
            .build()
    }

    override fun onDestroy() {
        ConversionManager.removeListener(listener)
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_ID = 2
    }
}
