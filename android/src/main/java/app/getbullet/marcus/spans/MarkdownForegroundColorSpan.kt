package app.getbullet.marcus.spans

import android.text.style.ForegroundColorSpan
import androidx.annotation.ColorInt

class MarkdownForegroundColorSpan(@ColorInt color: Int) : ForegroundColorSpan(color), MarkdownSpan
