import UIKit

/// The rounded box drawn behind a run of text: a mention's pill, or an inline
/// run of code.
///
/// Stored as an attributed-string attribute value under
/// `.marcusTextBackground`, so it stays an object rather than a struct.
///
/// `padding` is the room between the glyphs and the box, `margin` the room
/// between the box and the text either side of it. Both are held open
/// horizontally by the kerning `MarkdownFormatter` puts on the characters the
/// run starts and ends with, so all that is left when drawing is to place the
/// edges inside the space they reserved. Vertically the box grows out of the
/// font's own box into the line's spacing: a line cannot be pushed apart for
/// one run on it.
final class MarkdownTextBackground: NSObject {
  var color: UIColor = .clear
  var borderRadius: CGFloat = 0
  var padding: CGFloat = 0
  var margin: CGFloat = 0
}

/// A `MarkdownTextBackground` paired with the range it applies to. Only ever a
/// local pairing while drawing, never stored in an attributed string.
struct MarkdownTextBackgroundWithRange {
  let textBackground: MarkdownTextBackground
  let range: NSRange
}

/// The box drawn behind a fenced or indented code block.
///
/// Stored under `.marcusCodeBlock` over the block's own text, and read by both
/// drawing paths -- `MarkdownTextLayoutFragment` in an input,
/// `MarkdownParagraphLayoutManager` in a paragraph -- so that the two draw the
/// same box from the same numbers.
///
/// `leftInset` is where the box's left edge sits, measured from the paragraph's
/// own left edge: the indent the block's lines already carried, plus the
/// margin. It is worked out while formatting, where the indents are, rather
/// than rediscovered from a paragraph style at every frame.
final class MarkdownCodeBlock: NSObject {
  var color: UIColor = .clear
  var borderRadius: CGFloat = 0
  var margin: CGFloat = 0
  var leftInset: CGFloat = 0
}

/// The bullet drawn in place of an unordered item's marker.
///
/// Stored under `.marcusListBullet` over the marker character itself, whose own
/// glyph is left undrawn: the character stays in the string -- it is what a
/// reader copies and what VoiceOver announces -- and the circle is drawn in the
/// advance it would have taken.
///
/// `diameter` comes from the base font size rather than from a length of its
/// own, so a list marks itself in proportion to the prose it marks. The marker's
/// advance is exactly this wide, which is what lets the circle be drawn from the
/// left edge of the glyph run and nothing else.
final class MarkdownListBullet: NSObject {
  var color: UIColor = .clear
  var diameter: CGFloat = 0
}
