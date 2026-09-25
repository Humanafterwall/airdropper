package com.example.mediatomp3

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** Dark / neon design tokens and small view factories (plain Android views, no XML layouts). */
object Neon {
    const val BG = 0xFF090909.toInt()
    const val SURFACE = 0xFF121212.toInt()
    const val SURFACE_2 = 0xFF1A1A1A.toInt()
    const val OUTLINE = 0xFF2A2A2A.toInt()
    const val GREEN = 0xFF39FF14.toInt()
    const val GREEN_DIM = 0xFF1C7A0A.toInt()
    const val GREEN_GLOW = 0x5539FF14
    const val TEXT = 0xFFEDEDED.toInt()
    const val TEXT_DIM = 0xFF8C8C8C.toInt()
    const val ERROR = 0xFFFF4D6D.toInt()

    val bold: Typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
    val medium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    val mono: Typeface = Typeface.MONOSPACE
}

fun Context.dp(v: Number): Int = TypedValue.applyDimension(
    TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics
).toInt()

fun rounded(fill: Int, radiusPx: Float, strokePx: Int = 0, strokeColor: Int = Color.TRANSPARENT) =
    GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = radiusPx
        setColor(fill)
        if (strokePx > 0) setStroke(strokePx, strokeColor)
    }

fun ripple(content: Drawable, radiusPx: Float, color: Int = Neon.GREEN_GLOW): Drawable =
    RippleDrawable(ColorStateList.valueOf(color), content, rounded(Color.WHITE, radiusPx))

fun Context.text(
    value: CharSequence = "",
    sizeSp: Float = 15f,
    color: Int = Neon.TEXT,
    face: Typeface = Neon.medium,
): TextView = TextView(this).apply {
    text = value
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    setTextColor(color)
    typeface = face
}

/** Big neon button. [filled] = solid green with black text, otherwise green outline. */
class NeonButton(context: Context, label: String, private val filled: Boolean, private val heightDp: Int = 64) :
    TextView(context) {

    private val r = context.dp(18).toFloat()

    init {
        text = label
        gravity = Gravity.CENTER
        typeface = Neon.bold
        letterSpacing = 0.12f
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        minHeight = context.dp(heightDp)
        setPadding(context.dp(20), context.dp(12), context.dp(20), context.dp(12))
        isClickable = true
        isFocusable = true
        applyStyle(true)
    }

    override fun setEnabled(enabled: Boolean) {
        super.setEnabled(enabled)
        applyStyle(enabled)
    }

    fun setLabel(label: String) { text = label }

    private fun applyStyle(enabled: Boolean) {
        val stroke = context.dp(2)
        if (filled) {
            val fill = if (enabled) Neon.GREEN else Neon.GREEN_DIM
            background = ripple(rounded(fill, r), r, 0x55000000)
            setTextColor(if (enabled) Neon.BG else 0xFF0E2A07.toInt())
            setShadowLayer(0f, 0f, 0f, 0)
            elevation = if (enabled) context.dp(6).toFloat() else 0f
            if (android.os.Build.VERSION.SDK_INT >= 28) {
                outlineAmbientShadowColor = Neon.GREEN
                outlineSpotShadowColor = Neon.GREEN
            }
        } else {
            val color = if (enabled) Neon.GREEN else Neon.GREEN_DIM
            background = ripple(rounded(Neon.SURFACE, r, stroke, color), r)
            setTextColor(color)
            setShadowLayer(if (enabled) context.dp(8).toFloat() else 0f, 0f, 0f, Neon.GREEN_GLOW)
        }
    }
}

fun Context.iconButton(resId: Int, sizeDp: Int = 44, tint: Int = Neon.GREEN, outlined: Boolean = true): ImageView =
    ImageView(this).apply {
        setImageResource(resId)
        imageTintList = ColorStateList.valueOf(tint)
        val pad = dp(sizeDp / 4.5)
        setPadding(pad, pad, pad, pad)
        val r = dp(sizeDp / 2).toFloat()
        background = ripple(
            if (outlined) rounded(Neon.SURFACE_2, r, dp(1.5), tint) else rounded(Color.TRANSPARENT, r), r
        )
        isClickable = true
        isFocusable = true
        layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    }

fun lp(w: Int = ViewGroup.LayoutParams.MATCH_PARENT, h: Int = ViewGroup.LayoutParams.WRAP_CONTENT, weight: Float = 0f) =
    LinearLayout.LayoutParams(w, h, weight)

fun LinearLayout.LayoutParams.margins(l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0) = apply { setMargins(l, t, r, b) }

fun View.visible(show: Boolean) { visibility = if (show) View.VISIBLE else View.GONE }
