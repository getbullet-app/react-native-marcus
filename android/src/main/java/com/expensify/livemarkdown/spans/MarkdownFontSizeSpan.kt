package com.expensify.livemarkdown.spans

import android.text.style.AbsoluteSizeSpan
import com.facebook.react.uimanager.PixelUtil

class MarkdownFontSizeSpan(fontSize: Float) :
  AbsoluteSizeSpan(PixelUtil.toPixelFromDIP(fontSize).toInt(), false), MarkdownSpan
