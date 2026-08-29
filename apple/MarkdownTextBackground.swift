import UIKit

/// The rounded background drawn behind a mention.
///
/// Stored as an attributed-string attribute value under
/// `.marcusTextBackground`, so it stays an object rather than a struct.
final class MarkdownTextBackground: NSObject {
  var color: UIColor = .clear
  var borderRadius: CGFloat = 0
}

/// A `MarkdownTextBackground` paired with the range it applies to. Only ever a
/// local pairing while drawing, never stored in an attributed string.
struct MarkdownTextBackgroundWithRange {
  let textBackground: MarkdownTextBackground
  let range: NSRange
}
