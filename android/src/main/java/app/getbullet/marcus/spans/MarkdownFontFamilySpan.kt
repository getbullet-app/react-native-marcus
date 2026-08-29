package app.getbullet.marcus.spans

import android.content.res.AssetManager
import android.graphics.Paint
import android.text.TextPaint
import android.text.style.MetricAffectingSpan
import com.facebook.react.common.assets.ReactFontManager

class MarkdownFontFamilySpan(
  private val fontFamily: String,
  private val assetManager: AssetManager
) : MetricAffectingSpan(), MarkdownSpan {

  override fun updateMeasureState(textPaint: TextPaint) {
    apply(textPaint)
  }

  override fun updateDrawState(tp: TextPaint) {
    apply(tp)
  }

  private fun apply(textPaint: TextPaint) {
    val style = textPaint.typeface?.style ?: ReactFontManager.TypefaceStyle.NORMAL
    val typeface = ReactFontManager.getInstance().getTypeface(fontFamily, style, assetManager)
    textPaint.typeface = typeface
    textPaint.flags = textPaint.flags or Paint.SUBPIXEL_TEXT_FLAG
  }
}
