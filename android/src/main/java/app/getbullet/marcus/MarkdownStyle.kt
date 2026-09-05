package app.getbullet.marcus

import android.content.Context
import androidx.annotation.ColorInt
import com.facebook.react.bridge.ColorPropConverter
import com.facebook.react.bridge.JSApplicationCausedNativeException
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

class MarkdownStyle(map: ReadableMap, context: Context) {
  @ColorInt val syntaxColor = parseColor(map, "syntax", "color", context)
  @ColorInt val linkColor = parseColor(map, "link", "color", context)

  val headingFontSize = parseFloat(map, "heading", "fontSize")

  val headingScale = parseFloat(map, "heading", "scale")

  val emojiFontSize = parseFloat(map, "emoji", "fontSize")
  val emojiFontFamily = parseString(map, "emoji", "fontFamily")

  @ColorInt val blockquoteBorderColor = parseColor(map, "blockquote", "borderColor", context)
  val blockquoteBorderWidth = parseFloat(map, "blockquote", "borderWidth")
  val blockquoteMarginLeft = parseFloat(map, "blockquote", "marginLeft")
  val blockquotePaddingLeft = parseFloat(map, "blockquote", "paddingLeft")

  val orderedListMarginLeft = parseFloat(map, "orderedList", "marginLeft")
  val orderedListPaddingLeft = parseFloat(map, "orderedList", "paddingLeft")
  val orderedListMarkerScale = parseFloat(map, "orderedList", "markerScale")
  val orderedListMarkerPadding = parseFloat(map, "orderedList", "markerPadding")

  val unorderedListMarginLeft = parseFloat(map, "unorderedList", "marginLeft")
  val unorderedListPaddingLeft = parseFloat(map, "unorderedList", "paddingLeft")
  val unorderedListMarkerScale = parseFloat(map, "unorderedList", "markerScale")
  val unorderedListMarkerPadding = parseFloat(map, "unorderedList", "markerPadding")

  val codeFontFamily = parseString(map, "code", "fontFamily")
  val codeFontSize = parseFloat(map, "code", "fontSize")
  @ColorInt val codeColor = parseColor(map, "code", "color", context)
  @ColorInt val codeBackgroundColor = parseColor(map, "code", "backgroundColor", context)
  val codeBorderRadius = parseFloat(map, "code", "borderRadius")
  val codePadding = parseFloat(map, "code", "padding")
  val codeMargin = parseFloat(map, "code", "margin")

  val preFontFamily = parseString(map, "pre", "fontFamily")
  val preFontSize = parseFloat(map, "pre", "fontSize")
  @ColorInt val preColor = parseColor(map, "pre", "color", context)
  @ColorInt val preBackgroundColor = parseColor(map, "pre", "backgroundColor", context)
  val preBorderRadius = parseFloat(map, "pre", "borderRadius")
  val prePadding = parseFloat(map, "pre", "padding")
  val preMargin = parseFloat(map, "pre", "margin")

  // Lengths in dp, as `code`'s are: what draws them converts, so a value means
  // the same thing wherever it is read.
  @ColorInt val mentionColor = parseColor(map, "mention", "color", context)
  @ColorInt val mentionBackgroundColor = parseColor(map, "mention", "backgroundColor", context)
  val mentionBorderRadius = parseFloat(map, "mention", "borderRadius")
  val mentionPadding = parseFloat(map, "mention", "padding")
  val mentionMargin = parseFloat(map, "mention", "margin")

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
