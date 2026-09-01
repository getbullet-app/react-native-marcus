package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.style.LeadingMarginSpan
import com.facebook.react.uimanager.PixelUtil

/**
 * Indents a list line by its nesting level.
 *
 * Same shape as [MarkdownBlockquoteSpan] without the gutter: nothing is drawn,
 * only the margin is reserved. Android sums the leading margins of every
 * LeadingMarginSpan on a line, so a list inside a blockquote -- or an ordered
 * list inside an unordered one -- indents by both without any extra handling.
 */
class MarkdownListSpan(
  marginLeft: Float,
  paddingLeft: Float,
  private val nestingLevel: Int
) : MarkdownSpan, LeadingMarginSpan {

  private val marginLeft: Float = PixelUtil.toPixelFromDIP(marginLeft)
  private val paddingLeft: Float = PixelUtil.toPixelFromDIP(paddingLeft)

  override fun getLeadingMargin(first: Boolean): Int {
    // The cast binds to the sum, not to the product: truncate first, then scale.
    return (marginLeft + paddingLeft).toInt() * nestingLevel
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
    // Indent only.
  }
}
