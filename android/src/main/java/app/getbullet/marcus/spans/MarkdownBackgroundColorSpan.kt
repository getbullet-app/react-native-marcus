package app.getbullet.marcus.spans

import android.text.style.BackgroundColorSpan
import androidx.annotation.ColorInt

class MarkdownBackgroundColorSpan(@ColorInt color: Int) : BackgroundColorSpan(color), MarkdownSpan
