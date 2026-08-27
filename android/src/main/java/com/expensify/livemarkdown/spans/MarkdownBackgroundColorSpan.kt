package com.expensify.livemarkdown.spans

import android.text.style.BackgroundColorSpan
import androidx.annotation.ColorInt

class MarkdownBackgroundColorSpan(@ColorInt color: Int) : BackgroundColorSpan(color), MarkdownSpan
