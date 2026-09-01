package app.getbullet.marcus

import android.content.res.AssetManager
import android.os.Trace
import android.text.SpannableStringBuilder
import android.text.Spanned
import app.getbullet.marcus.spans.MarkdownBackgroundColorSpan
import app.getbullet.marcus.spans.MarkdownBackgroundSpan
import app.getbullet.marcus.spans.MarkdownBlockquoteSpan
import app.getbullet.marcus.spans.MarkdownBoldSpan
import app.getbullet.marcus.spans.MarkdownFontFamilySpan
import app.getbullet.marcus.spans.MarkdownFontSizeSpan
import app.getbullet.marcus.spans.MarkdownForegroundColorSpan
import app.getbullet.marcus.spans.MarkdownItalicSpan
import app.getbullet.marcus.spans.MarkdownLineHeightSpan
import app.getbullet.marcus.spans.MarkdownListSpan
import app.getbullet.marcus.spans.MarkdownSpan
import app.getbullet.marcus.spans.MarkdownStrikethroughSpan
import app.getbullet.marcus.spans.MarkdownUnderlineSpan

class MarkdownFormatter(private val assetManager: AssetManager) {

  fun format(
    ssb: SpannableStringBuilder,
    markdownRanges: List<MarkdownRange>,
    markdownStyle: MarkdownStyle
  ) {
    try {
      Trace.beginSection("format")
      removeSpans(ssb)
      applyRanges(ssb, markdownRanges, markdownStyle)
    } finally {
      Trace.endSection()
    }
  }

  private fun removeSpans(ssb: SpannableStringBuilder) {
    try {
      Trace.beginSection("removeSpans")
      // We shouldn't use `removeSpans()` because it also removes SpellcheckSpan, SuggestionSpan etc.
      for (span in ssb.getSpans(0, ssb.length, MarkdownSpan::class.java)) {
        ssb.removeSpan(span)
      }
    } finally {
      Trace.endSection()
    }
  }

  private fun applyRanges(
    ssb: SpannableStringBuilder,
    markdownRanges: List<MarkdownRange>,
    markdownStyle: MarkdownStyle
  ) {
    try {
      Trace.beginSection("applyRanges")
      for (markdownRange in markdownRanges) {
        applyRange(ssb, markdownRange, markdownStyle)
      }
    } finally {
      Trace.endSection()
    }
  }

  private fun applyRange(
    ssb: SpannableStringBuilder,
    markdownRange: MarkdownRange,
    markdownStyle: MarkdownStyle
  ) {
    val start = markdownRange.start
    val end = markdownRange.end
    when (markdownRange.type) {
      "bold" -> setSpan(ssb, MarkdownBoldSpan(), start, end)

      "italic" -> setSpan(ssb, MarkdownItalicSpan(), start, end)

      "strikethrough" -> setSpan(ssb, MarkdownStrikethroughSpan(), start, end)

      "emoji" -> {
        setSpan(
          ssb,
          MarkdownFontFamilySpan(markdownStyle.emojiFontFamily, assetManager),
          start,
          end
        )
        setSpan(ssb, MarkdownFontSizeSpan(markdownStyle.emojiFontSize), start, end)
      }

      "mention-here" -> {
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.mentionHereColor), start, end)
        setSpan(
          ssb,
          MarkdownBackgroundSpan(
            markdownStyle.mentionHereBackgroundColor,
            markdownStyle.mentionHereBorderRadius,
            start,
            end
          ),
          start,
          end
        )
      }

      "mention-user" -> {
        // TODO: change mention color when it mentions current user
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.mentionUserColor), start, end)
        setSpan(
          ssb,
          MarkdownBackgroundSpan(
            markdownStyle.mentionUserBackgroundColor,
            markdownStyle.mentionUserBorderRadius,
            start,
            end
          ),
          start,
          end
        )
      }

      "mention-report" -> {
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.mentionReportColor), start, end)
        setSpan(
          ssb,
          MarkdownBackgroundSpan(
            markdownStyle.mentionReportBackgroundColor,
            markdownStyle.mentionReportBorderRadius,
            start,
            end
          ),
          start,
          end
        )
      }

      "syntax" -> setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.syntaxColor), start, end)

      "link" -> {
        setSpan(ssb, MarkdownUnderlineSpan(), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.linkColor), start, end)
      }

      "code" -> {
        setSpan(ssb, MarkdownFontFamilySpan(markdownStyle.codeFontFamily, assetManager), start, end)
        setSpan(ssb, MarkdownFontSizeSpan(markdownStyle.codeFontSize), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.codeColor), start, end)
        setSpan(ssb, MarkdownBackgroundColorSpan(markdownStyle.codeBackgroundColor), start, end)
      }

      "pre" -> {
        setSpan(ssb, MarkdownFontFamilySpan(markdownStyle.preFontFamily, assetManager), start, end)
        setSpan(ssb, MarkdownFontSizeSpan(markdownStyle.preFontSize), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.preColor), start, end)
        setSpan(ssb, MarkdownBackgroundColorSpan(markdownStyle.preBackgroundColor), start, end)
      }

      "heading" -> {
        setSpan(ssb, MarkdownBoldSpan(), start, end)
        // Level N is the base size scaled N-1 times, so a single pair of style
        // values covers all six.
        var fontSize = markdownStyle.headingFontSize
        repeat(maxOf(markdownRange.depth, 1) - 1) { fontSize *= markdownStyle.headingScale }
        val lineHeight = ReactLineHeight.find(ssb)
        if (lineHeight >= 0) {
          setSpan(ssb, MarkdownLineHeightSpan(lineHeight * (fontSize / markdownStyle.headingFontSize) * 1.5f), start, end)
        }
        // NOTE: size span must be set after line height span to avoid height jumps
        setSpan(ssb, MarkdownFontSizeSpan(fontSize), start, end)
      }

      "list-ordered" -> setSpan(
        ssb,
        MarkdownListSpan(
          markdownStyle.orderedListMarginLeft,
          markdownStyle.orderedListPaddingLeft,
          markdownRange.depth
        ),
        start,
        end
      )

      "list-unordered" -> setSpan(
        ssb,
        MarkdownListSpan(
          markdownStyle.unorderedListMarginLeft,
          markdownStyle.unorderedListPaddingLeft,
          markdownRange.depth
        ),
        start,
        end
      )

      "blockquote" -> setSpan(
        ssb,
        MarkdownBlockquoteSpan(
          markdownStyle.blockquoteBorderColor,
          markdownStyle.blockquoteBorderWidth,
          markdownStyle.blockquoteMarginLeft,
          markdownStyle.blockquotePaddingLeft,
          markdownRange.depth
        ),
        start,
        end
      )
    }
  }

  private fun setSpan(ssb: SpannableStringBuilder, span: MarkdownSpan, start: Int, end: Int) {
    ssb.setSpan(span, start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  }
}
