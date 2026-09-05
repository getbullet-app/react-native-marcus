package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.style.ReplacementSpan
import androidx.annotation.ColorInt

/**
 * Widens the character it covers, leaving the glyph where it belongs.
 *
 * Two things need this. A container's marker holds [trailing] space after its
 * last character, so the container nested inside it can put its gutter between
 * that marker and the next one. And an inline run of code holds space on both
 * sides -- [leading] on the character it starts with, [trailing] on the one it
 * ends with -- so the box drawn behind it has room to breathe without sitting
 * over the words either side of it.
 *
 * The character is drawn here rather than by the layout, because a replacement
 * takes over its own drawing: metric spans still reach the paint, so whatever
 * font and size the character had are already in it, but its colour has to be
 * put back by hand. [color] is the colour that character should have -- a
 * marker's syntax colour, or the colour of the code it belongs to.
 *
 * [trailing] is a `var` because two things can want space after the same
 * character: the padding around a list's marker, and then the gutter of the
 * container nested inside it. Only one replacement span on a character is ever
 * asked for a width, so the second has to add to the first rather than join it.
 */
class MarkdownGapSpan(
  var trailing: Float = 0f,
  private val leading: Float = 0f,
  @ColorInt private val color: Int
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

    return (leading + paint.measureText(text, start, end) + trailing).toInt()
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
    val originalColor = paint.color
    paint.color = color
    canvas.drawText(text, start, end, x + leading, y.toFloat(), paint)
    paint.color = originalColor
  }
}
