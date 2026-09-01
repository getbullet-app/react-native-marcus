package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.style.LeadingMarginSpan
import androidx.annotation.ColorInt

/**
 * Indents one line by the containers it sits in, and draws a blockquote's
 * ribbons in the gutter reserved for them.
 *
 * One span per line rather than one per container: where a container's gutter
 * goes depends on the markers of the containers around it, so the offsets are
 * worked out together by the formatter and handed over already in pixels.
 */
class MarkdownBlockIndentSpan(
  @ColorInt private val borderColor: Int,
  private val borderWidth: Float,
  private val borderSpacing: Float
) : MarkdownSpan, LeadingMarginSpan {

  /** Where the line's text starts, and where it resumes when it wraps. */
  var firstLineIndent = 0f
  var indent = 0f

  /** Left edge of the blockquote's gutter, and how many ribbons fill it. */
  var ribbonOffset = 0f
  var depth = 0

  override fun getLeadingMargin(first: Boolean): Int {
    return (if (first) firstLineIndent else indent).toInt()
  }

  override fun drawLeadingMargin(
    c: Canvas,
    p: Paint,
    x: Int,
    dir: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence?,
    start: Int,
    end: Int,
    first: Boolean,
    layout: Layout?
  ) {
    if (depth == 0) {
      return
    }

    val originalStyle = p.style
    val originalColor = p.color

    p.style = Paint.Style.FILL
    p.color = borderColor

    for (level in 0 until depth) {
      val left = x + dir * (ribbonOffset + borderSpacing * level)
      c.drawRect(left, top.toFloat(), left + dir * borderWidth, bottom.toFloat(), p)
    }

    p.style = originalStyle
    p.color = originalColor
  }
}
