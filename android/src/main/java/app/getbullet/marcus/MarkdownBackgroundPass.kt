package app.getbullet.marcus

/**
 * Whether the view is painting the markdown backgrounds itself.
 *
 * A `Text` lets the layout paint them, in the pass Android runs for
 * `LineBackgroundSpan`. A `TextInput` cannot: that pass happens after the caret
 * is drawn, so anything opaque in it hides the caret ([[MarkdownBackgroundPainter]]
 * explains the rest). There the painter runs the spans itself, earlier, and this
 * is what tells them which of the two moments they are in -- painting on both
 * would put the background back over the caret.
 *
 * One instance per input. A spannable formatted for a `Text` carries none, and
 * its spans paint whenever they are asked to.
 */
class MarkdownBackgroundPass {
  /** True only while the painter is driving the spans. */
  var painting = false
}
