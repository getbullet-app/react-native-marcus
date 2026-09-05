import UIKit

/// Draws the parts of markdown rendering that attributed-string attributes
/// cannot express -- the box behind a code block, blockquote ribbons, rounded
/// mention pills and a list's bullets -- for a `Text` rather than a `TextInput`.
///
/// The input draws these in TextKit 2, from `MarkdownTextLayoutFragment`, which
/// is only reachable through a text view's own `NSTextLayoutManager`. A
/// paragraph is laid out and drawn by `RCTTextLayoutManager`, which is TextKit
/// 1, so the same shapes are drawn here instead -- during the background pass,
/// which is exactly where something belongs that has to sit under the glyphs and
/// over nothing.
///
/// The geometry is the same in both, and deliberately expressed the same way:
/// a code block's box spans the lines it covers, a ribbon sits at a fixed
/// offset from the paragraph's left edge, and a pill is a font-height box
/// around the run's baseline. The bullets are the one shape with no counterpart
/// in the input, which shows the marker that was typed rather than drawing one.
@objc public final class MarkdownParagraphLayoutManager: NSLayoutManager {

  @objc public var markdownStyle: RCTMarcusStyle?

  public override func drawBackground(
    forGlyphRange glyphsToShow: NSRange,
    at origin: CGPoint
  ) {
    super.drawBackground(forGlyphRange: glyphsToShow, at: origin)

    guard markdownStyle != nil, let textStorage else { return }

    let characterRange = self.characterRange(
      forGlyphRange: glyphsToShow,
      actualGlyphRange: nil
    )

    // Before the ribbons: a quoted block's box would otherwise cover the bar
    // drawn beside it.
    drawCodeBlocks(in: textStorage, characterRange, at: origin)
    drawBlockquoteRibbons(in: textStorage, glyphsToShow, at: origin)
    drawMentions(in: textStorage, characterRange, at: origin)
    drawListBullets(in: textStorage, characterRange, at: origin)
  }

  // MARK: - Code blocks

  /// One box per fenced or indented block, drawn behind the whole of it.
  ///
  /// The whole block at once rather than a rect per line: the fills of two
  /// abutting lines each antialias their shared edge, and the pair of
  /// half-covered rows reads as a seam across the box. It is the same reason
  /// the ribbons below are drawn per run of lines rather than per line.
  private func drawCodeBlocks(
    in textStorage: NSTextStorage,
    _ characterRange: NSRange,
    at origin: CGPoint
  ) {
    textStorage.enumerateAttribute(
      .marcusCodeBlock,
      in: characterRange,
      options: []
    ) { value, range, _ in
      guard let block = value as? MarkdownCodeBlock else { return }

      // The visible range can start mid-block while scrolling, and a box drawn
      // to that would round its corners in the middle of the code. Ask the
      // storage for the block's whole extent instead.
      var blockRange = range
      _ = textStorage.attribute(
        .marcusCodeBlock,
        at: range.location,
        longestEffectiveRange: &blockRange,
        in: NSRange(location: 0, length: textStorage.length)
      )

      drawCodeBlock(block, blockRange, at: origin)
    }
  }

  private func drawCodeBlock(
    _ block: MarkdownCodeBlock,
    _ range: NSRange,
    at origin: CGPoint
  ) {
    let blockGlyphRange = glyphRange(
      forCharacterRange: range,
      actualCharacterRange: nil
    )

    // Line fragment rects rather than the text inside them: a fragment spans
    // the width the line was laid out in and carries the paragraph spacing that
    // holds the box's own padding open, which is exactly the box.
    var bounds = CGRect.null
    var glyphIndex = blockGlyphRange.location

    while glyphIndex < NSMaxRange(blockGlyphRange) {
      var lineGlyphRange = NSRange()
      let lineRect = lineFragmentRect(
        forGlyphAt: glyphIndex,
        effectiveRange: &lineGlyphRange
      )

      // An empty effective range would spin here rather than crash, which is
      // worse; bail instead.
      guard lineGlyphRange.length > 0 else { break }

      bounds = bounds.isNull ? lineRect : bounds.union(lineRect)
      glyphIndex = NSMaxRange(lineGlyphRange)
    }

    guard !bounds.isNull else { return }

    let rect = CGRect(
      x: origin.x + bounds.minX + block.leftInset,
      y: origin.y + bounds.minY + block.margin,
      width: bounds.width - block.leftInset - block.margin,
      height: bounds.height - 2 * block.margin
    )

    guard rect.width > 0, rect.height > 0 else { return }

    block.color.setFill()
    UIBezierPath(roundedRect: rect, cornerRadius: block.borderRadius).fill()
  }

  // MARK: - Blockquote ribbons

  /// One ribbon per run of consecutive lines at the same nesting.
  ///
  /// Walked a line fragment at a time rather than per attribute run, because
  /// the line that opens a quote steps over a marker and the ones continuing it
  /// do not, so consecutive lines share the attribute but not their indent.
  /// Lines that do agree are then filled as a single rect: two abutting fills
  /// at a fractional boundary each antialias their shared edge, and the pair of
  /// half-covered rows reads as a seam across the bar.
  private func drawBlockquoteRibbons(
    in textStorage: NSTextStorage,
    _ glyphsToShow: NSRange,
    at origin: CGPoint
  ) {
    guard let style = markdownStyle else { return }

    var pending: (depth: Int, indent: CGFloat, rect: CGRect)?
    var didSetFill = false
    var glyphIndex = glyphsToShow.location

    func flush() {
      guard let run = pending else { return }
      pending = nil

      if !didSetFill {
        style.blockquoteBorderColor.setFill()
        didSetFill = true
      }

      // Measured from the paragraph's own left edge, never from the text: a
      // list nested inside the quote adds indent and a marker drawn in front
      // of the ribbon takes some away, and either would split the bar.
      let first = origin.x + run.indent + style.blockquoteMarginLeft

      for level in 0..<run.depth {
        UIRectFill(
          CGRect(
            x: first + CGFloat(level) * style.blockquoteShift,
            y: origin.y + run.rect.minY,
            width: style.blockquoteBorderWidth,
            height: run.rect.height
          )
        )
      }
    }

    while glyphIndex < NSMaxRange(glyphsToShow) {
      var lineGlyphRange = NSRange()
      let lineRect = lineFragmentRect(
        forGlyphAt: glyphIndex,
        effectiveRange: &lineGlyphRange
      )

      // An empty effective range would spin here rather than crash, which is
      // worse; bail instead.
      guard lineGlyphRange.length > 0 else { break }

      let line = characterRange(
        forGlyphRange: lineGlyphRange,
        actualGlyphRange: nil
      )

      if line.location < textStorage.length,
        let depth = textStorage.attribute(
          .marcusBlockquoteDepth,
          at: line.location,
          effectiveRange: nil
        ) as? NSNumber,
        depth.intValue > 0
      {
        let indent = CGFloat(
          (textStorage.attribute(
            .marcusBlockquoteIndent,
            at: line.location,
            effectiveRange: nil
          ) as? NSNumber)?.doubleValue ?? 0
        )

        if let run = pending, run.depth == depth.intValue, run.indent == indent {
          pending?.rect = run.rect.union(lineRect)
        } else {
          flush()
          pending = (depth.intValue, indent, lineRect)
        }
      } else {
        flush()
      }

      glyphIndex = NSMaxRange(lineGlyphRange)
    }

    flush()
  }

  // MARK: - Mention pills

  private func drawMentions(
    in textStorage: NSTextStorage,
    _ characterRange: NSRange,
    at origin: CGPoint
  ) {
    guard let textContainer = textContainers.first else { return }

    textStorage.enumerateAttribute(
      .marcusTextBackground,
      in: characterRange,
      options: []
    ) { value, mentionRange, _ in
      guard let background = value as? MarkdownTextBackground else { return }

      drawMention(
        background,
        in: textStorage,
        mentionRange,
        textContainer: textContainer,
        at: origin
      )
    }
  }

  /// Fills one mention, a line fragment at a time.
  ///
  /// Soft wrapping can split a mention, so each piece is filled on its own and
  /// only the sides that actually terminate the mention are rounded -- the
  /// break itself stays square, so the two halves read as one run.
  private func drawMention(
    _ background: MarkdownTextBackground,
    in textStorage: NSTextStorage,
    _ mentionRange: NSRange,
    textContainer: NSTextContainer,
    at origin: CGPoint
  ) {
    let mentionGlyphRange = glyphRange(
      forCharacterRange: mentionRange,
      actualCharacterRange: nil
    )
    let radius = background.borderRadius
    background.color.setFill()

    var glyphIndex = mentionGlyphRange.location

    while glyphIndex < NSMaxRange(mentionGlyphRange) {
      var lineGlyphRange = NSRange()
      let lineRect = lineFragmentRect(
        forGlyphAt: glyphIndex,
        effectiveRange: &lineGlyphRange
      )

      guard lineGlyphRange.length > 0 else { return }

      let segment = NSIntersectionRange(lineGlyphRange, mentionGlyphRange)

      guard segment.length > 0 else {
        glyphIndex = NSMaxRange(lineGlyphRange)
        continue
      }

      let box = boundingRect(forGlyphRange: segment, in: textContainer)
      let segmentCharacters = characterRange(
        forGlyphRange: segment,
        actualGlyphRange: nil
      )

      // The pill is a font-height box around the baseline, not the line
      // fragment: an explicit `lineHeight` makes the fragment taller than the
      // text, and a pill drawn to that height would swallow the gap between
      // two lines.
      if box.width > 0,
        segmentCharacters.location < textStorage.length,
        let font = textStorage.attribute(
          .font,
          at: segmentCharacters.location,
          effectiveRange: nil
        ) as? UIFont
      {
        // Where the run's own ends fall on this line, which is what the kerning
        // reserved space against and what the corners are rounded on.
        let opens = segment.location == mentionGlyphRange.location
        let closes = NSMaxRange(segment) == NSMaxRange(mentionGlyphRange)
        let padding = background.padding
        let baseline = lineRect.minY + location(forGlyphAt: segment.location).y
        let left = box.minX - (opens ? padding : 0)
        let right = box.maxX - (closes ? background.margin : 0)
        let rect = CGRect(
          x: origin.x + left,
          y: origin.y + baseline - font.ascender - padding,
          width: right - left,
          height: font.lineHeight + 2 * padding
        )

        var corners: UIRectCorner = []
        if opens {
          corners.insert([.topLeft, .bottomLeft])
        }
        if closes {
          corners.insert([.topRight, .bottomRight])
        }

        let path =
          corners.isEmpty || radius <= 0
          ? UIBezierPath(rect: rect)
          : UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
          )
        if rect.width > 0 {
          path.fill()
        }
      }

      glyphIndex = NSMaxRange(lineGlyphRange)
    }
  }
  // MARK: - List bullets

  /// One circle per unordered list item, in the advance its marker character
  /// was left holding.
  ///
  /// `MarkdownFormatter` kerned that character to exactly the circle's width and
  /// left its glyph undrawn, so the shape is the marker: it starts where the
  /// glyph run starts and needs no measuring of its own. Only the height is a
  /// question, and the answer is the line's -- a bullet marks the line rather
  /// than sitting on its baseline, so it is centred on the line's own box the
  /// way it is on every other platform.
  private func drawListBullets(
    in textStorage: NSTextStorage,
    _ characterRange: NSRange,
    at origin: CGPoint
  ) {
    guard let textContainer = textContainers.first else { return }

    textStorage.enumerateAttribute(
      .marcusListBullet,
      in: characterRange,
      options: []
    ) { value, markerRange, _ in
      guard let bullet = value as? MarkdownListBullet, bullet.diameter > 0 else {
        return
      }

      let markerGlyphRange = glyphRange(
        forCharacterRange: markerRange,
        actualCharacterRange: nil
      )

      guard markerGlyphRange.length > 0 else { return }

      let box = boundingRect(forGlyphRange: markerGlyphRange, in: textContainer)
      let line = lineFragmentUsedRect(
        forGlyphAt: markerGlyphRange.location,
        effectiveRange: nil
      )

      let rect = CGRect(
        x: origin.x + box.minX,
        y: origin.y + line.midY - bullet.diameter / 2,
        width: bullet.diameter,
        height: bullet.diameter
      )

      bullet.color.setFill()
      UIBezierPath(ovalIn: rect).fill()
    }
  }
}

extension RCTMarcusStyle {
  /// Width one level of blockquote nesting takes up: its own margin, the ribbon
  /// itself, and the padding between the ribbon and the text.
  var blockquoteShift: CGFloat {
    blockquoteMarginLeft + blockquoteBorderWidth + blockquotePaddingLeft
  }
}
