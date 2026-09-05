package app.getbullet.marcus

import android.content.Context
import android.text.SpannableStringBuilder
import android.view.ViewTreeObserver
import android.widget.TextView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.ReactCompoundViewGroup
import com.facebook.react.views.text.ReactTextView
import com.facebook.react.views.view.ReactViewGroup

/**
 * Formats the spannable of the `Text` it wraps.
 *
 * Android splits text in two: the measure pass runs on the background thread through the
 * `TextLayoutManager` the shadow node was given, and the mount pass builds a second spannable on
 * the UI thread from the same fragments. `MarcusTextDecoratorShadowNode` covers the first; this
 * covers the second, because the callback React Native offers there
 * (`ReactTextViewManagerCallback`) belongs to the view manager and is therefore shared by every
 * `Text` in the app, with no way to tell one instance's markdown from another's.
 *
 * Formatting is driven from a pre-draw listener rather than a text watcher: attaching a
 * `TextWatcher` to a `TextView` makes it copy its text into an `Editable`, which would throw away
 * the spannable React Native is holding. The listener is cheap -- `MarkdownUtils` stamps what it
 * formatted onto the spannable, so all a quiet frame costs is reading one span -- and returning
 * false on the frame that did format keeps a partly styled frame from ever being drawn.
 */
class MarcusTextDecoratorView(context: Context) : ReactViewGroup(context), ReactCompoundViewGroup {

  private var markdownUtils: MarkdownUtils? = null

  private val preDrawListener = ViewTreeObserver.OnPreDrawListener { applyMarkdown() }

  var markdownStyle: MarkdownStyle? = null
    set(value) {
      field = value
      markdownUtils?.markdownStyle = value
    }

  var ranges: List<MarkdownRange> = emptyList()
    set(value) {
      field = value
      markdownUtils?.ranges = value
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()

    val child = getChildAt(0)
    if (child is ReactTextView) {
      markdownUtils =
        MarkdownUtils(context as ReactContext, child.paint, display = true).also {
          it.markdownStyle = markdownStyle
          it.ranges = ranges
        }
    }

    viewTreeObserver.addOnPreDrawListener(preDrawListener)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(preDrawListener)
    markdownUtils = null

    super.onDetachedFromWindow()
  }

  /**
   * Answers for the `Text` below, so that a press is measured from where the text is drawn.
   *
   * `ReactTextView.reactTagForTouch` reads the touch straight off the layout without taking the
   * view's padding off it first, so a `Text` with any padding at all looks up the character that
   * many pixels down and to the right of the one under the finger. With 8dp of padding and a 19dp
   * line that is the bottom of every line pressing the line below it, which is most of what makes
   * a link feel like it has to be aimed at. Claiming the touch here is the only way to correct
   * the coordinates: the child is asked first otherwise, and by then they are already wrong.
   */
  override fun interceptsTouchEvent(touchX: Float, touchY: Float): Boolean =
    getChildAt(0) is ReactTextView

  override fun reactTagForTouch(touchX: Float, touchY: Float): Int {
    val child = getChildAt(0) as? ReactTextView ?: return id

    // Nothing lands on the tag of a view that has no press to report, so a miss falling back to
    // the text's own tag is the same as no target at all.
    return child.reactTagForTouch(
      touchX - child.left - child.totalPaddingLeft,
      touchY - child.top - child.totalPaddingTop,
    )
  }

  /** False when the frame was formatted, so it is drawn again rather than half styled. */
  private fun applyMarkdown(): Boolean {
    val child = getChildAt(0) as? ReactTextView ?: return true
    val utils = markdownUtils ?: return true
    if (utils.markdownStyle == null) {
      return true
    }

    // The spannable React Native built for this commit. The view's own text is a copy of it --
    // `TextView` freezes what it is given -- so the formatted result has to be set back below.
    val spannable = child.spanned as? SpannableStringBuilder ?: return true

    if (!utils.applyMarkdownFormatting(spannable)) {
      return true
    }

    child.setText(spannable, TextView.BufferType.SPANNABLE)
    return false
  }
}
