package app.getbullet.marcus

import android.content.res.AssetManager
import android.os.Trace
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.style.AbsoluteSizeSpan
import android.text.style.MetricAffectingSpan
import androidx.annotation.ColorInt
import app.getbullet.marcus.spans.MarkdownBackgroundSpan
import app.getbullet.marcus.spans.MarkdownBlockIndentSpan
import app.getbullet.marcus.spans.MarkdownBoldSpan
import app.getbullet.marcus.spans.MarkdownBulletSpan
import app.getbullet.marcus.spans.MarkdownCodeBlockSpan
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
import kotlin.math.ceil

/**
 * @param backgroundPass set for an input, where the view paints the markdown
 *   backgrounds itself so that the caret stays visible, and handed on to the
 *   spans that would otherwise paint themselves. Null for a `Text`.
 * @param display whether the list markers are rendered or shown. A `Text` draws
 *   them -- a bullet for an unordered item, the number at its own scale for an
 *   ordered one -- where an input shows the marker you typed, in the base font,
 *   because there it is text being edited rather than a rendering of it.
 */
class MarkdownFormatter(
  private val assetManager: AssetManager,
  private val backgroundPass: MarkdownBackgroundPass? = null,
  private val display: Boolean = false
) {

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
      val line = BlockLayout(markdownStyle, textPaint, display)
      var prefix: MarkdownRange? = null
      // Boxed once the walk is over: a block's own indent is whatever its lines
      // ended up with, and the containers around it are still being placed here.
      val codeBlocks = mutableListOf<MarkdownRange>()

      for (markdownRange in markdownRanges) {
        if (markdownRange.type == "block-prefix") {
          prefix = markdownRange
          continue
        }

        if (markdownRange.type == "codeblock") {
          codeBlocks.add(markdownRange)
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

      for (codeBlock in codeBlocks) {
        box(ssb, codeBlock, markdownStyle)
      }
    } finally {
      Trace.endSection()
    }
  }

  /**
   * Boxes one fenced or indented block: the room its background takes up, and
   * the background itself.
   *
   * Run after the container walk rather than during it, because a block is not a
   * container -- its range covers every line at once, where a container arrives
   * one line at a time -- and because what it indents by is whatever the
   * containers around it left its lines at.
   *
   * The indent is added to the spans those containers already left on the block's
   * lines, rather than laid on top as a second one: a line has one authority for
   * how far in it starts, and a quote's ribbons are drawn from that same span.
   */
  private fun box(
    ssb: SpannableStringBuilder,
    markdownRange: MarkdownRange,
    markdownStyle: MarkdownStyle
  ) {
    val (start, end) = body(ssb, markdownRange) ?: return

    val padding = PixelUtil.toPixelFromDIP(markdownStyle.prePadding)
    val margin = PixelUtil.toPixelFromDIP(markdownStyle.preMargin)
    val inset = padding + margin

    // Where the box's left edge goes: the leftmost the block's own lines start,
    // taken before they are moved right to make room for the padding. A line that
    // opens with a marker starts at its marker, so the box covers that -- the `>`
    // of a quoted block is inside the block being quoted.
    val indents = ssb.getSpans(start, end, MarkdownBlockIndentSpan::class.java)
    var left = 0f

    if (indents.isEmpty()) {
      setSpan(
        ssb,
        MarkdownBlockIndentSpan().also {
          it.firstLineIndent = inset
          it.indent = inset
        },
        start,
        end
      )
    } else {
      left = indents.minOf { it.firstLineIndent }
      for (indent in indents) {
        indent.firstLineIndent += inset
        indent.indent += inset
      }
    }

    setSpan(
      ssb,
      MarkdownCodeBlockSpan(
        markdownStyle.preBackgroundColor,
        PixelUtil.toPixelFromDIP(markdownStyle.preBorderRadius),
        padding,
        margin,
        left + margin,
        start,
        end,
        backgroundPass
      ),
      start,
      end
    )
  }

  /**
   * Boxes one inline run -- a mention, or a run of code: the room its background
   * takes up, and the background itself.
   *
   * The room is held open by widening the characters the run starts and ends
   * with, which is the one way a line can be made to leave space around a run
   * of itself: a paragraph span would move the whole line, and a background
   * colour would simply sit under whatever is next to it. Vertically the box
   * grows into the line's own spacing instead -- one run cannot push the lines
   * around it apart.
   *
   * The lengths arrive in dp, as they are written in a style.
   */
  private fun chip(
    ssb: SpannableStringBuilder,
    start: Int,
    end: Int,
    @ColorInt color: Int,
    @ColorInt backgroundColor: Int,
    borderRadius: Float,
    paddingDip: Float,
    marginDip: Float
  ) {
    val padding = PixelUtil.toPixelFromDIP(paddingDip)
    val margin = PixelUtil.toPixelFromDIP(marginDip)

    setSpan(
      ssb,
      MarkdownBackgroundSpan(
        backgroundColor,
        PixelUtil.toPixelFromDIP(borderRadius),
        start,
        end,
        padding,
        margin,
        backgroundPass
      ),
      start,
      end
    )

    val gap = padding + margin
    if (gap <= 0f) {
      return
    }

    // Whole code points, so a gap never lands on half a surrogate pair.
    val afterFirst = Character.offsetByCodePoints(ssb, start, 1)
    val beforeLast = Character.offsetByCodePoints(ssb, end, -1)

    if (afterFirst >= end) {
      // One character long: it opens and closes the run at once.
      setSpan(ssb, MarkdownGapSpan(gap, gap, color), start, end)
      return
    }

    setSpan(ssb, MarkdownGapSpan(leading = gap, color = color), start, afterFirst)
    setSpan(ssb, MarkdownGapSpan(trailing = gap, color = color), beforeLast, end)
  }

  /**
   * The lines a block actually occupies: its range with the line breaks it opens
   * and closes with taken off.
   *
   * A display renderer removes the opening fence and leaves the break that ended
   * it, so a block's range there begins on the line above its first line of code.
   * Boxing that break would paint a box around the line above.
   */
  private fun body(ssb: SpannableStringBuilder, markdownRange: MarkdownRange): Pair<Int, Int>? {
    var start = markdownRange.start
    var end = markdownRange.end

    while (start < end && isLineBreak(ssb[start])) {
      start++
    }
    while (end > start && isLineBreak(ssb[end - 1])) {
      end--
    }

    return if (end > start) start to end else null
  }

  private fun isLineBreak(character: Char): Boolean = character == '\n' || character == '\r'

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
    private val textPaint: TextPaint?,
    private val display: Boolean
  ) {
    /** Scratch paint, reset from [textPaint] before each measurement. */
    private val measurePaint = TextPaint()

    /** The size the wrapped `Text` draws at, in pixels; -1 until it is asked for. */
    private var baseSize = -1f

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

      padded?.let { hold(ssb, it, gutter) }

      if (markdownRange.type == "blockquote") {
        indent.ribbonOffset = offset + PixelUtil.toPixelFromDIP(markdownStyle.blockquoteMarginLeft)
        indent.depth = markdownRange.depth
      }

      offset += gutter

      // The room either side of a list marker is indent on the way in -- the
      // marker moves right with the text -- and held open with a gap on the way
      // out, which is the only thing that opens space after a character.
      val marker = prefix ?: markers[markdownRange.type]
      val padding = if (marker == null) 0f else markerPadding(markdownRange.type)

      offset += padding

      if (prefix != null) {
        markers[markdownRange.type] = prefix
        if (textStart < 0f) {
          textStart = offset
        }
      }

      if (marker != null) {
        // Only decorated on the line the marker is written on: a line continuing
        // the block reuses the one above, which has been drawn already.
        offset += placeMarker(ssb, marker, markdownRange.type, prefix != null)
        offset += padding

        if (prefix != null) {
          hold(ssb, marker, padding)
        }
      }

      padded = prefix
      indent.firstLineIndent = if (textStart >= 0f) textStart else offset
      indent.indent = offset
    }

    /**
     * Holds `amount` of space open after a marker, adding to whatever is already
     * holding some.
     *
     * The padding around a marker and the gutter of the container nested inside
     * it land on the same character, and a second replacement span there would
     * replace the first rather than add to it -- only one of them is ever asked
     * for a width.
     */
    private fun hold(ssb: SpannableStringBuilder, marker: MarkdownRange, amount: Float) {
      if (amount <= 0f) {
        return
      }

      val slot = marker.end - 1

      ssb.getSpans(slot, marker.end, MarkdownBulletSpan::class.java)
        .firstOrNull { ssb.getSpanStart(it) == slot }
        ?.let {
          it.trailing += amount
          return
        }

      ssb.getSpans(slot, marker.end, MarkdownGapSpan::class.java)
        .firstOrNull { ssb.getSpanStart(it) == slot }
        ?.let {
          it.trailing += amount
          return
        }

      ssb.setSpan(
        MarkdownGapSpan(trailing = amount, color = markdownStyle.syntaxColor),
        slot,
        marker.end,
        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
      )
    }

    /**
     * Room held open either side of a list's marker, or nothing at all for a
     * container whose marker is shown rather than rendered.
     */
    private fun markerPadding(type: String): Float {
      if (!display) {
        return 0f
      }

      return PixelUtil.toPixelFromDIP(
        when (type) {
          "list-ordered" -> markdownStyle.orderedListMarkerPadding
          "list-unordered" -> markdownStyle.unorderedListMarkerPadding
          else -> return 0f
        }
      )
    }

    /**
     * The width a prefix's glyphs take up, drawing whatever a display draws its
     * marker as on the way past.
     *
     * A display renders the marker rather than showing it: an unordered item's
     * `-` becomes a circle, an ordered item's `1.` stays the number it means but
     * at its own scale. Both change how wide the prefix comes out, and the
     * containers nested inside it start after that width, so the two are worked
     * out in one place.
     */
    private fun placeMarker(
      ssb: SpannableStringBuilder,
      marker: MarkdownRange,
      type: String,
      decorate: Boolean
    ): Float {
      val width = measure(ssb, marker.start, marker.end)

      if (!display) {
        return width
      }

      val run = markerRun(ssb, marker) ?: return width
      val base = baseTextSize(ssb)

      if (base <= 0f) {
        return width
      }

      return when (type) {
        "list-unordered" -> {
          val diameter = base * markdownStyle.unorderedListMarkerScale
          // A whole pixel, because that is what the span can report as an
          // advance, and the indent has to agree with it exactly.
          val box = ceil(diameter).toInt()

          if (decorate) {
            ssb.setSpan(
              MarkdownBulletSpan(markdownStyle.syntaxColor, diameter, box),
              run.first,
              run.second,
              Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
          }

          // The marker's own glyph is not drawn, so the circle's width stands in
          // for it and the rest of the prefix -- an indent in front, the space
          // behind -- measures as it always did.
          width - measure(ssb, run.first, run.second) + box
        }

        "list-ordered" -> {
          if (!decorate) {
            // The scaling is already on the string, so the width above is the
            // one the number is drawn at.
            return width
          }

          ssb.setSpan(
            MarkdownFontSizeSpan(
              PixelUtil.toDIPFromPixel(base * markdownStyle.orderedListMarkerScale)
            ),
            run.first,
            run.second,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )

          measure(ssb, marker.start, marker.end)
        }

        else -> width
      }
    }

    /**
     * The marker at the end of a prefix: the `-` of a bullet or the `1.` of a
     * numbered item, without the indent in front of it or the space after it.
     *
     * Read off the text rather than taken from the `syntax` range covering it,
     * because a prefix runs from wherever the previous container's marker ended
     * and so can carry another container's marker with it -- the ordered list in
     * `- > 1. ` is handed `> 1. `. The last run of non-blanks is this
     * container's own.
     */
    private fun markerRun(ssb: SpannableStringBuilder, prefix: MarkdownRange): Pair<Int, Int>? {
      var end = prefix.end
      while (end > prefix.start && isBlank(ssb[end - 1])) {
        end--
      }

      var start = end
      while (start > prefix.start && !isBlank(ssb[start - 1])) {
        start--
      }

      return if (end > start) start to end else null
    }

    private fun isBlank(character: Char): Boolean = character == ' ' || character == '\t'

    /**
     * The size the wrapped `Text` draws at, which is what a marker is drawn in
     * proportion to.
     *
     * The view's own paint knows it; the measure path has no view, and takes it
     * from the size React Native left over the whole string. Only a span
     * covering all of it will do -- one covering part of it is a nested `Text`
     * or a heading, neither of which is the base.
     */
    private fun baseTextSize(ssb: SpannableStringBuilder): Float {
      if (baseSize >= 0f) {
        return baseSize
      }

      baseSize = textPaint?.textSize
        ?: ssb.getSpans(0, ssb.length, AbsoluteSizeSpan::class.java)
          .firstOrNull {
            it !is MarkdownSpan &&
              ssb.getSpanStart(it) == 0 &&
              ssb.getSpanEnd(it) == ssb.length
          }
          ?.size
          ?.toFloat()
        ?: 0f

      return baseSize
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

      "mention" -> {
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.mentionColor), start, end)
        chip(
          ssb,
          start,
          end,
          markdownStyle.mentionColor,
          markdownStyle.mentionBackgroundColor,
          markdownStyle.mentionBorderRadius,
          markdownStyle.mentionPadding,
          markdownStyle.mentionMargin
        )
      }

      // A fenced block's language is its own type so that something can read it,
      // but in an input it is part of the fence you are typing and reads as
      // markup, so it is coloured like the rest of it.
      "syntax", "codeblock-language" ->
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.syntaxColor), start, end)

      "link" -> {
        setSpan(ssb, MarkdownUnderlineSpan(), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.linkColor), start, end)
      }

      "code" -> {
        setSpan(ssb, MarkdownFontFamilySpan(markdownStyle.codeFontFamily, assetManager), start, end)
        setSpan(ssb, MarkdownFontSizeSpan(markdownStyle.codeFontSize), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.codeColor), start, end)
        chip(
          ssb,
          start,
          end,
          markdownStyle.codeColor,
          markdownStyle.codeBackgroundColor,
          markdownStyle.codeBorderRadius,
          markdownStyle.codePadding,
          markdownStyle.codeMargin
        )
      }

      // Only the font and the colour: what a block is drawn on is a box behind
      // the whole of it, applied from the `codeblock` range in box().
      "pre" -> {
        setSpan(ssb, MarkdownFontFamilySpan(markdownStyle.preFontFamily, assetManager), start, end)
        setSpan(ssb, MarkdownFontSizeSpan(markdownStyle.preFontSize), start, end)
        setSpan(ssb, MarkdownForegroundColorSpan(markdownStyle.preColor), start, end)
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
