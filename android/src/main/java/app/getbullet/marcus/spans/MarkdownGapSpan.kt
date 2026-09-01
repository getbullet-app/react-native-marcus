package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.style.ReplacementSpan
import androidx.annotation.ColorInt

/**
 * Widens the character it covers by [gap] pixels, leaving the glyph where it is.
 *
 * Applied to the last character of a container's marker so that the container
 * nested inside it can put its gutter between that marker and the next one.
 */
class MarkdownGapSpan(
  private val gap: Float,
  @ColorInt private val syntaxColor: Int
) : ReplacementSpan(), MarkdownSpan {

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    if (fm != null) {
      val metrics = paint.fontMetricsInt
      fm.top = metrics.top
      fm.ascent = metrics.ascent
      fm.descent = metrics.descent
      fm.bottom = metrics.bottom
      fm.leading = metrics.leading
    }

    return (paint.measureText(text, start, end) + gap).toInt()
  }

  override fun draw(
    canvas: Canvas,
    text: CharSequence,
    start: Int,
    end: Int,
    x: Float,
    top: Int,
    y: Int,
    bottom: Int,
    paint: Paint
  ) {
    // Spans inside a replacement are not applied, so the one colour a marker's
    // last character can have is restored by hand. It is whitespace whenever the
    // marker is followed by any, and a syntax character otherwise.
    val originalColor = paint.color
    paint.color = syntaxColor
    canvas.drawText(text, start, end, x, y.toFloat(), paint)
    paint.color = originalColor
  }
}
