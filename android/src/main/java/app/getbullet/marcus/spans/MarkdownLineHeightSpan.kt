package app.getbullet.marcus.spans

import android.graphics.Paint
import android.text.style.LineHeightSpan

class MarkdownLineHeightSpan(private val lineHeight: Float) : MarkdownSpan, LineHeightSpan {
  override fun chooseHeight(
    text: CharSequence?,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt
  ) {
    // Java's `fm.top -= this.lineHeight / 4` performs the subtraction in float and
    // narrows the result, so the truncation has to happen after the subtraction.
    // Truncating the quotient first would shift the value by up to one pixel.
    fm.top = (fm.top - this.lineHeight / 4).toInt()
    fm.ascent = (fm.ascent - this.lineHeight / 4).toInt()
  }
}
