package app.getbullet.marcus

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.Drawable
import android.text.Layout
import android.text.Spanned
import android.text.style.LineBackgroundSpan
import android.widget.TextView
import app.getbullet.marcus.spans.MarkdownSpan
import java.lang.ref.WeakReference

/**
 * Paints the markdown backgrounds before the caret is drawn.
 *
 * A `TextView` draws its caret first and its text layout -- line backgrounds and
 * all -- over the top, so anything opaque behind the text hides the caret.
 * Android's own `BackgroundColorSpan` has the same effect; with a code block's
 * box covering the width of every line it is impossible to miss.
 *
 * The one thing a `TextView` draws earlier, and that can be handed to a view we
 * did not create, is a compound drawable: they are painted at the top of
 * `onDraw`, before the cursor and before the text. So this is a drawable of no
 * size, in the one slot React Native never uses, whose only job is to run the
 * line background spans early. They are the same spans a `Text` paints through
 * the layout -- one implementation, drawn at two different moments -- and
 * [MarkdownBackgroundPass] is what keeps them from painting twice.
 *
 * The line walk mirrors `Layout.drawBackground`, which is not public until API
 * 29 and would paint every line background rather than only ours.
 */
class MarkdownBackgroundPainter(private val pass: MarkdownBackgroundPass) : Drawable() {

  private var textView: WeakReference<TextView>? = null
  private val clip = Rect()

  /**
   * Takes the bottom compound drawable slot: `inlineImageLeft` is the only one
   * React Native sets, and it sets the left.
   */
  fun attachTo(view: TextView) {
    textView = WeakReference(view)
    setBounds(0, 0, 0, 0)
    view.compoundDrawablePadding = 0
    view.setCompoundDrawables(null, null, null, this)
  }

  override fun draw(canvas: Canvas) {
    val view = textView?.get() ?: return
    val layout = view.layout ?: return
    val text = layout.text as? Spanned ?: return

    val spans = text.getSpans(0, text.length, LineBackgroundSpan::class.java)
    if (spans.isEmpty()) {
      return
    }

    canvas.save()
    // From where a compound drawable is drawn to where the text is: the slot is
    // pinned to the view and centred in the space between the compound paddings,
    // while the layout hangs off the padding and scrolls.
    val horizontalSpace = view.width - view.compoundPaddingLeft - view.compoundPaddingRight
    canvas.translate(
      (-view.scrollX - horizontalSpace / 2).toFloat(),
      (view.totalPaddingTop - view.scrollY - view.height + view.paddingBottom).toFloat(),
    )

    pass.painting = true
    try {
      paint(canvas, layout, text, spans)
    } finally {
      pass.painting = false
      canvas.restore()
    }
  }

  private fun paint(
    canvas: Canvas,
    layout: Layout,
    text: Spanned,
    spans: Array<out LineBackgroundSpan>
  ) {
    // Only what the frame is about to show: a long document would otherwise pay
    // for every line of it on every draw.
    val firstLine: Int
    val lastLine: Int
    if (canvas.getClipBounds(clip)) {
      firstLine = layout.getLineForVertical(clip.top)
      lastLine = layout.getLineForVertical(clip.bottom)
    } else {
      firstLine = 0
      lastLine = layout.lineCount - 1
    }

    val paint = layout.paint
    val width = layout.width
    var top = layout.getLineTop(firstLine)

    for (line in firstLine..lastLine) {
      val start = layout.getLineStart(line)
      val end = layout.getLineEnd(line)
      // The next line's top rather than this line's bottom, so consecutive
      // fills tile through the line spacing exactly as the layout's own pass
      // makes them.
      val bottom = layout.getLineTop(line + 1)
      val baseline = bottom - layout.getLineDescent(line)

      for (span in spans) {
        // Ours only: anything else is still painted by the layout's own pass,
        // where it belongs, and painting it here as well would double it.
        if (span is MarkdownSpan &&
          text.getSpanStart(span) < end &&
          text.getSpanEnd(span) > start
        ) {
          span.drawBackground(
            canvas,
            paint,
            0,
            width,
            top,
            baseline,
            bottom,
            text,
            start,
            end,
            line,
          )
        }
      }

      top = bottom
    }
  }

  override fun getIntrinsicWidth(): Int = 0

  override fun getIntrinsicHeight(): Int = 0

  override fun setAlpha(alpha: Int) = Unit

  override fun setColorFilter(colorFilter: ColorFilter?) = Unit

  @Deprecated("Deprecated in Drawable", ReplaceWith("PixelFormat.TRANSLUCENT"))
  override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
