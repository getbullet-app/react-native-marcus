package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.LineBackgroundSpan
import androidx.annotation.ColorInt

class MarkdownBackgroundSpan(
  @ColorInt private val backgroundColor: Int,
  private val borderRadius: Float,
  private val mentionStart: Int,
  private val mentionEnd: Int
) : MarkdownSpan, LineBackgroundSpan {

  private var layout: StaticLayout? = null
  private val backgroundPath = Path()

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
    val lineText = text.subSequence(start, end)
    val cachedLayout = layout
    // `!==` on purpose: the Java this replaces compared the layout's text by
    // reference, not by value.
    if (cachedLayout == null ||
      cachedLayout.text !== lineText ||
      cachedLayout.width != right ||
      cachedLayout.getLineEnd(0) != lineText.length
    ) {
      val currentLineStart = 0
      val currentLineEnd = lineText.length
      // Create layout for the current line only
      val newLayout = StaticLayout.Builder
        .obtain(lineText, currentLineStart, currentLineEnd, paint as TextPaint, right)
        .build()
      layout = newLayout

      val relativeMentionStart = mentionStart - start
      val relativeMentionEnd = mentionEnd - start

      val mentionStartsInCurrentLine = currentLineStart <= relativeMentionStart
      val mentionEndsInCurrentLine = currentLineEnd >= relativeMentionEnd

      val startX = newLayout.getPrimaryHorizontal(
        if (mentionStartsInCurrentLine) relativeMentionStart else currentLineStart
      )
      val endX = newLayout.getPrimaryHorizontal(
        if (mentionEndsInCurrentLine) relativeMentionEnd else currentLineEnd
      )

      val fm = paint.getFontMetrics()
      val startY = baseline + fm.ascent
      val endY = baseline + fm.descent

      val lineRect = RectF(startX, startY, endX, endY)
      backgroundPath.reset()
      backgroundPath.addRoundRect(
        lineRect,
        createRadii(mentionStartsInCurrentLine, mentionEndsInCurrentLine),
        Path.Direction.CW
      )
    }

    val originalColor = paint.color
    paint.color = backgroundColor

    canvas.drawPath(backgroundPath, paint)

    paint.color = originalColor
  }

  private fun createRadii(roundedLeft: Boolean, roundedRight: Boolean): FloatArray {
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
