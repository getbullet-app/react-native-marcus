package app.getbullet.marcus

import android.content.Context
import android.text.SpannableStringBuilder
import android.text.TextWatcher
import com.facebook.react.bridge.ReactContext
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.view.ReactViewGroup

/**
 * Formats the editable of the `TextInput` it wraps, and paints the backgrounds
 * that would otherwise cover the caret.
 */
class MarcusTextInputDecoratorView(context: Context) : ReactViewGroup(context) {

  private var markdownUtils: MarkdownUtils? = null
  private var reactEditText: ReactEditText? = null
  private var textWatcher: TextWatcher? = null

  /**
   * Paints the markdown backgrounds before the text does, so that the caret --
   * which Android draws before either -- is not covered by them.
   */
  private val backgroundPass = MarkdownBackgroundPass()
  private val backgroundPainter = MarkdownBackgroundPainter(backgroundPass)

  var markdownStyle: MarkdownStyle? = null
    set(value) {
      field = value
      markdownUtils?.markdownStyle = value
      applyNewStyles()
    }

  var parserId: Int = 0
    set(value) {
      field = value
      markdownUtils?.parserId = value
      applyNewStyles()
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()

    val child = getChildAt(0)
    if (child is ReactEditText) {
      val utils = MarkdownUtils(context as ReactContext, child.paint, backgroundPass)
      utils.markdownStyle = markdownStyle
      utils.parserId = parserId
      markdownUtils = utils
      reactEditText = child
      textWatcher = MarkdownTextWatcher(utils).also { child.addTextChangedListener(it) }
      backgroundPainter.attachTo(child)
      applyNewStyles()
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    reactEditText?.let { editText ->
      textWatcher?.let { editText.removeTextChangedListener(it) }
      editText.setCompoundDrawables(null, null, null, null)
      reactEditText = null
      textWatcher = null
      markdownUtils = null
    }
  }

  fun applyNewStyles() {
    val editText = reactEditText ?: return
    val utils = markdownUtils ?: return

    // Puts the painter back if something else took the compound drawable slot it
    // lives in. Only `inlineImageLeft` does, and it clears all four; checked here
    // rather than per frame, where asking for it would cost a layout pass every
    // time something wrapped our drawable rather than replacing it.
    if (editText.compoundDrawables[3] == null) {
      backgroundPainter.attachTo(editText)
    }

    val editable = editText.text
    if (editable is SpannableStringBuilder) {
      utils.applyMarkdownFormatting(editable)
    }
  }
}
