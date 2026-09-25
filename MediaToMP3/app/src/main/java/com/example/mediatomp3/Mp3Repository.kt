package com.example.mediatomp3

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.IOException

/**
 * Stores and lists MP3s in the shared "Music/MediaToMP3/" folder.
 *
 * Android 10+ : MediaStore with RELATIVE_PATH (scoped storage, no permission needed for own files).
 * Android 8-9 : the public Music directory (WRITE_EXTERNAL_STORAGE, maxSdkVersion=28).
 */
object Mp3Repository {

    const val FOLDER = "MediaToMP3"
    val RELATIVE_PATH = "${Environment.DIRECTORY_MUSIC}/$FOLDER/"

    private fun legacyDir(): File =
        File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), FOLDER)

    private val scoped get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    /** Copies [source] into Music/MediaToMP3 as [fileName] and returns the saved track. */
    @Throws(IOException::class)
    fun save(context: Context, source: File, fileName: String, durationMs: Long): Track {
        return if (scoped) saveScoped(context, source, fileName, durationMs) else saveLegacy(context, source, fileName, durationMs)
    }

    private fun saveScoped(context: Context, source: File, fileName: String, durationMs: Long): Track {
        val resolver = context.contentResolver
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "audio/mpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, RELATIVE_PATH)
            put(MediaStore.Audio.Media.IS_MUSIC, 1)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values)
            ?: throw IOException("Could not create the MP3 file in Music/$FOLDER.")
        try {
            val out = resolver.openOutputStream(uri) ?: throw IOException("Could not open the MP3 file for writing.")
            out.use { o -> source.inputStream().use { it.copyTo(o, 64 * 1024) } }
            val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
            resolver.update(uri, done, null, null)
        } catch (e: Exception) {
            runCatching { resolver.delete(uri, null, null) }
            throw if (e is IOException) e else IOException(e.message, e)
        }
        // MediaStore may have renamed the file (e.g. "song (1).mp3") to avoid a clash.
        var savedName = fileName
        resolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) savedName = c.getString(0) ?: fileName
        }
        return Track(uri, savedName.removeSuffix(".mp3"), savedName, durationMs, source.length())
    }

    private fun saveLegacy(context: Context, source: File, fileName: String, durationMs: Long): Track {
        val dir = legacyDir()
        if (!dir.exists() && !dir.mkdirs()) throw IOException("Could not create the folder Music/$FOLDER.")
        var target = File(dir, fileName)
        val base = fileName.removeSuffix(".mp3")
        var n = 1
        while (target.exists()) target = File(dir, "$base (${n++}).mp3")
        try {
            source.inputStream().use { i -> target.outputStream().use { i.copyTo(it, 64 * 1024) } }
        } catch (e: IOException) {
            target.delete()
            throw e
        }
        MediaScannerConnection.scanFile(context, arrayOf(target.absolutePath), arrayOf("audio/mpeg"), null)
        return Track(Uri.fromFile(target), target.nameWithoutExtension, target.name, durationMs, target.length())
    }

    /** Lists the MP3s in Music/MediaToMP3, newest first. Never throws. */
    fun list(context: Context): List<Track> = try {
        if (scoped) listScoped(context) else listLegacy()
    } catch (e: Exception) {
        emptyList()
    }

    private fun listScoped(context: Context): List<Track> {
        val result = ArrayList<Track>()
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
        )
        val rp = MediaStore.MediaColumns.RELATIVE_PATH
        val selection = "($rp = ? OR $rp = ?) AND ${MediaStore.MediaColumns.DISPLAY_NAME} LIKE ?"
        val args = arrayOf(RELATIVE_PATH, RELATIVE_PATH.removeSuffix("/"), "%.mp3")
        context.contentResolver.query(
            collection, projection, selection, args, "${MediaStore.MediaColumns.DATE_ADDED} DESC"
        )?.use { c ->
            while (c.moveToNext()) {
                val id = c.getLong(0)
                val name = c.getString(1) ?: continue
                val uri = ContentUris.withAppendedId(collection, id)
                var duration = c.getLong(2)
                if (duration <= 0) duration = probeDuration(context, uri)
                result += Track(uri, name.removeSuffix(".mp3"), name, duration, c.getLong(3))
            }
        }
        return result
    }

    private fun listLegacy(): List<Track> {
        val files = legacyDir().listFiles { f -> f.isFile && f.name.endsWith(".mp3", ignoreCase = true) } ?: return emptyList()
        return files.sortedByDescending { it.lastModified() }.map { f ->
            Track(Uri.fromFile(f), f.nameWithoutExtension, f.name, probeDuration(f), f.length())
        }
    }

    /**
     * Deletes [track]. On Android 10+ this throws [SecurityException] when the file was created by an
     * earlier install of the app; the caller then asks the user for confirmation via MediaStore.
     */
    fun delete(context: Context, track: Track): Boolean {
        return if (track.uri.scheme == "file") {
            val path = track.uri.path ?: return false
            val ok = File(path).delete()
            if (ok) MediaScannerConnection.scanFile(context, arrayOf(path), null, null)
            ok
        } else {
            context.contentResolver.delete(track.uri, null, null) > 0
        }
    }

    fun probeDuration(context: Context, uri: Uri): Long = runCatching {
        val r = MediaMetadataRetriever()
        try {
            r.setDataSource(context, uri)
            r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        } finally {
            r.release()
        }
    }.getOrDefault(0L)

    fun probeDuration(file: File): Long = runCatching {
        val r = MediaMetadataRetriever()
        try {
            r.setDataSource(file.absolutePath)
            r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        } finally {
            r.release()
        }
    }.getOrDefault(0L)

    /** Free space (bytes) where the final MP3 is written. */
    fun freeSpaceForMusic(): Long = runCatching {
        Environment.getExternalStorageDirectory().usableSpace
    }.getOrDefault(Long.MAX_VALUE)
}
