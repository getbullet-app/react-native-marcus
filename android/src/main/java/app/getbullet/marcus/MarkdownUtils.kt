package app.getbullet.marcus

import android.os.Trace
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.TextUtils
import com.facebook.react.bridge.ReactContext
import com.facebook.react.util.RNLog

/**
 * @param textPaint the view's own paint, held live rather than copied: the
 *   formatter measures block markers with it to work out where the containers
 *   nested inside them start, and has to see the size the text is drawn at.
 *   Null on the measure path, which has no view yet and carries the size on the
 *   spannable instead.
 */
class MarkdownUtils @JvmOverloads constructor(
  private val reactContext: ReactContext,
  private val textPaint: TextPaint? = null
) {
  private val markdownFormatter = MarkdownFormatter(reactContext.assets)

  // Hoisted rather than built per call: applyMarkdownFormatting runs several times per
  // keystroke, and this is only ever needed for a warning that normally never fires.
  private val onSchemaError: (String) -> Unit = { error ->
    RNLog.w(reactContext, "[react-native-marcus] Incorrect schema of worklet parser output: $error")
  }

  var markdownStyle: MarkdownStyle? = null
  var parserId: Int = 0

  /**
   * Records what the markdown spans currently on a spannable were built from.
   *
   * Held as a span rather than a field so that it is invalidated by exactly the things that
   * invalidate the formatting itself. Anything that replaces the spannable's content drops
   * this along with the markdown spans, and the next pass rebuilds both. A field would
   * survive that and we would skip a pass that was actually needed.
   */
  private class Fingerprint(val text: String, val parserId: Int, val style: MarkdownStyle)

  fun applyMarkdownFormatting(ssb: SpannableStringBuilder) {
    try {
      Trace.beginSection("applyMarkdownFormatting")
      val style = checkNotNull(markdownStyle) { "[react-native-marcus] markdownStyle is null" }

      // A single keystroke drives four passes: two from the edit itself and two from React
      // Native's state round-trip. They all ask for the same text, so only the first has any
      // work to do.
      if (isUpToDate(ssb, style)) {
        return
      }

      val text = ssb.toString()
      val markdownRanges = MarkdownParser.shared.parse(text, parserId, onSchemaError)
      markdownFormatter.format(ssb, markdownRanges, style, textPaint)
      stamp(ssb, text, style)
    } finally {
      Trace.endSection()
    }
  }

  private fun isUpToDate(ssb: SpannableStringBuilder, style: MarkdownStyle): Boolean {
    val fingerprint =
      ssb.getSpans(0, ssb.length, Fingerprint::class.java).singleOrNull() ?: return false
    return fingerprint.parserId == parserId &&
      // Identity, not equality: MarkdownStyle is rebuilt whenever the prop arrives, so a
      // different instance means the style may have changed and we re-apply to be safe.
      fingerprint.style === style &&
      // Compares the CharSequence in place. ssb.toString() would copy the whole document on
      // a path whose entire purpose is to do no work.
      TextUtils.equals(ssb, fingerprint.text)
  }

  private fun stamp(ssb: SpannableStringBuilder, text: String, style: MarkdownStyle) {
    // Fingerprint is not a MarkdownSpan, so MarkdownFormatter.removeSpans leaves it alone
    // and stale ones have to be cleared here or they would accumulate.
    for (stale in ssb.getSpans(0, ssb.length, Fingerprint::class.java)) {
      ssb.removeSpan(stale)
    }
    ssb.setSpan(Fingerprint(text, parserId, style), 0, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  }
}
