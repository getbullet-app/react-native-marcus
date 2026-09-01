package app.getbullet.marcus

import android.content.res.AssetManager
import android.os.Trace
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.style.MetricAffectingSpan
import app.getbullet.marcus.spans.MarkdownBackgroundColorSpan
import app.getbullet.marcus.spans.MarkdownBackgroundSpan
import app.getbullet.marcus.spans.MarkdownBlockIndentSpan
import app.getbullet.marcus.spans.MarkdownBoldSpan
import app.getbullet.marcus.spans.MarkdownFontFamilySpan
import app.getbullet.marcus.spans.MarkdownFontSizeSpan
import app.getbullet.marcus.spans.MarkdownForegroundColorSpan
import app.getbullet.marcus.spans.MarkdownGapSpan
import app.getbullet.marcus.spans.MarkdownItalicSpan
import app.getbullet.marcus.spans.MarkdownLineHeightSpan
import app.getbullet.marcus.spans.MarkdownSpan
import app.getbullet.marcus.spans.MarkdownStrikethroughSpan
import app.getbullet.marcus.spans.MarkdownUnderlineSpan
import com.facebook.react.uimanager.PixelUtil

class MarkdownFormatter(private val assetManager: AssetManager) {

  fun format(
    ssb: SpannableStringBuilder,
    markdownRanges: List<MarkdownRange>,
    markdownStyle: MarkdownStyle,
    textPaint: TextPaint?
  ) {
    try {
      Trace.beginSection("format")
      removeSpans(ssb)
      applyRanges(ssb, markdownRanges, markdownStyle, textPaint)
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
    markdownStyle: MarkdownStyle,
    textPaint: TextPaint?
  ) {
    try {
      Trace.beginSection("applyRanges")
      // Containers arrive per line, outermost first, each preceded by the run of
      // text its own marker takes up on that line.
      val line = BlockLayout(markdownStyle, textPaint)
      var prefix: MarkdownRange? = null

      for (markdownRange in markdownRanges) {
        if (markdownRange.type == "block-prefix") {
          prefix = markdownRange
          continue
        }

        val gutter = gutterOf(markdownRange, markdownStyle)

        if (gutter != null) {
          line.add(ssb, markdownRange, gutter, prefix)
          prefix = null
          continue
        }

        applyRange(ssb, markdownRange, markdownStyle)
      }
    } finally {
      Trace.endSection()
    }
  }

  /** The gutter a container reserves for itself, or null if it is not one. */
  private fun gutterOf(markdownRange: MarkdownRange, markdownStyle: MarkdownStyle): Float? {
    val step = when (markdownRange.type) {
      "blockquote" ->
        markdownStyle.blockquoteMarginLeft +
          markdownStyle.blockquoteBorderWidth +
          markdownStyle.blockquotePaddingLeft

      "list-ordered" ->
        markdownStyle.orderedListMarginLeft + markdownStyle.orderedListPaddingLeft

      "list-unordered" ->
        markdownStyle.unorderedListMarginLeft + markdownStyle.unorderedListPaddingLeft

      else -> return null
    }

    return PixelUtil.toPixelFromDIP(step) * markdownRange.depth
  }

  /**
   * Places the containers of one line, left to right.
   *
   * Each container reserves a gutter and is then followed by its own marker,
   * which is text and so has to be stepped over rather than reserved: the
   * container nested inside it starts after the marker, not in front of it. That
   * is what puts a quote's ribbons after a list bullet, and a list's indent
   * after a quote's `>`.
   *
   * A line continuing a block carries no marker of its own, and reuses the one
   * that opened it -- otherwise its text, and any ribbon beside it, would sit at
   * a different offset than the line above and break the block in two.
   */
  private class BlockLayout(
    private val markdownStyle: MarkdownStyle,
    private val textPaint: TextPaint?
  ) {
    /** Scratch paint, reset from [textPaint] before each measurement. */
    private val measurePaint = TextPaint()

    /** Last marker seen for each container type, for the lines that continue it. */
    private val markers = HashMap<String, MarkdownRange>()
    private var lineStart = -1
    /** Offset reached so far, from the line's own left edge. */
    private var offset = 0f
    /**
     * Where the line's first marker begins, if it has one. The text starts
     * there; everything past it is held open with padding instead.
     */
    private var textStart = -1f
    /** Marker of the container placed most recently, if it is on this line. */
    private var padded: MarkdownRange? = null
    private var span: MarkdownBlockIndentSpan? = null

    fun add(
      ssb: SpannableStringBuilder,
      markdownRange: MarkdownRange,
      gutter: Float,
      prefix: MarkdownRange?
    ) {
      if (markdownRange.start != lineStart) {
        lineStart = markdownRange.start
        offset = 0f
        textStart = -1f
        padded = null
        span = MarkdownBlockIndentSpan(
          markdownStyle.blockquoteBorderColor,
          PixelUtil.toPixelFromDIP(markdownStyle.blockquoteBorderWidth),
          PixelUtil.toPixelFromDIP(
            markdownStyle.blockquoteMarginLeft +
              markdownStyle.blockquoteBorderWidth +
              markdownStyle.blockquotePaddingLeft
          )
        ).also {
          ssb.setSpan(it, markdownRange.start, markdownRange.end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }

      val indent = span ?: return

      padded?.let {
        ssb.setSpan(
          MarkdownGapSpan(gutter, markdownStyle.syntaxColor),
          it.end - 1,
          it.end,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }

      if (markdownRange.type == "blockquote") {
        indent.ribbonOffset = offset + PixelUtil.toPixelFromDIP(markdownStyle.blockquoteMarginLeft)
        indent.depth = markdownRange.depth
      }

      offset += gutter

      if (prefix != null) {
        markers[markdownRange.type] = prefix
        if (textStart < 0f) {
          textStart = offset
        }
      }

      (prefix ?: markers[markdownRange.type])?.let {
        offset += measure(ssb, it.start, it.end)
      }

      padded = prefix
      indent.firstLineIndent = if (textStart >= 0f) textStart else offset
      indent.indent = offset
    }

    /**
     * Width a marker renders at.
     *
     * The view's paint carries the text size while the measure path has none and
     * leaves it on the spannable, so the metric spans are folded in either way.
     * Padding added after a marker is a replacement span, which contributes
     * nothing here -- it belongs to the container that follows, not the marker.
     */
    private fun measure(ssb: SpannableStringBuilder, start: Int, end: Int): Float {
      if (textPaint != null) {
        measurePaint.set(textPaint)
      } else {
        measurePaint.reset()
      }

      for (span in ssb.getSpans(start, end, MetricAffectingSpan::class.java)) {
        span.updateMeasureState(measurePaint)
      }

      return measurePaint.measureText(ssb, start, end)
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

    }
  }

  private fun setSpan(ssb: SpannableStringBuilder, span: MarkdownSpan, start: Int, end: Int) {
    ssb.setSpan(span, start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  }
}
