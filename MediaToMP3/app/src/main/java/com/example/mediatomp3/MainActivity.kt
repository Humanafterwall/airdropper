package com.example.mediatomp3

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.RecoverableSecurityException
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.BaseAdapter
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    companion object {
        private const val REQ_PICK = 10
        private const val REQ_DELETE = 11
        private const val REQ_PERM_CONVERT = 20
        private const val REQ_PERM_LIBRARY = 21
        private const val REQ_PERM_NOTIFY = 22
        private const val PREFS = "settings"
        private const val KEY_BITRATE = "bitrate"
        private val BITRATES = intArrayOf(128, 192, 320)
    }

    private val main = Handler(Looper.getMainLooper())

    // Tabs / pages
    private lateinit var tabConvert: TextView
    private lateinit var tabLibrary: TextView
    private lateinit var convertPage: View
    private lateinit var libraryPage: View
    private var showingLibrary = false

    // Convert page
    private lateinit var chooseButton: NeonButton
    private lateinit var fileCard: LinearLayout
    private lateinit var fileNameText: TextView
    private val bitrateChips = ArrayList<TextView>()
    private lateinit var convertButton: NeonButton
    private lateinit var progressBox: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var progressText: TextView
    private lateinit var resultCard: LinearLayout
    private lateinit var resultText: TextView
    private lateinit var errorText: TextView

    // Library page
    private lateinit var listView: ListView
    private lateinit var emptyText: TextView
    private val adapter = TrackAdapter()
    private var tracks: List<Track> = emptyList()
    private var pendingDelete: Track? = null

    // Player bar
    private lateinit var playerBar: LinearLayout
    private lateinit var playerTitle: TextView
    private lateinit var seekBar: SeekBar
    private lateinit var timeNow: TextView
    private lateinit var timeTotal: TextView
    private lateinit var playPauseBtn: ImageView
    private var userSeeking = false

    private val conversionListener: (ConversionManager.State) -> Unit = { renderConversion(it) }
    private val playerListener: () -> Unit = { renderPlayer() }
    private val ticker = object : Runnable {
        override fun run() {
            renderProgress()
            main.postDelayed(this, 500)
        }
    }

    // ------------------------------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        ConversionManager.bitrateKbps = getSharedPreferences(PREFS, MODE_PRIVATE).getInt(KEY_BITRATE, 192)
            .takeIf { it in BITRATES } ?: 192
        setContentView(buildUi())
        showPage(library = false)
        handleShareIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        ConversionManager.addListener(conversionListener)
        PlayerHub.addListener(playerListener)
        renderSelection()
        renderConversion(ConversionManager.state)
        renderPlayer()
        if (showingLibrary) refreshLibrary()
        main.post(ticker)
    }

    override fun onStop() {
        ConversionManager.removeListener(conversionListener)
        PlayerHub.removeListener(playerListener)
        main.removeCallbacks(ticker)
        super.onStop()
    }

    @Suppress("DEPRECATION")
    private fun enableEdgeToEdge() {
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
    }

    // ------------------------------------------------------------------------------------------
    // UI construction
    // ------------------------------------------------------------------------------------------

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Neon.BG)
        }
        @Suppress("DEPRECATION")
        root.setOnApplyWindowInsetsListener { v, insets ->
            val (l, t, r, b) = if (Build.VERSION.SDK_INT >= 30) {
                val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                listOf(i.left, i.top, i.right, i.bottom)
            } else {
                listOf(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            v.setPadding(l, t, r, b)
            insets
        }

        // Header
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(20), dp(24), dp(8))
        }
        header.addView(text("MEDIA → MP3", 34f, Neon.GREEN, Neon.bold).apply {
            letterSpacing = 0.08f
            setShadowLayer(dp(14).toFloat(), 0f, 0f, Neon.GREEN)
        })
        header.addView(text("Convert media you own or are authorized to use.", 14f, Neon.TEXT_DIM).apply {
            setPadding(0, dp(4), 0, 0)
        })
        root.addView(header, lp())

        // Tabs
        val tabs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(20), dp(10), dp(20), dp(6))
        }
        tabConvert = tab("CONVERT") { showPage(library = false) }
        tabLibrary = tab("MY MP3s") { showPage(library = true) }
        tabs.addView(tabConvert, lp(0, dp(44), 1f).margins(r = dp(6)))
        tabs.addView(tabLibrary, lp(0, dp(44), 1f).margins(l = dp(6)))
        root.addView(tabs, lp())

        // Pages
        val pages = FrameLayout(this)
        convertPage = buildConvertPage()
        libraryPage = buildLibraryPage()
        pages.addView(convertPage, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        pages.addView(libraryPage, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(pages, lp(h = 0, weight = 1f))

        // Player
        root.addView(buildPlayerBar(), lp().margins(dp(12), dp(4), dp(12), dp(12)))
        return root
    }

    private fun tab(label: String, onClick: () -> Unit) = text(label, 14f, Neon.TEXT_DIM, Neon.bold).apply {
        gravity = Gravity.CENTER
        letterSpacing = 0.1f
        isClickable = true
        setOnClickListener { onClick() }
    }

    private fun styleTab(t: TextView, active: Boolean) {
        val r = dp(14).toFloat()
        t.background = ripple(
            if (active) rounded(0x1A39FF14, r, dp(1.5), Neon.GREEN) else rounded(Neon.SURFACE, r, dp(1), Neon.OUTLINE), r
        )
        t.setTextColor(if (active) Neon.GREEN else Neon.TEXT_DIM)
    }

    private fun buildConvertPage(): View {
        val scroll = ScrollView(this).apply { isFillViewport = true; overScrollMode = View.OVER_SCROLL_NEVER }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(14), dp(20), dp(20))
        }
        scroll.addView(col)

        chooseButton = NeonButton(this, "CHOOSE MEDIA FILE", filled = false, heightDp = 84).apply {
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 20f)
            setOnClickListener { pickFile() }
        }
        col.addView(chooseButton, lp())

        // Selected file card
        fileCard = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            background = rounded(Neon.SURFACE, dp(14).toFloat(), dp(1), Neon.OUTLINE)
        }
        fileCard.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_file)
            imageTintList = ColorStateList.valueOf(Neon.GREEN)
        }, LinearLayout.LayoutParams(dp(26), dp(26)))
        fileNameText = text("", 15f, Neon.TEXT).apply {
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.MIDDLE
            setPadding(dp(12), 0, 0, 0)
        }
        fileCard.addView(fileNameText, lp(0, weight = 1f))
        col.addView(fileCard, lp().margins(t = dp(14)))

        // Bitrate
        col.addView(text("BITRATE", 13f, Neon.TEXT_DIM, Neon.bold).apply { letterSpacing = 0.15f }, lp().margins(t = dp(26), b = dp(10)))
        val chips = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        BITRATES.forEachIndexed { i, kbps ->
            val chip = text("$kbps kbps", 15f, Neon.TEXT_DIM, Neon.bold).apply {
                gravity = Gravity.CENTER
                tag = kbps
                isClickable = true
                setOnClickListener { selectBitrate(kbps) }
            }
            bitrateChips += chip
            chips.addView(chip, lp(0, dp(48), 1f).margins(l = if (i == 0) 0 else dp(5), r = if (i == BITRATES.lastIndex) 0 else dp(5)))
        }
        col.addView(chips, lp())
        renderBitrate()

        // Convert
        convertButton = NeonButton(this, "CONVERT TO MP3", filled = true, heightDp = 68).apply {
            setOnClickListener { onConvertClicked() }
        }
        col.addView(convertButton, lp().margins(t = dp(30)))

        // Progress
        progressBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
            progressTintList = ColorStateList.valueOf(Neon.GREEN)
            progressBackgroundTintList = ColorStateList.valueOf(Neon.OUTLINE)
            indeterminateTintList = ColorStateList.valueOf(Neon.GREEN)
        }
        progressBox.addView(progressBar, lp(h = dp(10)).margins(t = dp(16)))
        val progRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        progressText = text("", 14f, Neon.GREEN, Neon.mono)
        progRow.addView(progressText, lp(0, weight = 1f))
        progRow.addView(text("CANCEL", 13f, Neon.ERROR, Neon.bold).apply {
            letterSpacing = 0.12f
            setPadding(dp(14), dp(8), dp(14), dp(8))
            val r = dp(10).toFloat()
            background = ripple(rounded(Color.TRANSPARENT, r, dp(1), Neon.ERROR), r, 0x44FF4D6D)
            setOnClickListener { ConversionManager.cancel() }
        }, lp(ViewGroup.LayoutParams.WRAP_CONTENT))
        progressBox.addView(progRow, lp().margins(t = dp(8)))
        col.addView(progressBox, lp())

        // Result
        resultCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(16))
            background = rounded(0x1239FF14, dp(14).toFloat(), dp(1), Neon.GREEN_DIM)
        }
        resultText = text("", 14f, Neon.TEXT)
        resultCard.addView(resultText, lp())
        val resultActions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        resultActions.addView(NeonButton(this, "▶  PLAY", filled = false, heightDp = 46).apply {
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14f)
            setOnClickListener {
                (ConversionManager.state as? ConversionManager.State.Done)?.let { playTrack(it.track) }
            }
        }, lp(0, weight = 1f).margins(r = dp(6)))
        resultActions.addView(NeonButton(this, "MY MP3s", filled = false, heightDp = 46).apply {
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14f)
            setOnClickListener { showPage(library = true) }
        }, lp(0, weight = 1f).margins(l = dp(6)))
        resultCard.addView(resultActions, lp().margins(t = dp(12)))
        col.addView(resultCard, lp().margins(t = dp(16)))

        // Error
        errorText = text("", 14f, Neon.ERROR).apply {
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = rounded(0x14FF4D6D, dp(12).toFloat(), dp(1), 0x88FF4D6D.toInt())
        }
        col.addView(errorText, lp().margins(t = dp(16)))

        col.addView(text("Supported: MP4, MKV, MOV, AVI, WEBM, M4A, WAV, AAC, FLAC, OGG, MP3 and more.\nSaved to Music/MediaToMP3 on your phone.", 12f, Neon.TEXT_DIM).apply {
            gravity = Gravity.CENTER
        }, lp().margins(t = dp(28)))
        return scroll
    }

    private fun buildLibraryPage(): View {
        val frame = FrameLayout(this)
        listView = ListView(this).apply {
            divider = null
            dividerHeight = 0
            selector = rounded(Color.TRANSPARENT, 0f)
            setPadding(dp(16), dp(8), dp(16), dp(8))
            clipToPadding = false
            adapter = this@MainActivity.adapter
            setOnItemClickListener { _, _, pos, _ -> tracks.getOrNull(pos)?.let { playTrack(it) } }
        }
        frame.addView(listView)
        emptyText = text("No MP3s yet.\nConvert a file and it will show up here.", 15f, Neon.TEXT_DIM).apply {
            gravity = Gravity.CENTER
        }
        frame.addView(emptyText, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return frame
    }

    private fun buildPlayerBar(): View {
        playerBar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = rounded(Neon.SURFACE, dp(18).toFloat(), dp(1.5), Neon.GREEN_DIM)
            elevation = dp(8).toFloat()
        }
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        top.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_music)
            imageTintList = ColorStateList.valueOf(Neon.GREEN)
        }, LinearLayout.LayoutParams(dp(22), dp(22)))
        playerTitle = text("", 15f, Neon.TEXT, Neon.bold).apply {
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.MARQUEE
            marqueeRepeatLimit = -1
            isSelected = true
            setHorizontallyScrolling(true)
            setPadding(dp(10), 0, dp(8), 0)
        }
        top.addView(playerTitle, lp(0, weight = 1f))
        playPauseBtn = iconButton(R.drawable.ic_play, 46).apply { setOnClickListener { PlayerHub.togglePlayPause(this@MainActivity) } }
        top.addView(playPauseBtn)
        top.addView(iconButton(R.drawable.ic_stop, 46).apply {
            (layoutParams as LinearLayout.LayoutParams).leftMargin = dp(8)
            setOnClickListener { PlayerHub.stop() }
        })
        playerBar.addView(top, lp())

        seekBar = SeekBar(this).apply {
            max = 1000
            progressTintList = ColorStateList.valueOf(Neon.GREEN)
            thumbTintList = ColorStateList.valueOf(Neon.GREEN)
            progressBackgroundTintList = ColorStateList.valueOf(Neon.OUTLINE)
            setPadding(dp(4), dp(10), dp(4), dp(6))
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) {
                    if (fromUser) timeNow.text = formatTime(PlayerHub.durationMs * p / 1000)
                }
                override fun onStartTrackingTouch(sb: SeekBar) { userSeeking = true }
                override fun onStopTrackingTouch(sb: SeekBar) {
                    userSeeking = false
                    PlayerHub.seekTo(PlayerHub.durationMs * sb.progress / 1000)
                }
            })
        }
        playerBar.addView(seekBar, lp())
        val times = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(4), 0, dp(4), 0) }
        timeNow = text("0:00", 12f, Neon.GREEN, Neon.mono)
        timeTotal = text("0:00", 12f, Neon.TEXT_DIM, Neon.mono).apply { gravity = Gravity.END }
        times.addView(timeNow, lp(0, weight = 1f))
        times.addView(timeTotal, lp(0, weight = 1f))
        playerBar.addView(times, lp())
        return playerBar
    }

    // ------------------------------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------------------------------

    private fun showPage(library: Boolean) {
        showingLibrary = library
        convertPage.visible(!library)
        libraryPage.visible(library)
        styleTab(tabConvert, !library)
        styleTab(tabLibrary, library)
        if (library) {
            ensureLibraryPermission()
            refreshLibrary()
        }
    }

    private fun renderBitrate() {
        val r = dp(12).toFloat()
        bitrateChips.forEach { chip ->
            val active = chip.tag == ConversionManager.bitrateKbps
            chip.background = ripple(
                if (active) rounded(Neon.GREEN, r) else rounded(Neon.SURFACE, r, dp(1), Neon.OUTLINE), r
            )
            chip.setTextColor(if (active) Neon.BG else Neon.TEXT_DIM)
        }
    }

    private fun renderSelection() {
        val name = ConversionManager.selectedName
        fileCard.visible(name != null)
        fileNameText.text = name ?: ""
        chooseButton.setLabel(if (name == null) "CHOOSE MEDIA FILE" else "CHOOSE ANOTHER FILE")
    }

    private fun renderConversion(state: ConversionManager.State) {
        val hasFile = ConversionManager.selectedUri != null
        chooseButton.isEnabled = state !is ConversionManager.State.Converting
        bitrateChips.forEach { it.isEnabled = state !is ConversionManager.State.Converting }
        progressBox.visible(state is ConversionManager.State.Converting)
        resultCard.visible(state is ConversionManager.State.Done)
        errorText.visible(state is ConversionManager.State.Failed)
        when (state) {
            is ConversionManager.State.Idle -> {
                convertButton.setLabel("CONVERT TO MP3")
                convertButton.isEnabled = hasFile
            }
            is ConversionManager.State.Converting -> {
                convertButton.setLabel("CONVERTING…")
                convertButton.isEnabled = false
                if (state.progress < 0f) {
                    progressBar.isIndeterminate = true
                    progressText.text = "Preparing…"
                } else {
                    progressBar.isIndeterminate = false
                    progressBar.progress = (state.progress * 1000).toInt()
                    progressText.text = "${(state.progress * 100).toInt()}%"
                }
            }
            is ConversionManager.State.Done -> {
                convertButton.setLabel("DONE ✓")
                convertButton.isEnabled = false
                resultText.text = "Saved to:\n${state.location}"
                if (showingLibrary) refreshLibrary()
            }
            is ConversionManager.State.Failed -> {
                convertButton.setLabel("CONVERT TO MP3")
                convertButton.isEnabled = hasFile
                errorText.setTextColor(if (state.cancelled) Neon.TEXT_DIM else Neon.ERROR)
                errorText.text = state.message
            }
        }
    }

    private fun renderPlayer() {
        val t = PlayerHub.track
        playerBar.visible(t != null)
        if (t == null) return
        if (playerTitle.text.toString() != t.title) playerTitle.text = t.title
        playPauseBtn.setImageResource(if (PlayerHub.isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
        timeTotal.text = formatTime(PlayerHub.durationMs)
        renderProgress()
        PlayerHub.lastError?.let {
            PlayerHub.lastError = null
            Toast.makeText(this, it, Toast.LENGTH_LONG).show()
        }
        adapter.notifyDataSetChanged()
    }

    private fun renderProgress() {
        if (PlayerHub.track == null || userSeeking) return
        val dur = PlayerHub.durationMs
        val pos = PlayerHub.positionMs
        seekBar.progress = if (dur > 0) (pos * 1000 / dur).toInt() else 0
        timeNow.text = formatTime(pos)
    }

    // ------------------------------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------------------------------

    private fun pickFile() {
        if (ConversionManager.isBusy) return
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("video/*", "audio/*", "application/ogg", "application/x-matroska"))
        }
        try {
            startActivityForResult(intent, REQ_PICK)
        } catch (e: Exception) {
            // Fallback for devices without the Storage Access Framework picker.
            try {
                startActivityForResult(Intent(Intent.ACTION_GET_CONTENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE), REQ_PICK)
            } catch (e2: Exception) {
                toast("No file picker is available on this device.")
            }
        }
    }

    private fun onPicked(uri: Uri) {
        ConversionManager.selectedUri = uri
        ConversionManager.selectedName = queryName(uri)
        ConversionManager.reset()
        renderSelection()
        renderConversion(ConversionManager.state)
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        @Suppress("DEPRECATION")
        val uri = (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else intent.getParcelableExtra(Intent.EXTRA_STREAM)) ?: return
        if (ConversionManager.isBusy) { toast("Please wait for the current conversion to finish."); return }
        showPage(library = false)
        onPicked(uri)
    }

    private fun queryName(uri: Uri): String {
        runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0)?.let { return it }
            }
        }
        return uri.lastPathSegment?.substringAfterLast('/') ?: "media"
    }

    private fun selectBitrate(kbps: Int) {
        if (ConversionManager.isBusy) return
        ConversionManager.bitrateKbps = kbps
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putInt(KEY_BITRATE, kbps).apply()
        renderBitrate()
        if (ConversionManager.state is ConversionManager.State.Done) {
            ConversionManager.reset()
        }
    }

    private fun onConvertClicked() {
        if (ConversionManager.selectedUri == null || ConversionManager.isBusy) return
        // Android 8/9: writing to the shared Music folder needs the legacy storage permission.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), REQ_PERM_CONVERT)
            return
        }
        askNotificationPermissionOnce()
        ConversionManager.start(this)
    }

    private fun playTrack(t: Track) {
        askNotificationPermissionOnce()
        PlayerHub.play(this, t)
        PlayerHub.track = t
        PlayerHub.durationMs = t.durationMs
        renderPlayer()
    }

    private fun confirmDelete(t: Track) {
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Delete MP3?")
            .setMessage("\"${t.fileName}\" will be permanently deleted from your phone.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Delete") { _, _ -> deleteTrack(t) }
            .show()
    }

    private fun deleteTrack(t: Track) {
        if (PlayerHub.track?.uri == t.uri) {
            PlayerHub.stop()
            PlayerHub.track = null
            renderPlayer()
        }
        try {
            if (Mp3Repository.delete(this, t)) {
                toast("Deleted ${t.fileName}")
            } else {
                toast("The file was already removed.")
            }
            refreshLibrary()
        } catch (e: SecurityException) {
            // File created by a previous install: ask the user through the system dialog.
            try {
                pendingDelete = t
                when {
                    Build.VERSION.SDK_INT >= 30 -> {
                        val pi = MediaStore.createDeleteRequest(contentResolver, listOf(t.uri))
                        startIntentSenderForResult(pi.intentSender, REQ_DELETE, null, 0, 0, 0)
                    }
                    Build.VERSION.SDK_INT == 29 && e is RecoverableSecurityException -> {
                        startIntentSenderForResult(e.userAction.actionIntent.intentSender, REQ_DELETE, null, 0, 0, 0)
                    }
                    else -> toast("Permission denied: the file can't be deleted.")
                }
            } catch (e2: Exception) {
                toast("The file could not be deleted.")
            }
        } catch (e: Exception) {
            toast("The file could not be deleted: ${e.message}")
        }
    }

    private fun refreshLibrary() {
        Thread {
            val list = Mp3Repository.list(applicationContext)
            main.post {
                tracks = list
                adapter.notifyDataSetChanged()
                emptyText.visible(list.isEmpty())
            }
        }.start()
    }

    private fun ensureLibraryPermission() {
        // Own files are always visible. Reading files left by an earlier install needs this permission.
        val perm = when {
            Build.VERSION.SDK_INT >= 33 -> Manifest.permission.READ_MEDIA_AUDIO
            else -> Manifest.permission.READ_EXTERNAL_STORAGE
        }
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        if (checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED && !prefs.getBoolean("asked_library", false)) {
            prefs.edit().putBoolean("asked_library", true).apply()
            requestPermissions(arrayOf(perm), REQ_PERM_LIBRARY)
        }
    }

    private fun askNotificationPermissionOnce() {
        if (Build.VERSION.SDK_INT < 33) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        if (prefs.getBoolean("asked_notify", false)) return
        prefs.edit().putBoolean("asked_notify", true).apply()
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_PERM_NOTIFY)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_PICK -> {
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null) onPicked(uri)
            }
            REQ_DELETE -> {
                val t = pendingDelete
                pendingDelete = null
                if (resultCode == RESULT_OK && t != null) {
                    // API 30+: already deleted by the system. API 29: permission granted, delete now.
                    if (Build.VERSION.SDK_INT == 29) runCatching { Mp3Repository.delete(this, t) }
                    toast("Deleted ${t.fileName}")
                }
                refreshLibrary()
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        when (requestCode) {
            REQ_PERM_CONVERT -> if (granted) ConversionManager.start(this)
            else toast("Storage permission is needed to save MP3s in the Music folder.")
            REQ_PERM_LIBRARY -> refreshLibrary()
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    // ------------------------------------------------------------------------------------------
    // MY MP3s list
    // ------------------------------------------------------------------------------------------

    private inner class TrackAdapter : BaseAdapter() {
        override fun getCount() = tracks.size
        override fun getItem(position: Int) = tracks[position]
        override fun getItemId(position: Int) = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val holder = (convertView?.tag as? RowHolder) ?: RowHolder()
            holder.bind(tracks[position])
            return holder.root
        }
    }

    private inner class RowHolder {
        val root = FrameLayout(this@MainActivity).apply {
            setPadding(0, dp(5), 0, dp(5))
            layoutParams = android.widget.AbsListView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        private val card = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(12), dp(10), dp(12))
        }
        private val texts = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL }
        private val title = text("", 15f, Neon.TEXT, Neon.bold).apply { maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        private val meta = text("", 12f, Neon.TEXT_DIM, Neon.mono)
        private val play = iconButton(R.drawable.ic_play, 42)
        private val delete = iconButton(R.drawable.ic_delete, 42, tint = Neon.ERROR, outlined = false)
        private var track: Track? = null

        init {
            texts.addView(title)
            texts.addView(meta, lp().margins(t = dp(3)))
            card.addView(texts, lp(0, weight = 1f).margins(r = dp(8)))
            card.addView(play)
            card.addView(delete.apply { (layoutParams as LinearLayout.LayoutParams).leftMargin = dp(6) })
            root.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            root.tag = this
            play.setOnClickListener {
                val t = track ?: return@setOnClickListener
                if (PlayerHub.track?.uri == t.uri && PlayerHub.service != null) PlayerHub.togglePlayPause(this@MainActivity)
                else playTrack(t)
            }
            delete.setOnClickListener { track?.let { confirmDelete(it) } }
        }

        fun bind(t: Track) {
            track = t
            title.text = t.title
            val duration = if (t.durationMs > 0) formatTime(t.durationMs) else "--:--"
            meta.text = "$duration  ·  ${formatSize(t.sizeBytes)}"
            val current = PlayerHub.track?.uri == t.uri
            val playingThis = current && PlayerHub.isPlaying
            play.setImageResource(if (playingThis) R.drawable.ic_pause else R.drawable.ic_play)
            title.setTextColor(if (current) Neon.GREEN else Neon.TEXT)
            val r = dp(14).toFloat()
            card.background = if (current) rounded(0x1439FF14, r, dp(1), Neon.GREEN_DIM) else rounded(Neon.SURFACE, r, dp(1), Neon.OUTLINE)
        }
    }
}
