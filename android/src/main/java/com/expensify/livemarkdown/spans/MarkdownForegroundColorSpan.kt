package com.expensify.livemarkdown.spans

import android.text.style.ForegroundColorSpan
import androidx.annotation.ColorInt

class MarkdownForegroundColorSpan(@ColorInt color: Int) : ForegroundColorSpan(color), MarkdownSpan
