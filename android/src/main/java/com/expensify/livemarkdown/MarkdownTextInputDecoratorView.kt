package com.expensify.livemarkdown

import android.content.Context
import android.text.SpannableStringBuilder
import android.text.TextWatcher
import com.facebook.react.bridge.ReactContext
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.view.ReactViewGroup

class MarkdownTextInputDecoratorView(context: Context) : ReactViewGroup(context) {

  private var markdownUtils: MarkdownUtils? = null
  private var reactEditText: ReactEditText? = null
  private var textWatcher: TextWatcher? = null

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
      val utils = MarkdownUtils(context as ReactContext)
      utils.markdownStyle = markdownStyle
      utils.parserId = parserId
      markdownUtils = utils
      reactEditText = child
      textWatcher = MarkdownTextWatcher(utils).also { child.addTextChangedListener(it) }
      applyNewStyles()
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    reactEditText?.let { editText ->
      textWatcher?.let { editText.removeTextChangedListener(it) }
      reactEditText = null
      textWatcher = null
      markdownUtils = null
    }
  }

  fun applyNewStyles() {
    val editText = reactEditText ?: return
    val utils = markdownUtils ?: return
    val editable = editText.text
    if (editable is SpannableStringBuilder) {
      utils.applyMarkdownFormatting(editable)
    }
  }
}
