package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.LineBackgroundSpan
import androidx.annotation.ColorInt
import app.getbullet.marcus.MarkdownBackgroundPass

/**
 * The rounded box behind a run of text: a mention's pill, or an inline run of
 * code.
 *
 * Drawn a line at a time, because soft wrapping can split a run, and only the
 * sides that actually terminate it are rounded -- the break itself stays square,
 * so the two halves read as one run. iOS draws the same shape the same way, in
 * `MarkdownTextLayoutFragment` and `MarkdownParagraphLayoutManager`.
 *
 * [padding] is the room between the glyphs and the box, [margin] the room
 * between the box and the text either side of it. Both are held open
 * horizontally by the `MarkdownGapSpan`s the formatter puts on the run's first
 * and last characters, so what is left to do here is place the box's edges
 * inside the space those reserved. Vertically the box grows out of the font's
 * own box into the line's spacing, which is what an inline box does everywhere
 * else: a line cannot be pushed apart for one run on it.
 *
 * @param runStart first character of the run, for the corners and the insets
 * @param runEnd one past its last character
 * @param pass set in an input, where the view paints the backgrounds itself so
 *   that the caret stays visible; null in a `Text`, which has no caret and lets
 *   the layout paint them
 */
class MarkdownBackgroundSpan(
  @ColorInt private val backgroundColor: Int,
  private val borderRadius: Float,
  private val runStart: Int,
  private val runEnd: Int,
  private val padding: Float = 0f,
  private val margin: Float = 0f,
  private val pass: MarkdownBackgroundPass? = null
) : MarkdownSpan, LineBackgroundSpan {

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

    // The line on its own, measured as it was laid out. `drawBackground` is
    // handed the line's characters and its paint but not the layout that
    // positioned them, so where the run sits on it has to be measured again.
    val lineText = text.subSequence(start, end)
    val layout = StaticLayout.Builder
      .obtain(lineText, 0, lineText.length, paint as TextPaint, right)
      .build()

    val opens = runStart >= start
    val closes = runEnd <= end

    val startX = layout.getPrimaryHorizontal(if (opens) runStart - start else 0)
    val endX = layout.getPrimaryHorizontal(if (closes) runEnd - start else lineText.length)

    // The gap spans reserved padding and margin inside the first and last
    // characters, so the box's edge is the margin's width inside what they took.
    val metrics = paint.fontMetrics
    rect.set(
      startX + if (opens) margin else 0f,
      baseline + metrics.ascent - padding,
      endX - if (closes) margin else 0f,
      baseline + metrics.descent + padding,
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

  /** Corners of one line's rect: only the ends of the run are rounded. */
  private fun radii(roundedLeft: Boolean, roundedRight: Boolean): FloatArray {
    val radii = FloatArray(8)

    if (roundedLeft) {
      radii[1] = borderRadius // top-left
      radii[0] = radii[1]
      radii[7] = borderRadius // bottom-left
      radii[6] = radii[7]
    }

    if (roundedRight) {
      radii[3] = borderRadius // top-right
      radii[2] = radii[3]
      radii[5] = borderRadius // bottom-right
      radii[4] = radii[5]
    }

    return radii
  }
}
