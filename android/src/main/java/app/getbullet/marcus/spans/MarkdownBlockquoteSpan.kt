package app.getbullet.marcus.spans

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.style.LeadingMarginSpan
import androidx.annotation.ColorInt
import com.facebook.react.uimanager.PixelUtil

class MarkdownBlockquoteSpan(
  @ColorInt private val borderColor: Int,
  borderWidth: Float,
  marginLeft: Float,
  paddingLeft: Float,
  private val nestingLevel: Int
) : MarkdownSpan, LeadingMarginSpan {

  private val borderWidth: Float = PixelUtil.toPixelFromDIP(borderWidth)
  private val marginLeft: Float = PixelUtil.toPixelFromDIP(marginLeft)
  private val paddingLeft: Float = PixelUtil.toPixelFromDIP(paddingLeft)

  override fun getLeadingMargin(first: Boolean): Int {
    // The cast binds to the sum, not to the product: truncate first, then scale.
    return (marginLeft + borderWidth + paddingLeft).toInt() * nestingLevel
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
    val originalStyle = p.style
    val originalColor = p.color

    p.style = Paint.Style.FILL
    p.color = borderColor

    for (level in 0 until nestingLevel) {
      val shift = (marginLeft + borderWidth + paddingLeft) * level
      val left = x + dir * (marginLeft + shift)
      val right = x + dir * (marginLeft + borderWidth + shift)
      c.drawRect(left, top.toFloat(), right, bottom.toFloat(), p)
    }

    p.style = originalStyle
    p.color = originalColor
  }
}
