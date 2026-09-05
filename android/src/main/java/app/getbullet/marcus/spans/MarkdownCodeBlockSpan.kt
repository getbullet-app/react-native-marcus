package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.text.style.LineBackgroundSpan
import android.text.style.LineHeightSpan
import androidx.annotation.ColorInt
import app.getbullet.marcus.MarkdownBackgroundPass

/**
 * The box behind a fenced or indented code block: one fill for the whole block,
 * from its first line to its last.
 *
 * A background colour would follow the glyphs -- leaving the line spacing above
 * and below each line unpainted, and stopping wherever the code happens to end
 * -- so the fill is drawn per line here instead, across the width the line was
 * laid out in. Two lines' rects abut on whole pixels, so what they read as is
 * one box. iOS draws the same shape from the same numbers in
 * `MarkdownTextLayoutFragment` and `MarkdownParagraphLayoutManager`.
 *
 * The vertical padding and margin are held open by the same span: [chooseHeight]
 * grows the first line upwards and the last line downwards, so the box has room
 * to breathe without overlapping the lines around it. The left ones are indent,
 * which is `MarkdownBlockIndentSpan`'s job -- one authority for how far a line
 * starts in. Nothing is reserved on the right: a paragraph cannot be given a
 * trailing indent, so a line long enough to wrap reaches the padding there.
 *
 * @param leftInset where the box's left edge sits, from the line's own left edge
 * @param blockStart first character of the block, for the corners and the space
 * @param blockEnd one past its last character
 * @param pass set in an input, where the view paints the backgrounds itself so
 *   that the caret stays visible; null in a `Text`, which has no caret and lets
 *   the layout paint them
 */
class MarkdownCodeBlockSpan(
  @ColorInt private val backgroundColor: Int,
  private val borderRadius: Float,
  private val padding: Float,
  private val margin: Float,
  private val leftInset: Float,
  private val blockStart: Int,
  private val blockEnd: Int,
  private val pass: MarkdownBackgroundPass? = null
) : MarkdownSpan, LineBackgroundSpan, LineHeightSpan {

  private val rect = RectF()
  private val path = Path()

  override fun drawBackground(
    canvas: Canvas,
    paint: Paint,
    left: Int,
    right: Int,
    top: Int,
    baseline: Int,
    bottom: Int,
    text: CharSequence,
    start: Int,
    end: Int,
    lnum: Int
  ) {
    if (pass != null && !pass.painting) {
      return
    }

    val opens = start <= blockStart
    val closes = end >= blockEnd

    rect.set(
      left + leftInset,
      top + if (opens) margin else 0f,
      right - margin,
      bottom - if (closes) margin else 0f,
    )

    if (rect.width() <= 0f || rect.height() <= 0f) {
      return
    }

    path.reset()
    path.addRoundRect(rect, radii(opens, closes), Path.Direction.CW)

    val originalColor = paint.color
    paint.color = backgroundColor
    canvas.drawPath(path, paint)
    paint.color = originalColor
  }

  /**
   * Room above the block's first line and below its last, for the padding
   * inside the box and the margin outside it.
   *
   * Called for every line the span covers, so the two ends are picked out by
   * where the line falls in the block rather than by the span's own extent.
   */
  override fun chooseHeight(
    text: CharSequence?,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt
  ) {
    val inset = (padding + margin).toInt()

    if (start <= blockStart) {
      fm.top -= inset
      fm.ascent -= inset
    }
    if (end >= blockEnd) {
      fm.descent += inset
      fm.bottom += inset
    }
  }

  /** Corners of one line's rect: only the ends of the block are rounded. */
  private fun radii(roundedTop: Boolean, roundedBottom: Boolean): FloatArray {
    val radii = FloatArray(8)

    if (roundedTop) {
      radii[1] = borderRadius // top-left
      radii[0] = radii[1]
      radii[3] = borderRadius // top-right
      radii[2] = radii[3]
    }

    if (roundedBottom) {
      radii[5] = borderRadius // bottom-right
      radii[4] = radii[5]
      radii[7] = borderRadius // bottom-left
      radii[6] = radii[7]
    }

    return radii
  }
}
