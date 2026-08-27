package com.expensify.livemarkdown

import android.text.Editable
import android.text.SpannableStringBuilder
import android.text.TextWatcher

class MarkdownTextWatcher(private val markdownUtils: MarkdownUtils) : TextWatcher {
  override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

  override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

  override fun afterTextChanged(editable: Editable) {
    if (editable is SpannableStringBuilder) {
      markdownUtils.applyMarkdownFormatting(editable)
    }
  }
}
