package app.getbullet.marcus

import android.content.Context
import androidx.annotation.ColorInt
import com.facebook.react.bridge.ColorPropConverter
import com.facebook.react.bridge.JSApplicationCausedNativeException
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

class MarkdownStyle(map: ReadableMap, context: Context) {
  private val screenDensity = context.resources.displayMetrics.density

  @ColorInt val syntaxColor = parseColor(map, "syntax", "color", context)
  @ColorInt val linkColor = parseColor(map, "link", "color", context)

  val h1FontSize = parseFloat(map, "h1", "fontSize")

  val emojiFontSize = parseFloat(map, "emoji", "fontSize")
  val emojiFontFamily = parseString(map, "emoji", "fontFamily")

  @ColorInt val blockquoteBorderColor = parseColor(map, "blockquote", "borderColor", context)
  val blockquoteBorderWidth = parseFloat(map, "blockquote", "borderWidth")
  val blockquoteMarginLeft = parseFloat(map, "blockquote", "marginLeft")
  val blockquotePaddingLeft = parseFloat(map, "blockquote", "paddingLeft")

  val codeFontFamily = parseString(map, "code", "fontFamily")
  val codeFontSize = parseFloat(map, "code", "fontSize")
  @ColorInt val codeColor = parseColor(map, "code", "color", context)
  @ColorInt val codeBackgroundColor = parseColor(map, "code", "backgroundColor", context)

  val preFontFamily = parseString(map, "pre", "fontFamily")
  val preFontSize = parseFloat(map, "pre", "fontSize")
  @ColorInt val preColor = parseColor(map, "pre", "color", context)
  @ColorInt val preBackgroundColor = parseColor(map, "pre", "backgroundColor", context)

  @ColorInt val mentionHereColor = parseColor(map, "mentionHere", "color", context)
  @ColorInt val mentionHereBackgroundColor = parseColor(map, "mentionHere", "backgroundColor", context)
  val mentionHereBorderRadius = parseFloat(map, "mentionHere", "borderRadius") * screenDensity

  @ColorInt val mentionUserColor = parseColor(map, "mentionUser", "color", context)
  @ColorInt val mentionUserBackgroundColor = parseColor(map, "mentionUser", "backgroundColor", context)
  val mentionUserBorderRadius = parseFloat(map, "mentionUser", "borderRadius") * screenDensity

  @ColorInt val mentionReportColor = parseColor(map, "mentionReport", "color", context)
  @ColorInt val mentionReportBackgroundColor = parseColor(map, "mentionReport", "backgroundColor", context)
  val mentionReportBorderRadius = parseFloat(map, "mentionReport", "borderRadius") * screenDensity

  private companion object {
    fun style(map: ReadableMap, key: String): ReadableMap =
      requireNotNull(map.getMap(key)) { "[react-native-marcus] markdownStyle.$key is missing" }

    @ColorInt
    fun parseColor(map: ReadableMap, key: String, prop: String, context: Context): Int {
      val value = style(map, key).getDynamic(prop)
      val color = when (value.type) {
        ReadableType.Number -> ColorPropConverter.getColor(value.asDouble(), context)
        ReadableType.Map -> ColorPropConverter.getColor(value.asMap(), context)
        else -> throw JSApplicationCausedNativeException("ColorValue: the value must be a number or Object.")
      }
      return requireNotNull(color) {
        "[react-native-marcus] markdownStyle.$key.$prop could not be resolved to a color"
      }
    }

    fun parseFloat(map: ReadableMap, key: String, prop: String): Float =
      style(map, key).getDouble(prop).toFloat()

    fun parseString(map: ReadableMap, key: String, prop: String): String =
      requireNotNull(style(map, key).getString(prop)) {
        "[react-native-marcus] markdownStyle.$key.$prop is missing"
      }
  }
}
