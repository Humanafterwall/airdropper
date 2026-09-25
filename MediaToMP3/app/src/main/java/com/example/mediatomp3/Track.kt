package com.example.mediatomp3

import android.net.Uri

/** One MP3 in Music/MediaToMP3. */
data class Track(
    val uri: Uri,
    val title: String,
    val fileName: String,
    val durationMs: Long,
    val sizeBytes: Long,
)

fun formatTime(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSec = ms / 1000
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
}

fun formatSize(bytes: Long): String = when {
    bytes >= 1024L * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
    bytes >= 1024 -> String.format("%d KB", bytes / 1024)
    else -> "$bytes B"
}
