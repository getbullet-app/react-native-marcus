package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.style.ReplacementSpan
import androidx.annotation.ColorInt

/**
 * The bullet drawn in place of an unordered item's marker.
 *
 * The marker character stays in the string -- it is what a reader copies and
 * what TalkBack announces -- and this takes over drawing it, which is what a
 * `ReplacementSpan` is for: the circle is drawn in the advance the glyph would
 * have taken, and the glyph itself never reaches the canvas.
 *
 * [diameter] comes from the base font size rather than from a length of its own,
 * so a list marks itself in proportion to the prose it marks. The circle is
 * centred on the line's own height rather than sat on the baseline, because a
 * bullet marks the line rather than being a letter on it -- iOS draws it from
 * the same two numbers in `MarkdownParagraphLayoutManager`.
 *
 * @param box the advance to report, which is the diameter as a whole pixel: the
 *   formatter indents the text past exactly this, so the two have to agree.
 */
class MarkdownBulletSpan(
  @ColorInt private val color: Int,
  private val diameter: Float,
  private val box: Int
) : ReplacementSpan(), MarkdownSpan {

  /**
   * Room held open after the bullet, for the padding around a marker and for a
   * nested container's gutter.
   *
   * Carried here rather than by a `MarkdownGapSpan` of its own because two
   * replacement spans cannot share a character: an item written with nothing
   * after its marker has no other character to put one on.
   */
  var trailing = 0f

  override fun getSize(
    paint: Paint,
    text: CharSequence,
    start: Int,
    end: Int,
    fm: Paint.FontMetricsInt?
  ): Int {
    // The line keeps the height the text gives it: the circle is drawn inside
    // what the line already is, never by pushing it open.
    if (fm != null) {
      val metrics = paint.fontMetricsInt
      fm.top = metrics.top
      fm.ascent = metrics.ascent
      fm.descent = metrics.descent
      fm.bottom = metrics.bottom
      fm.leading = metrics.leading
    }

    return box + trailing.toInt()
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
    canvas.drawCircle(x + box / 2f, (top + bottom) / 2f, diameter / 2f, paint)
    paint.color = originalColor
  }
}
