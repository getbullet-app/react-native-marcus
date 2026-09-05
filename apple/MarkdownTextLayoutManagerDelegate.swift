import UIKit

/// Vends a `MarkdownTextLayoutFragment` for paragraphs that carry markdown
/// attributes needing custom drawing, and a plain fragment for everything else.
@objc
public final class MarkdownTextLayoutManagerDelegate: NSObject,
  NSTextLayoutManagerDelegate
{

  private let textStorage: NSTextStorage
  private let markdownUtils: MarkdownUtils

  @objc public init(textStorage: NSTextStorage, markdownUtils: MarkdownUtils)
  {
    self.textStorage = textStorage
    self.markdownUtils = markdownUtils
    super.init()
  }

  public func textLayoutManager(
    _ textLayoutManager: NSTextLayoutManager,
    textLayoutFragmentFor location: NSTextLocation,
    in textElement: NSTextElement
  ) -> NSTextLayoutFragment {
    let plain = {
      NSTextLayoutFragment(
        textElement: textElement,
        range: textElement.elementRange
      )
    }

    let index = textLayoutManager.offset(
      from: textLayoutManager.documentRange.location,
      to: location
    )
    guard index < textStorage.length else { return plain() }

    let depth =
      textStorage.attribute(
        .marcusBlockquoteDepth,
        at: index,
        effectiveRange: nil
      ) as? NSNumber
    let outerIndent =
      textStorage.attribute(
        .marcusBlockquoteIndent,
        at: index,
        effectiveRange: nil
      ) as? NSNumber

    guard let paragraph = textElement as? NSTextParagraph else {
      return plain()
    }
    let attributedString = paragraph.attributedString

    var mentions: [MarkdownTextBackgroundWithRange] = []
    attributedString.enumerateAttribute(
      .marcusTextBackground,
      in: NSRange(location: 0, length: attributedString.length)
    ) { value, range, _ in
      guard let textBackground = value as? MarkdownTextBackground else {
        return
      }
      mentions.append(
        MarkdownTextBackgroundWithRange(
          textBackground: textBackground,
          range: range
        )
      )
    }

    let paragraphRange = NSRange(
      location: index,
      length: attributedString.length
    )
    let codeBlock = codeBlock(in: paragraphRange)

    guard depth != nil || !mentions.isEmpty || codeBlock != nil else {
      return plain()
    }

    let fragment = MarkdownTextLayoutFragment(
      textElement: textElement,
      range: textElement.elementRange
    )
    fragment.markdownStyle = markdownUtils.markdownStyle
    fragment.depth = depth?.intValue ?? 0
    fragment.outerIndent = CGFloat(outerIndent?.doubleValue ?? 0)
    fragment.mentions = mentions
    fragment.codeBlock = codeBlock?.block
    fragment.opensCodeBlock = codeBlock.map {
      $0.range.location >= paragraphRange.location
    } ?? false
    fragment.closesCodeBlock = codeBlock.map {
      NSMaxRange($0.range) <= NSMaxRange(paragraphRange)
    } ?? false
    return fragment
  }

  /// The code block this paragraph is a line of, and how far that block reaches.
  ///
  /// Searched across the paragraph rather than read at its first character: a
  /// block quoted with `>` begins after the marker that opens the line, so the
  /// paragraph starts outside the block it belongs to.
  private func codeBlock(
    in paragraphRange: NSRange
  ) -> (block: MarkdownCodeBlock, range: NSRange)? {
    let clamped = NSIntersectionRange(
      paragraphRange,
      NSRange(location: 0, length: textStorage.length)
    )
    guard clamped.length > 0 else { return nil }

    var found: MarkdownCodeBlock?
    var location = NSNotFound

    textStorage.enumerateAttribute(
      .marcusCodeBlock,
      in: clamped,
      options: []
    ) { value, range, stop in
      guard let block = value as? MarkdownCodeBlock else { return }
      found = block
      location = range.location
      stop.pointee = true
    }

    guard let block = found else { return nil }

    // The run above is only this paragraph's share of the block. Which end of
    // the block the paragraph is at needs the whole of it.
    var blockRange = NSRange()
    _ = textStorage.attribute(
      .marcusCodeBlock,
      at: location,
      longestEffectiveRange: &blockRange,
      in: NSRange(location: 0, length: textStorage.length)
    )

    return (block, blockRange)
  }
}
