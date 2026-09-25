package com.example.mediatomp3

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.util.concurrent.CopyOnWriteArraySet

/** In-process bridge between the UI and [PlayerService]. */
object PlayerHub {
    var track: Track? = null
        internal set
    var isPlaying = false
        internal set
    var isPrepared = false
        internal set
    var durationMs = 0L
        internal set
    var lastError: String? = null
        internal set

    internal var service: PlayerService? = null
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<() -> Unit>()

    val positionMs: Long get() = service?.positionMs() ?: 0L

    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }
    internal fun changed() = main.post { listeners.forEach { it() } }

    fun play(context: Context, t: Track) {
        send(context, Intent(context, PlayerService::class.java)
            .setAction(PlayerService.ACTION_PLAY)
            .setData(t.uri)
            .putExtra(PlayerService.EXTRA_TITLE, t.title)
            .putExtra(PlayerService.EXTRA_FILE, t.fileName)
            .putExtra(PlayerService.EXTRA_DURATION, t.durationMs)
            .putExtra(PlayerService.EXTRA_SIZE, t.sizeBytes))
    }

    fun togglePlayPause(context: Context) {
        val s = service
        if (s != null) s.toggle()
        else track?.let { play(context, it) }
    }

    fun stop() { service?.stopPlayback() }

    fun seekTo(ms: Long) { service?.seekTo(ms) }

    private fun send(context: Context, intent: Intent) {
        try {
            context.startForegroundService(intent)
        } catch (e: Exception) {
            lastError = "Playback could not be started: ${e.message}"
            changed()
        }
    }
}

/**
 * Plays MP3s with [MediaPlayer] in a foreground service, exposing a [MediaSession] so the
 * notification shade and lock screen show media controls (play/pause/stop/seek).
 */
class PlayerService : Service() {

    companion object {
        const val ACTION_PLAY = "com.example.mediatomp3.PLAY"
        const val ACTION_TOGGLE = "com.example.mediatomp3.TOGGLE"
        const val ACTION_STOP = "com.example.mediatomp3.STOP"
        const val EXTRA_TITLE = "title"
        const val EXTRA_FILE = "file"
        const val EXTRA_DURATION = "duration"
        const val EXTRA_SIZE = "size"
        private const val NOTIFICATION_ID = 1
    }

    private var player: MediaPlayer? = null
    private lateinit var session: MediaSession
    private lateinit var audioManager: AudioManager
    private var focusRequest: AudioFocusRequest? = null
    private var resumeOnFocusGain = false
    private var noisyRegistered = false
    private var isForeground = false

    private val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) pause()
        }
    }

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> { resumeOnFocusGain = false; pause() }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                resumeOnFocusGain = PlayerHub.isPlaying
                pause()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> runCatching { player?.setVolume(0.3f, 0.3f) }
            AudioManager.AUDIOFOCUS_GAIN -> {
                runCatching { player?.setVolume(1f, 1f) }
                if (resumeOnFocusGain) { resumeOnFocusGain = false; resume() }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(AudioManager::class.java)
        session = MediaSession(this, "MediaToMP3").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = resume()
                override fun onPause() = pause()
                override fun onStop() = stopPlayback()
                override fun onSeekTo(pos: Long) = seekTo(pos)
            })
            setSessionActivity(openAppIntent())
            isActive = true
        }
        PlayerHub.service = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Always satisfy startForegroundService() promptly.
        goForeground()
        when (intent?.action) {
            ACTION_PLAY -> {
                val uri = intent.data
                if (uri == null) stopPlayback()
                else {
                    val t = Track(
                        uri,
                        intent.getStringExtra(EXTRA_TITLE) ?: "MP3",
                        intent.getStringExtra(EXTRA_FILE) ?: "",
                        intent.getLongExtra(EXTRA_DURATION, 0L),
                        intent.getLongExtra(EXTRA_SIZE, 0L)
                    )
                    startTrack(t)
                }
            }
            ACTION_TOGGLE -> if (player == null) stopPlayback() else toggle()
            ACTION_STOP -> stopPlayback()
            else -> if (player == null) stopPlayback()
        }
        return START_NOT_STICKY
    }

    private fun startTrack(t: Track) {
        releasePlayer()
        PlayerHub.track = t
        PlayerHub.durationMs = t.durationMs
        PlayerHub.isPrepared = false
        PlayerHub.isPlaying = false
        PlayerHub.lastError = null
        try {
            val mp = MediaPlayer()
            player = mp
            mp.setAudioAttributes(attrs)
            mp.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
            mp.setDataSource(applicationContext, t.uri)
            mp.setOnPreparedListener {
                PlayerHub.isPrepared = true
                if (it.duration > 0) PlayerHub.durationMs = it.duration.toLong()
                resume()
            }
            mp.setOnCompletionListener {
                PlayerHub.isPlaying = false
                runCatching { it.seekTo(0) }
                abandonFocus()
                refresh()
            }
            mp.setOnErrorListener { _, what, extra ->
                fail("This MP3 can't be played (error $what/$extra).")
                true
            }
            mp.prepareAsync()
        } catch (e: Exception) {
            fail("This MP3 can't be played: ${e.message ?: "file not found"}")
            return
        }
        refresh()
    }

    private fun fail(msg: String) {
        PlayerHub.lastError = msg
        stopPlayback()
    }

    fun positionMs(): Long = runCatching {
        if (PlayerHub.isPrepared) player?.currentPosition?.toLong() ?: 0L else 0L
    }.getOrDefault(0L)

    fun toggle() { if (PlayerHub.isPlaying) pause() else resume() }

    fun resume() {
        val mp = player ?: return
        if (!PlayerHub.isPrepared) return
        if (!requestFocus()) return
        try {
            mp.start()
            PlayerHub.isPlaying = true
            if (!noisyRegistered) {
                val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
                if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
                else registerReceiver(noisyReceiver, filter)
                noisyRegistered = true
            }
        } catch (e: Exception) {
            PlayerHub.isPlaying = false
        }
        refresh()
    }

    fun pause() {
        val mp = player ?: return
        runCatching { if (mp.isPlaying) mp.pause() }
        PlayerHub.isPlaying = false
        unregisterNoisy()
        refresh()
    }

    fun seekTo(ms: Long) {
        val mp = player ?: return
        if (!PlayerHub.isPrepared) return
        runCatching { mp.seekTo(ms.coerceIn(0L, PlayerHub.durationMs.coerceAtLeast(0L)).toInt()) }
        refresh()
    }

    fun stopPlayback() {
        releasePlayer()
        PlayerHub.isPlaying = false
        PlayerHub.isPrepared = false
        abandonFocus()
        session.setPlaybackState(PlaybackState.Builder().setState(PlaybackState.STATE_STOPPED, 0, 0f).build())
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        isForeground = false
        PlayerHub.changed()
        stopSelf()
    }

    private fun releasePlayer() {
        unregisterNoisy()
        player?.let { mp -> runCatching { mp.reset() }; runCatching { mp.release() } }
        player = null
    }

    private fun unregisterNoisy() {
        if (noisyRegistered) {
            runCatching { unregisterReceiver(noisyReceiver) }
            noisyRegistered = false
        }
    }

    private fun requestFocus(): Boolean {
        val req = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setOnAudioFocusChangeListener(focusListener)
            .build().also { focusRequest = it }
        return audioManager.requestAudioFocus(req) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonFocus() {
        focusRequest?.let { runCatching { audioManager.abandonAudioFocusRequest(it) } }
    }

    /** Pushes the current state to the MediaSession, the notification and the UI. */
    private fun refresh() {
        val t = PlayerHub.track
        if (t != null) {
            session.setMetadata(
                MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, t.title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, getString(R.string.app_name))
                    .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, t.title)
                    .putLong(MediaMetadata.METADATA_KEY_DURATION, PlayerHub.durationMs)
                    .build()
            )
        }
        val st = when {
            PlayerHub.isPlaying -> PlaybackState.STATE_PLAYING
            PlayerHub.isPrepared -> PlaybackState.STATE_PAUSED
            player != null -> PlaybackState.STATE_BUFFERING
            else -> PlaybackState.STATE_STOPPED
        }
        session.setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                        PlaybackState.ACTION_STOP or PlaybackState.ACTION_SEEK_TO
                )
                .setState(st, positionMs(), if (PlayerHub.isPlaying) 1f else 0f)
                .build()
        )
        if (player != null) {
            runCatching { getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification()) }
        }
        PlayerHub.changed()
    }

    private fun goForeground() {
        val n = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, n)
            }
            isForeground = true
        } catch (e: Exception) {
            // Not allowed right now (e.g. background start restrictions): play without foreground status.
        }
    }

    private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(
        this, 0,
        Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    private fun serviceIntent(action: String, code: Int): PendingIntent = PendingIntent.getService(
        this, code, Intent(this, PlayerService::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    private fun buildNotification(): Notification {
        val playing = PlayerHub.isPlaying
        val toggle = Notification.Action.Builder(
            Icon.createWithResource(this, if (playing) R.drawable.ic_pause else R.drawable.ic_play),
            if (playing) "Pause" else "Play",
            serviceIntent(ACTION_TOGGLE, 1)
        ).build()
        val stop = Notification.Action.Builder(
            Icon.createWithResource(this, R.drawable.ic_stop), "Stop", serviceIntent(ACTION_STOP, 2)
        ).build()
        return Notification.Builder(this, App.CHANNEL_PLAYBACK)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(PlayerHub.track?.title ?: getString(R.string.app_name))
            .setContentText(if (playing) "Playing" else "Paused")
            .setSubText(getString(R.string.app_name))
            .setContentIntent(openAppIntent())
            .setDeleteIntent(serviceIntent(ACTION_STOP, 3))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setColor(0xFF39FF14.toInt())
            .setOngoing(playing)
            .addAction(toggle)
            .addAction(stop)
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1))
            .build()
    }

    override fun onDestroy() {
        releasePlayer()
        abandonFocus()
        session.isActive = false
        session.release()
        if (PlayerHub.service === this) PlayerHub.service = null
        PlayerHub.isPlaying = false
        PlayerHub.isPrepared = false
        PlayerHub.changed()
        super.onDestroy()
    }
}
