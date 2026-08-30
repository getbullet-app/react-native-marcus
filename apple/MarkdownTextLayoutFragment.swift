import UIKit

/// Draws the parts of markdown rendering that plain attributed-string attributes
/// can't express: blockquote ribbons down the left edge, and rounded background
/// pills behind mentions.
///
/// Only constructed by `MarkdownTextLayoutManagerDelegate`, so it stays internal
/// to the Swift half of the module.
final class MarkdownTextLayoutFragment: NSTextLayoutFragment {

  var markdownStyle: RCTMarkdownStyle?
  var depth: Int = 0
  var mentions: [MarkdownTextBackgroundWithRange] = []

  // MARK: - NSTextLayoutFragment

  override var renderingSurfaceBounds: CGRect {
    guard depth > 0 else { return super.renderingSurfaceBounds }
    return boundingRect.union(super.renderingSurfaceBounds)
  }

  override func draw(at point: CGPoint, in context: CGContext) {
    guard !textLineFragments.isEmpty else {
      super.draw(at: point, in: context)
      return
    }

    drawBlockquoteRibbons()
    drawMentions()

    super.draw(at: point, in: context)
  }

  // MARK: - Custom elements

  private func drawBlockquoteRibbons() {
    guard depth > 0, let style = markdownStyle else { return }

    let borderWidth = style.blockquoteBorderWidth
    let shift =
      style.blockquoteMarginLeft + borderWidth + style.blockquotePaddingLeft

    style.blockquoteBorderColor.setFill()

    let bounds = boundingRect
    for level in 0..<depth {
      let x = bounds.origin.x + CGFloat(level) * shift
      UIRectFill(
        CGRect(
          x: x,
          y: bounds.origin.y,
          width: borderWidth,
          height: bounds.size.height
        )
      )
    }
  }

  private func drawMentions() {
    guard !mentions.isEmpty else { return }

    let isSingleline = textLineFragments.count == 1

    // Carried across line fragments: mentions are ordered, so each line resumes
    // scanning where the previous one left off rather than restarting.
    var mentionIndex = 0

    for lineFragment in textLineFragments {
      let lineRange = lineFragment.characterRange
      if lineRange.length == 0 { continue }

      let lineBounds = lineFragment.typographicBounds
      // Absolute index into the source string, not a fragment-relative offset.
      let lineEndLocation = lineFragment.locationForCharacter(
        at: NSMaxRange(lineRange)
      )

      while mentionIndex < mentions.count,
        NSMaxRange(mentions[mentionIndex].range) <= lineRange.location
      {
        mentionIndex += 1
      }

      for i in mentionIndex..<mentions.count {
        let mention = mentions[i]
        if mention.range.location >= NSMaxRange(lineRange) { break }

        // Soft wrapping can split a mention across line fragments, so only the
        // part falling on this line is drawn here; the corners are rounded on
        // whichever side actually terminates the mention.
        let intersection = NSIntersectionRange(lineRange, mention.range)
        let startLocation = lineFragment.locationForCharacter(
          at: intersection.location
        )

        // Singleline: the mention starts off screen, nothing to draw. Only
        // happens while the text input is unfocused.
        if isSingleline, startLocation.x == 0, intersection.location > 0 {
          continue
        }

        var endLocation = lineFragment.locationForCharacter(
          at: intersection.location + intersection.length
        )

        // Singleline: the mention is only partially visible -- it either starts
        // mid-line or at the very beginning of the line.
        if isSingleline,
          startLocation.x > endLocation.x
            || (startLocation.x == endLocation.x && intersection.location == 0)
        {
          endLocation = lineEndLocation
        }

        guard
          let font = lineFragment.attributedString.attribute(
            .font,
            at: intersection.location,
            effectiveRange: nil
          ) as? UIFont
        else { continue }

        let backgroundRect = CGRect(
          x: lineBounds.origin.x + startLocation.x,
          y: lineBounds.origin.y + startLocation.y - font.ascender,
          width: endLocation.x - startLocation.x,
          height: font.lineHeight
        )

        var corners: UIRectCorner = []
        if intersection.location == mention.range.location {
          corners.insert([.topLeft, .bottomLeft])
        }
        if NSMaxRange(intersection) == NSMaxRange(mention.range) {
          corners.insert([.topRight, .bottomRight])
        }

        let radius = mention.textBackground.borderRadius
        let path =
          corners.isEmpty
          ? UIBezierPath(rect: backgroundRect)
          : UIBezierPath(
            roundedRect: backgroundRect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
          )

        mention.textBackground.color.setFill()
        path.fill()
      }
    }
  }

  // MARK: - Helpers

  /// The strip to the left of the text that the blockquote ribbons occupy.
  private var boundingRect: CGRect {
    var bounds = CGRect.null
    for lineFragment in textLineFragments
    where lineFragment.characterRange.length != 0 {
      bounds =
        bounds.isNull
        ? lineFragment.typographicBounds
        : bounds.union(lineFragment.typographicBounds)
    }

    // A null rect has an infinite origin; offsetting it would yield an
    // infinite rendering surface rather than an empty one.
    guard !bounds.isNull, let style = markdownStyle else { return bounds }

    let borderWidth = style.blockquoteBorderWidth
    let shift =
      style.blockquoteMarginLeft + borderWidth + style.blockquotePaddingLeft

    bounds.origin.x -=
      (style.blockquotePaddingLeft + borderWidth) + shift * CGFloat(depth - 1)
    bounds.size.width = borderWidth + shift * CGFloat(depth - 1)
    return bounds
  }
}
