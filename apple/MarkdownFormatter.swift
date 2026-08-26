import React
import UIKit

/// Applies markdown ranges to an attributed string as text attributes.
///
/// Stateless by design: style and ranges are parameters rather than stored
/// properties. That is what lets the Fabric measure path call it concurrently
/// without a lock -- the previous design stored the style and parser id on a
/// shared object, so a setter on one thread could race a read on another.
@objc public final class MarkdownFormatter: NSObject {

  @objc(formatAttributedString:defaultTextAttributes:ranges:style:)
  public static func format(_ attributedString: NSMutableAttributedString,
                            defaultTextAttributes: [NSAttributedString.Key: Any],
                            ranges: [MarkdownRange],
                            style: RCTMarkdownStyle) {
    let fullRange = NSRange(location: 0, length: attributedString.length)

    attributedString.beginEditing()

    attributedString.setAttributes(defaultTextAttributes, range: fullRange)

    // Forces the swizzled `_textOf:equals:` into string-only comparison.
    attributedString.addAttribute(.liveMarkdownText, value: true, range: fullRange)

    for markdownRange in ranges {
      apply(markdownRange.type,
            to: attributedString,
            range: markdownRange.range,
            depth: Int(markdownRange.depth),
            style: style,
            defaultTextAttributes: defaultTextAttributes)
    }

    (attributedString.string as NSString).enumerateSubstrings(
      in: fullRange, options: [.byLines, .substringNotRequired]
    ) { _, _, enclosingRange, _ in
      applyBaselineOffset(to: attributedString, range: enclosingRange)
    }

    attributedString.fixAttributes(in: fullRange)

    attributedString.endEditing()
  }

  // MARK: - Per-range attributes

  private static func apply(_ type: String,
                            to attributedString: NSMutableAttributedString,
                            range: NSRange,
                            depth: Int,
                            style: RCTMarkdownStyle,
                            defaultTextAttributes: [NSAttributedString.Key: Any]) {
    switch type {
    case "bold", "italic", "code", "pre", "h1", "emoji":
      var font = attributedString.attribute(.font, at: range.location, effectiveRange: nil) as? UIFont
      switch type {
      case "bold":
        font = RCTFont.update(font, withWeight: "bold")
      case "italic":
        font = RCTFont.update(font, withStyle: "italic")
      case "code":
        font = RCTFont.update(font, withFamily: style.codeFontFamily,
                              size: NSNumber(value: Float(style.codeFontSize)),
                              weight: nil, style: nil, variant: nil, scaleMultiplier: 0)
      case "pre":
        font = RCTFont.update(font, withFamily: style.preFontFamily,
                              size: NSNumber(value: Float(style.preFontSize)),
                              weight: nil, style: nil, variant: nil, scaleMultiplier: 0)
      case "h1":
        font = RCTFont.update(font, withFamily: nil,
                              size: NSNumber(value: Float(style.h1FontSize)),
                              weight: "bold", style: nil, variant: nil, scaleMultiplier: 0)
      case "emoji":
        font = RCTFont.update(font, withFamily: style.emojiFontFamily,
                              size: NSNumber(value: Float(style.emojiFontSize)),
                              weight: nil, style: nil, variant: nil, scaleMultiplier: 0)
      default:
        break
      }
      attributedString.addAttribute(.font, value: font as Any, range: range)
    default:
      break
    }

    switch type {
    case "syntax":
      attributedString.addAttribute(.foregroundColor, value: style.syntaxColor, range: range)

    case "strikethrough":
      attributedString.addAttribute(.strikethroughStyle,
                                    value: NSUnderlineStyle.single.rawValue, range: range)

    case "code":
      attributedString.addAttribute(.foregroundColor, value: style.codeColor, range: range)
      attributedString.addAttribute(.backgroundColor, value: style.codeBackgroundColor, range: range)

    case "mention-here":
      applyMention(to: attributedString, range: range, color: style.mentionHereColor,
                   backgroundColor: style.mentionHereBackgroundColor,
                   borderRadius: style.mentionHereBorderRadius)

    case "mention-user":
      // TODO: change mention color when it mentions current user
      applyMention(to: attributedString, range: range, color: style.mentionUserColor,
                   backgroundColor: style.mentionUserBackgroundColor,
                   borderRadius: style.mentionUserBorderRadius)

    case "mention-report":
      applyMention(to: attributedString, range: range, color: style.mentionReportColor,
                   backgroundColor: style.mentionReportBackgroundColor,
                   borderRadius: style.mentionReportBorderRadius)

    case "link":
      attributedString.addAttribute(.underlineStyle,
                                    value: NSUnderlineStyle.single.rawValue, range: range)
      attributedString.addAttribute(.foregroundColor, value: style.linkColor, range: range)

    case "blockquote":
      let indent = (style.blockquoteMarginLeft + style.blockquoteBorderWidth
                    + style.blockquotePaddingLeft) * CGFloat(depth)
      let base = defaultTextAttributes[.paragraphStyle] as? NSParagraphStyle
      let paragraphStyle = (base?.mutableCopy() as? NSMutableParagraphStyle)
        ?? NSMutableParagraphStyle()
      paragraphStyle.firstLineHeadIndent = indent
      paragraphStyle.headIndent = indent
      attributedString.addAttribute(.paragraphStyle, value: paragraphStyle, range: range)
      attributedString.addAttribute(.liveMarkdownBlockquoteDepth, value: depth, range: range)

    case "pre":
      attributedString.addAttribute(.foregroundColor, value: style.preColor, range: range)
      // A fenced block's range starts with the newline after the opening fence;
      // the background should not cover it.
      let text = attributedString.string as NSString
      let rangeForBackground = text.character(at: range.location) == unichar(10)
        ? NSRange(location: range.location + 1, length: range.length - 1)
        : range
      attributedString.addAttribute(.backgroundColor, value: style.preBackgroundColor,
                                    range: rangeForBackground)

    default:
      break
    }
  }

  private static func applyMention(to attributedString: NSMutableAttributedString,
                                   range: NSRange,
                                   color: UIColor,
                                   backgroundColor: UIColor,
                                   borderRadius: CGFloat) {
    attributedString.addAttribute(.foregroundColor, value: color, range: range)

    let textBackground = RCTMarkdownTextBackground()
    textBackground.color = backgroundColor
    textBackground.borderRadius = borderRadius
    attributedString.addAttribute(.liveMarkdownTextBackground, value: textBackground, range: range)
  }

  // MARK: - Baseline

  /// Re-centres text vertically within an explicit `lineHeight` after the fonts
  /// above have changed the natural line height.
  private static func applyBaselineOffset(to attributedText: NSMutableAttributedString,
                                          range: NSRange) {
    var maximumLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(.paragraphStyle, in: range,
                                      options: .longestEffectiveRangeNotRequired) { value, _, _ in
      guard let paragraphStyle = value as? NSParagraphStyle else { return }
      maximumLineHeight = max(paragraphStyle.maximumLineHeight, maximumLineHeight)
    }

    // `lineHeight` was not specified, nothing to do.
    guard maximumLineHeight != 0 else { return }

    var maximumFontLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(.font, in: range,
                                      options: .longestEffectiveRangeNotRequired) { value, _, _ in
      guard let font = value as? UIFont else { return }
      maximumFontLineHeight = max(font.lineHeight, maximumFontLineHeight)
    }

    guard maximumLineHeight >= maximumFontLineHeight else { return }

    let baselineOffset = (maximumLineHeight - maximumFontLineHeight) / 2.0
    attributedText.addAttribute(.baselineOffset, value: baselineOffset, range: range)
  }
}
