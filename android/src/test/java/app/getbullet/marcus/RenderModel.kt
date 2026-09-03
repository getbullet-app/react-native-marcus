package app.getbullet.marcus

import android.graphics.Color
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LeadingMarginSpan
import app.getbullet.marcus.spans.MarkdownBackgroundSpan
import app.getbullet.marcus.spans.MarkdownBoldSpan
import app.getbullet.marcus.spans.MarkdownFontFamilySpan
import app.getbullet.marcus.spans.MarkdownGapSpan
import app.getbullet.marcus.spans.MarkdownItalicSpan
import app.getbullet.marcus.spans.MarkdownLineHeightSpan
import app.getbullet.marcus.spans.MarkdownStrikethroughSpan
import app.getbullet.marcus.spans.MarkdownUnderlineSpan

/**
 * Serializes the spans a formatted string carries into the shared render model.
 *
 * One line per span, `start..end  attribute`, sorted so the output does not
 * depend on the order the formatter happened to apply things in. The attribute
 * vocabulary is deliberately platform neutral -- `bold`, `color(#RRGGBB)`,
 * `indent(first,rest)` -- so an Android dump and an iOS dump of the same case
 * can be diffed against each other directly.
 *
 * Only public API is read. Making span fields visible purely so a test could
 * assert on them would be the test changing the thing it measures.
 */
object RenderModel {

  fun dump(text: CharSequence, spanned: Spanned): String {
    val lines = spanned.getSpans(0, spanned.length, Any::class.java)
      .mapNotNull { span ->
        val attribute = describe(span) ?: return@mapNotNull null
        val start = spanned.getSpanStart(span)
        val end = spanned.getSpanEnd(span)
        Triple(start, end, attribute)
      }
      .sortedWith(compareBy({ it.first }, { -it.second }, { it.third }))
      .map { (start, end, attribute) ->
        "%4d..%-4d %s".format(start, end, attribute)
      }

    if (lines.isEmpty()) {
      return "(no spans)"
    }

    return lines.joinToString("\n")
  }

  /** The shared attribute name for a span, or null for spans we do not model. */
  private fun describe(span: Any): String? = when (span) {
    is MarkdownBoldSpan -> "bold"
    is MarkdownItalicSpan -> "italic"
    is MarkdownStrikethroughSpan -> "strikethrough"
    is MarkdownUnderlineSpan -> "underline"
    is MarkdownFontFamilySpan -> "font-family"
    is MarkdownLineHeightSpan -> "line-height"
    // The rounded rectangle drawn behind a mention, not a plain background
    // colour -- iOS models the same thing as `MarkdownTextBackground`.
    is MarkdownBackgroundSpan -> "background-shape"
    // The space held open after a marker so the next container's gutter lands
    // between the two.
    is MarkdownGapSpan -> "gap"
    is ForegroundColorSpan -> "color(${hex(span.foregroundColor)})"
    is BackgroundColorSpan -> "background(${hex(span.backgroundColor)})"
    is AbsoluteSizeSpan -> "font-size(${span.size})"
    is LeadingMarginSpan ->
      "indent(${span.getLeadingMargin(true)},${span.getLeadingMargin(false)})"
    // Anything still unnamed is flagged rather than dropped: a span the model
    // has no word for is exactly what a reviewer needs to see.
    else -> "?${span.javaClass.simpleName.removePrefix("Markdown").removeSuffix("Span")}"
  }

  private fun hex(color: Int): String =
    "#%02X%02X%02X".format(Color.red(color), Color.green(color), Color.blue(color))
}
