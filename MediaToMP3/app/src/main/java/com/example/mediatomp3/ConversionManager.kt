package com.example.mediatomp3

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegKitConfig
import com.arthenica.ffmpegkit.FFprobeKit
import com.arthenica.ffmpegkit.ReturnCode
import java.io.File
import java.io.IOException
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.CountDownLatch

/**
 * Converts a user-picked media file (SAF Uri) to MP3 with FFmpeg (libmp3lame) and saves it to
 * Music/MediaToMP3. Runs on a worker thread; UI observes [state] through [addListener].
 */
object ConversionManager {

    sealed class State {
        object Idle : State()
        /** [progress] in 0..1, or -1 when the duration is unknown. */
        data class Converting(val progress: Float) : State()
        data class Done(val track: Track, val location: String) : State()
        data class Failed(val message: String, val cancelled: Boolean = false) : State()
    }

    private const val TAG = "ConversionManager"
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<(State) -> Unit>()

    @Volatile var state: State = State.Idle
        private set

    // Currently selected input (kept here so it survives activity re-creation).
    var selectedUri: Uri? = null
    var selectedName: String? = null
    var bitrateKbps: Int = 192

    @Volatile private var sessionId: Long = -1
    @Volatile private var cancelRequested = false

    val isBusy get() = state is State.Converting

    fun addListener(l: (State) -> Unit) { listeners += l }
    fun removeListener(l: (State) -> Unit) { listeners -= l }

    private fun post(s: State) {
        state = s
        main.post { listeners.forEach { it(s) } }
    }

    fun reset() {
        if (!isBusy) post(State.Idle)
    }

    fun cancel() {
        if (!isBusy) return
        cancelRequested = true
        val id = sessionId
        runCatching { if (id >= 0) FFmpegKit.cancel(id) }
    }

    fun start(context: Context) {
        if (isBusy) return
        val uri = selectedUri ?: return
        val name = selectedName ?: "audio"
        val bitrate = bitrateKbps
        val app = context.applicationContext
        cancelRequested = false
        sessionId = -1
        post(State.Converting(-1f))
        runCatching {
            val i = Intent(app, ConversionService::class.java)
            app.startForegroundService(i)
        }
        Thread({ runConversion(app, uri, name, bitrate) }, "mp3-convert").start()
    }

    private fun runConversion(ctx: Context, uri: Uri, displayName: String, bitrate: Int) {
        var temp: File? = null
        try {
            // 1) Probe the input: readable? has audio? how long?
            val probeParam = FFmpegKitConfig.getSafParameterForRead(ctx, uri)
                ?: return fail("Could not open the selected file. Please choose it again.")
            val info = FFprobeKit.getMediaInformation(probeParam)?.mediaInformation
                ?: return fail("This file can't be read. It may be damaged or in an unsupported format.")
            val streams = info.streams ?: emptyList()
            if (streams.none { it.type == "audio" }) {
                return fail("The selected file has no audio track to convert.")
            }
            val durationSec = info.duration?.toDoubleOrNull() ?: 0.0
            if (cancelRequested) return fail("Conversion cancelled.", cancelled = true)

            // 2) Enough storage? (temp file in app cache + final copy in Music/)
            val estimated = (durationSec * bitrate * 1000 / 8 * 1.05).toLong() + 512 * 1024
            val cacheFree = ctx.cacheDir.usableSpace
            val musicFree = Mp3Repository.freeSpaceForMusic()
            if (durationSec > 0 && (cacheFree < estimated || musicFree < estimated * 2)) {
                return fail(
                    "Not enough free storage. About ${formatSize(estimated * 2)} is needed, " +
                        "only ${formatSize(minOf(cacheFree, musicFree))} is free."
                )
            }

            // 3) Convert to a temp file.
            ctx.cacheDir.listFiles { f -> f.name.startsWith("convert_") }?.forEach { it.delete() }
            val out = File(ctx.cacheDir, "convert_${System.currentTimeMillis()}.mp3")
            temp = out
            val inputParam = FFmpegKitConfig.getSafParameterForRead(ctx, uri)
                ?: return fail("Could not open the selected file. Please choose it again.")
            val args = arrayOf(
                "-y", "-hide_banner", "-nostdin",
                "-i", inputParam,
                "-map", "0:a:0",          // first audio stream only (video/subtitles dropped)
                "-vn", "-sn", "-dn",
                "-c:a", "libmp3lame",
                "-b:a", "${bitrate}k",
                "-map_metadata", "0",
                "-id3v2_version", "3",
                out.absolutePath
            )
            val latch = CountDownLatch(1)
            var lastPct = -1
            val session = FFmpegKit.executeWithArgumentsAsync(
                args,
                { latch.countDown() },
                null,
                { stats ->
                    if (durationSec > 0) {
                        val p = (stats.time / 1000.0 / durationSec).coerceIn(0.0, 1.0).toFloat()
                        val pct = (p * 100).toInt()
                        if (pct != lastPct) {
                            lastPct = pct
                            post(State.Converting(p))
                        }
                    }
                }
            )
            sessionId = session.sessionId
            if (cancelRequested) runCatching { FFmpegKit.cancel(sessionId) }
            latch.await()

            val rc = session.returnCode
            if (cancelRequested || ReturnCode.isCancel(rc)) return fail("Conversion cancelled.", cancelled = true)
            if (!ReturnCode.isSuccess(rc) || !out.exists() || out.length() == 0L) {
                val logs = runCatching { session.allLogsAsString }.getOrNull().orEmpty()
                Log.w(TAG, "FFmpeg failed rc=$rc\n${logs.takeLast(4000)}")
                return fail(explainFailure(logs))
            }

            // 4) Save to Music/MediaToMP3.
            val durationMs = Mp3Repository.probeDuration(out).takeIf { it > 0 } ?: (durationSec * 1000).toLong()
            val fileName = safeFileName(displayName) + ".mp3"
            val track = try {
                Mp3Repository.save(ctx, out, fileName, durationMs)
            } catch (e: IOException) {
                val msg = e.message.orEmpty()
                return fail(
                    if (msg.contains("ENOSPC") || msg.contains("No space", true))
                        "Not enough storage space to save the MP3. Free up some space and try again."
                    else "Could not save the MP3 to Music/${Mp3Repository.FOLDER}. ${msg.ifBlank { "" }}".trim()
                )
            } catch (e: SecurityException) {
                return fail("Storage permission is missing, so the MP3 could not be saved. Allow storage access and try again.")
            }
            post(State.Done(track, "Music/${Mp3Repository.FOLDER}/${track.fileName}"))
        } catch (e: UnsatisfiedLinkError) {
            fail("FFmpeg is not available for this device's processor type.")
        } catch (e: SecurityException) {
            fail("Permission to read the selected file was lost. Please choose the file again.")
        } catch (e: OutOfMemoryError) {
            fail("The device ran out of memory while converting.")
        } catch (e: Throwable) {
            Log.e(TAG, "Conversion crashed", e)
            fail("Conversion failed: ${e.message ?: e.javaClass.simpleName}")
        } finally {
            temp?.delete()
            sessionId = -1
        }
    }

    private fun fail(message: String, cancelled: Boolean = false) {
        post(State.Failed(message, cancelled))
    }

    private fun explainFailure(logs: String): String {
        val l = logs.lowercase()
        return when {
            "no space left" in l -> "Not enough storage space to finish the conversion. Free up some space and try again."
            "matches no streams" in l || "does not contain any stream" in l ->
                "The selected file has no audio track to convert."
            "permission denied" in l -> "The app is not allowed to read this file. Please choose it again."
            "invalid data found" in l || "could not find codec parameters" in l || "unknown format" in l || "moov atom not found" in l ->
                "This file format isn't supported, or the file is damaged/incomplete."
            "decoder" in l && "not found" in l -> "The audio codec in this file isn't supported."
            "error while decoding" in l -> "The audio in this file could not be decoded (the file may be damaged)."
            else -> "Conversion failed. The file may be damaged or in an unsupported format."
        }
    }

    private fun safeFileName(name: String): String {
        val base = name.substringBeforeLast('.', name)
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_")
            .trim().trim('.')
        return base.take(120).ifBlank { "audio_${System.currentTimeMillis()}" }
    }
}
