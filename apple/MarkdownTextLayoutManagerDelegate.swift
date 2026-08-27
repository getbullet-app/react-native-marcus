import UIKit

/// Vends a `MarkdownTextLayoutFragment` for paragraphs that carry markdown
/// attributes needing custom drawing, and a plain fragment for everything else.
@objc public final class MarkdownTextLayoutManagerDelegate: NSObject, NSTextLayoutManagerDelegate {

  private let textStorage: NSTextStorage
  private let markdownUtils: RCTMarkdownUtils

  @objc public init(textStorage: NSTextStorage, markdownUtils: RCTMarkdownUtils) {
    self.textStorage = textStorage
    self.markdownUtils = markdownUtils
    super.init()
  }

  public func textLayoutManager(_ textLayoutManager: NSTextLayoutManager,
                                textLayoutFragmentFor location: NSTextLocation,
                                in textElement: NSTextElement) -> NSTextLayoutFragment {
    let plain = { NSTextLayoutFragment(textElement: textElement, range: textElement.elementRange) }

    let index = textLayoutManager.offset(from: textLayoutManager.documentRange.location, to: location)
    guard index < textStorage.length else { return plain() }

    let depth = textStorage.attribute(.liveMarkdownBlockquoteDepth,
                                      at: index, effectiveRange: nil) as? NSNumber

    guard let paragraph = textElement as? NSTextParagraph else { return plain() }
    let attributedString = paragraph.attributedString

    var mentions: [MarkdownTextBackgroundWithRange] = []
    attributedString.enumerateAttribute(.liveMarkdownTextBackground,
                                        in: NSRange(location: 0, length: attributedString.length)) { value, range, _ in
      guard let textBackground = value as? MarkdownTextBackground else { return }
      mentions.append(MarkdownTextBackgroundWithRange(textBackground: textBackground, range: range))
    }

    guard depth != nil || !mentions.isEmpty else { return plain() }

    let fragment = MarkdownTextLayoutFragment(textElement: textElement, range: textElement.elementRange)
    fragment.markdownStyle = markdownUtils.markdownStyle
    fragment.depth = depth?.intValue ?? 0
    fragment.mentions = mentions
    return fragment
  }
}
