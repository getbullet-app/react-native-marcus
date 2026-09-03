import UIKit

/// Applies markdown ranges to an attributed string as text attributes.
///
/// Stateless by design: style and ranges are parameters rather than stored
/// properties. That is what lets the Fabric measure path call it concurrently
/// without a lock -- the previous design stored the style and parser id on a
/// shared object, so a setter on one thread could race a read on another.
@objc public final class MarkdownFormatter: NSObject {

  /// Font resolution is injected rather than reached for, so this file carries
  /// no React dependency and can be compiled on its own. The Objective-C entry
  /// point in `MarkdownFormatter+React.swift` supplies the production one.
  public static func format(
    _ attributedString: NSMutableAttributedString,
    defaultTextAttributes: [NSAttributedString.Key: Any],
    ranges: [MarcusRange],
    style: RCTMarcusStyle,
    fonts: MarkdownFontProviding
  ) {
    let fullRange = NSRange(location: 0, length: attributedString.length)

    attributedString.beginEditing()

    attributedString.setAttributes(defaultTextAttributes, range: fullRange)

    // Forces the swizzled `_textOf:equals:` into string-only comparison.
    attributedString.addAttribute(.marcusText, value: true, range: fullRange)

    // Containers arrive per line, outermost first, each preceded by the run of
    // text its own marker takes up on that line. Laying a line out is a walk
    // left to right: reserve a container's gutter, step over its marker, repeat.
    var line = BlockLayout()
    var pendingPrefix: NSRange?

    for markdownRange in ranges {
      if markdownRange.type == "block-prefix" {
        pendingPrefix = markdownRange.range
        continue
      }

      if let gutter = gutter(
        for: markdownRange.type,
        depth: Int(markdownRange.depth),
        style: style
      ) {
        line.add(
          markdownRange.type,
          gutter: gutter,
          depth: Int(markdownRange.depth),
          prefix: pendingPrefix,
          to: attributedString,
          range: markdownRange.range,
          defaultTextAttributes: defaultTextAttributes
        )
        pendingPrefix = nil
        continue
      }

      apply(
        markdownRange.type,
        to: attributedString,
        range: markdownRange.range,
        depth: Int(markdownRange.depth),
        style: style,
        fonts: fonts
      )
    }

    (attributedString.string as NSString).enumerateSubstrings(
      in: fullRange,
      options: [.byLines, .substringNotRequired]
    ) { _, _, enclosingRange, _ in
      applyBaselineOffset(to: attributedString, range: enclosingRange)
    }

    attributedString.fixAttributes(in: fullRange)

    attributedString.endEditing()
  }

  // MARK: - Per-range attributes

  private static func apply(
    _ type: String,
    to attributedString: NSMutableAttributedString,
    range: NSRange,
    depth: Int,
    style: RCTMarcusStyle,
    fonts: MarkdownFontProviding
  ) {
    switch type {
    case "bold", "italic", "code", "pre", "heading", "emoji":
      var font =
        attributedString.attribute(
          .font,
          at: range.location,
          effectiveRange: nil
        ) as? UIFont
      switch type {
      case "bold":
        font = fonts.update(font, weight: "bold")
      case "italic":
        font = fonts.update(font, style: "italic")
      case "code":
        font = fonts.update(
          font,
          family: style.codeFontFamily,
          size: style.codeFontSize,
          weight: nil
        )
      case "pre":
        font = fonts.update(
          font,
          family: style.preFontFamily,
          size: style.preFontSize,
          weight: nil
        )
      case "heading":
        // Level N is the base size scaled N-1 times, so a single pair of style
        // values covers all six.
        var size = style.headingFontSize
        for _ in 1..<max(depth, 1) {
          size *= style.headingScale
        }
        font = fonts.update(font, family: nil, size: size, weight: "bold")
      case "emoji":
        font = fonts.update(
          font,
          family: style.emojiFontFamily,
          size: style.emojiFontSize,
          weight: nil
        )
      default:
        break
      }
      attributedString.addAttribute(.font, value: font as Any, range: range)
    default:
      break
    }

    switch type {
    case "syntax":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.syntaxColor,
        range: range
      )

    case "strikethrough":
      attributedString.addAttribute(
        .strikethroughStyle,
        value: NSUnderlineStyle.single.rawValue,
        range: range
      )

    case "code":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.codeColor,
        range: range
      )
      attributedString.addAttribute(
        .backgroundColor,
        value: style.codeBackgroundColor,
        range: range
      )

    case "mention-here":
      applyMention(
        to: attributedString,
        range: range,
        color: style.mentionHereColor,
        backgroundColor: style.mentionHereBackgroundColor,
        borderRadius: style.mentionHereBorderRadius
      )

    case "mention-user":
      // TODO: change mention color when it mentions current user
      applyMention(
        to: attributedString,
        range: range,
        color: style.mentionUserColor,
        backgroundColor: style.mentionUserBackgroundColor,
        borderRadius: style.mentionUserBorderRadius
      )

    case "mention-report":
      applyMention(
        to: attributedString,
        range: range,
        color: style.mentionReportColor,
        backgroundColor: style.mentionReportBackgroundColor,
        borderRadius: style.mentionReportBorderRadius
      )

    case "link":
      attributedString.addAttribute(
        .underlineStyle,
        value: NSUnderlineStyle.single.rawValue,
        range: range
      )
      attributedString.addAttribute(
        .foregroundColor,
        value: style.linkColor,
        range: range
      )

    case "pre":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.preColor,
        range: range
      )
      // A fenced block's range starts with the newline after the opening fence;
      // the background should not cover it.
      let text = attributedString.string as NSString
      let rangeForBackground =
        text.character(at: range.location) == unichar(10)
        ? NSRange(location: range.location + 1, length: range.length - 1)
        : range
      attributedString.addAttribute(
        .backgroundColor,
        value: style.preBackgroundColor,
        range: rangeForBackground
      )

    default:
      break
    }
  }

  private static func applyMention(
    to attributedString: NSMutableAttributedString,
    range: NSRange,
    color: UIColor,
    backgroundColor: UIColor,
    borderRadius: CGFloat
  ) {
    attributedString.addAttribute(.foregroundColor, value: color, range: range)

    let textBackground = MarkdownTextBackground()
    textBackground.color = backgroundColor
    textBackground.borderRadius = borderRadius
    attributedString.addAttribute(
      .marcusTextBackground,
      value: textBackground,
      range: range
    )
  }

  // MARK: - Block layout

  /// The gutter a container reserves for itself, or nil if the type is not one.
  private static func gutter(
    for type: String,
    depth: Int,
    style: RCTMarcusStyle
  ) -> CGFloat? {
    switch type {
    case "blockquote":
      return (style.blockquoteMarginLeft + style.blockquoteBorderWidth
        + style.blockquotePaddingLeft) * CGFloat(depth)
    case "list-ordered":
      return (style.orderedListMarginLeft + style.orderedListPaddingLeft)
        * CGFloat(depth)
    case "list-unordered":
      return (style.unorderedListMarginLeft + style.unorderedListPaddingLeft)
        * CGFloat(depth)
    default:
      return nil
    }
  }

  /// Places the containers of one line, left to right.
  ///
  /// Each container reserves a gutter and is then followed by its own marker,
  /// which is text and so has to be stepped over rather than reserved: the
  /// container nested inside it starts after the marker, not in front of it.
  /// That is what puts a quote's ribbons after a list bullet, and a list's
  /// indent after a quote's `>`.
  ///
  /// A line continuing a block carries no marker of its own, and reuses the one
  /// that opened it -- otherwise its text, and any ribbon beside it, would sit
  /// at a different offset than the line above and break the block in two.
  private struct BlockLayout {
    /// Last marker seen for each container type, for the lines that continue it.
    private var markers: [String: NSRange] = [:]
    private var lineStart = NSNotFound
    /// Offset reached so far, from the paragraph's own left edge.
    private var offset: CGFloat = 0
    /// Where the line's first marker begins, if it has one. The text starts
    /// there; everything past it is held open with padding instead.
    private var textStart: CGFloat?
    /// Marker of the container placed most recently, if it is on this line and
    /// so has something to pad.
    private var padded: NSRange?

    mutating func add(
      _ type: String,
      gutter: CGFloat,
      depth: Int,
      prefix: NSRange?,
      to attributedString: NSMutableAttributedString,
      range: NSRange,
      defaultTextAttributes: [NSAttributedString.Key: Any]
    ) {
      if range.location != lineStart {
        lineStart = range.location
        offset = MarkdownFormatter.baseIndent(
          of: attributedString,
          at: range.location,
          defaultTextAttributes: defaultTextAttributes
        )
        textStart = nil
        padded = nil
      }

      if let padded {
        MarkdownFormatter.pad(padded, by: gutter, in: attributedString)
      }

      if type == "blockquote" {
        attributedString.addAttribute(
          .marcusBlockquoteDepth,
          value: depth,
          range: range
        )
        attributedString.addAttribute(
          .marcusBlockquoteIndent,
          value: offset,
          range: range
        )
      }

      offset += gutter

      if let prefix {
        markers[type] = prefix
        if textStart == nil {
          textStart = offset
        }
      }

      if let marker = prefix ?? markers[type] {
        offset += MarkdownFormatter.measure(marker, in: attributedString)
      }

      padded = prefix
      MarkdownFormatter.setIndent(
        firstLine: textStart ?? offset,
        rest: offset,
        of: attributedString,
        range: range,
        defaultTextAttributes: defaultTextAttributes
      )
    }
  }

  // MARK: - Indents

  private static func baseIndent(
    of attributedString: NSAttributedString,
    at location: Int,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) -> CGFloat {
    paragraphStyle(
      of: attributedString,
      at: location,
      defaultTextAttributes: defaultTextAttributes
    ).headIndent
  }

  private static func setIndent(
    firstLine: CGFloat,
    rest: CGFloat,
    of attributedString: NSMutableAttributedString,
    range: NSRange,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) {
    let style = paragraphStyle(
      of: attributedString,
      at: range.location,
      defaultTextAttributes: defaultTextAttributes
    )
    style.firstLineHeadIndent = firstLine
    style.headIndent = rest

    attributedString.addAttribute(.paragraphStyle, value: style, range: range)
  }

  private static func paragraphStyle(
    of attributedString: NSAttributedString,
    at location: Int,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) -> NSMutableParagraphStyle {
    let existing =
      attributedString.attribute(
        .paragraphStyle,
        at: location,
        effectiveRange: nil
      ) as? NSParagraphStyle
      ?? defaultTextAttributes[.paragraphStyle] as? NSParagraphStyle

    return (existing?.mutableCopy() as? NSMutableParagraphStyle)
      ?? NSMutableParagraphStyle()
  }

  // MARK: - Measurement

  /// Opens `width` of space after `range` without touching its glyphs, so a
  /// nested container's gutter can sit between one marker and the next.
  private static func pad(
    _ range: NSRange,
    by width: CGFloat,
    in attributedString: NSMutableAttributedString
  ) {
    guard width > 0, range.length > 0 else { return }

    attributedString.addAttribute(
      .kern,
      value: width,
      range: NSRange(location: NSMaxRange(range) - 1, length: 1)
    )
  }

  /// Width `range` takes up mid-line, rounded up to a whole point.
  ///
  /// A sentinel is appended and its width taken back off again because `size()`
  /// measures the range as a line of its own and drops trailing whitespace --
  /// which a list-item prefix always ends in.
  ///
  /// Rounding is what keeps a quote's ribbon in one piece. TextKit snaps every
  /// line's origin to the device pixel grid, so a line indented past a marker
  /// and a line indented past nothing land on different sides of a fractional
  /// width, and the bar drawn beside them breaks by a pixel. A whole point is a
  /// whole number of pixels at every screen scale, so there is nothing left to
  /// snap. Rounding up rather than down also keeps the gap from eating into the
  /// marker it was measured from.
  private static func measure(
    _ range: NSRange,
    in attributedString: NSAttributedString
  ) -> CGFloat {
    let text = NSMutableAttributedString(
      attributedString: attributedString.attributedSubstring(from: range)
    )

    guard text.length > 0 else { return 0 }

    let full = NSRange(location: 0, length: text.length)
    // Indents belong to the paragraph, not to the run being measured, and the
    // padding opened after the marker is the next container's gutter rather
    // than part of the marker itself.
    text.removeAttribute(.paragraphStyle, range: full)
    text.removeAttribute(.kern, range: full)

    let sentinel = NSAttributedString(
      string: "|",
      attributes: text.attributes(at: text.length - 1, effectiveRange: nil)
    )
    text.append(sentinel)

    return (text.size().width - sentinel.size().width).rounded(.up)
  }

  // MARK: - Baseline

  /// Re-centres text vertically within an explicit `lineHeight` after the fonts
  /// above have changed the natural line height.
  private static func applyBaselineOffset(
    to attributedText: NSMutableAttributedString,
    range: NSRange
  ) {
    var maximumLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(
      .paragraphStyle,
      in: range,
      options: .longestEffectiveRangeNotRequired
    ) { value, _, _ in
      guard let paragraphStyle = value as? NSParagraphStyle else { return }
      maximumLineHeight = max(
        paragraphStyle.maximumLineHeight,
        maximumLineHeight
      )
    }

    // `lineHeight` was not specified, nothing to do.
    guard maximumLineHeight != 0 else { return }

    var maximumFontLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(
      .font,
      in: range,
      options: .longestEffectiveRangeNotRequired
    ) { value, _, _ in
      guard let font = value as? UIFont else { return }
      maximumFontLineHeight = max(font.lineHeight, maximumFontLineHeight)
    }

    guard maximumLineHeight >= maximumFontLineHeight else { return }

    let baselineOffset = (maximumLineHeight - maximumFontLineHeight) / 2.0
    attributedText.addAttribute(
      .baselineOffset,
      value: baselineOffset,
      range: range
    )
  }
}
