import UIKit

@testable import MarcusFormatter

/// Serializes an attributed string into the shared render model.
///
/// Deliberately the same vocabulary and line shape as
/// `android/src/test/.../RenderModel.kt` -- `bold`, `color(#RRGGBB)`,
/// `font-size(N)`, `indent(first,rest)`, `gap` -- so the two platforms'
/// baselines diff against each other, not only against themselves.
///
/// Getting there takes two adjustments, because the platforms expose formatting
/// through opposite shapes. `enumerateAttributes` yields *runs* -- maximal
/// stretches where the whole attribute dictionary is constant -- so a bold span
/// broken by a colour change arrives as three runs, where Android's `getSpans`
/// reports one span over the lot. Ranges are therefore coalesced per attribute
/// afterwards. And every run carries the inherited font, which Android never
/// reports because nothing added a span for it, so attributes equal to the
/// default are dropped.
enum RenderModel {

  static func dump(
    _ attributedString: NSAttributedString,
    defaults: [NSAttributedString.Key: Any] = [:]
  ) -> String {
    let defaultFont = defaults[.font] as? UIFont
    var byAttribute: [String: [NSRange]] = [:]
    let full = NSRange(location: 0, length: attributedString.length)

    attributedString.enumerateAttributes(in: full, options: []) { attributes, range, _ in
      for name in describe(attributes, defaultFont: defaultFont) {
        byAttribute[name, default: []].append(range)
      }
    }

    let lines = byAttribute
      .flatMap { name, ranges in coalesce(ranges).map { (name: name, range: $0) } }
      .sorted {
        ($0.range.location, -$0.range.length, $0.name)
          < ($1.range.location, -$1.range.length, $1.name)
      }
      .map { String(format: "%4d..%-4d %@", $0.range.location, $0.range.upperBound, $0.name) }

    return lines.isEmpty ? "(no spans)" : lines.joined(separator: "\n")
  }

  /// Merges ranges that touch, so an attribute interrupted only by a different
  /// attribute is reported once over its whole extent.
  private static func coalesce(_ ranges: [NSRange]) -> [NSRange] {
    let sorted = ranges.sorted { $0.location < $1.location }
    var merged: [NSRange] = []

    for range in sorted {
      if let last = merged.last, last.upperBound >= range.location {
        merged[merged.count - 1] = NSRange(
          location: last.location,
          length: max(last.upperBound, range.upperBound) - last.location
        )
      } else {
        merged.append(range)
      }
    }

    return merged
  }

  private static func describe(
    _ attributes: [NSAttributedString.Key: Any],
    defaultFont: UIFont?
  ) -> [String] {
    var described: [String] = []

    for (key, value) in attributes {
      switch key {
      case .font:
        guard let font = value as? UIFont else { break }
        if font.isBold { described.append("bold") }
        if font.isItalic { described.append("italic") }
        // Only what the formatter changed. The inherited size and family are on
        // every run and would drown the diff.
        if let defaultFont, font.pointSize != defaultFont.pointSize {
          described.append("font-size(\(Int(font.pointSize.rounded())))")
        }
        if let defaultFont, font.familyName != defaultFont.familyName {
          described.append("font-family(\(font.familyName))")
        }

      case .foregroundColor:
        if let color = value as? UIColor { described.append("color(\(hex(color)))") }

      case .backgroundColor:
        if let color = value as? UIColor { described.append("background(\(hex(color)))") }

      case .strikethroughStyle:
        described.append("strikethrough")

      case .underlineStyle:
        described.append("underline")

      case .marcusTextBackground:
        described.append("background-shape")

      // The box behind a whole code block, which Android models as the
      // `MarkdownCodeBlockSpan` it sets over the same range.
      case .marcusCodeBlock:
        described.append("code-block")

      // The circle drawn in place of an unordered item's marker, which Android
      // models as the `MarkdownBulletSpan` it sets over the same character.
      case .marcusListBullet:
        described.append("bullet")

      // Kerning is how the space after a marker is held open here; Android does
      // the same job with a MarkdownGapSpan. One name for one thing.
      case .kern:
        described.append("gap")

      case .paragraphStyle:
        guard let style = value as? NSParagraphStyle else { break }
        let first = Int(style.firstLineHeadIndent.rounded())
        let rest = Int(style.headIndent.rounded())
        if first != 0 || rest != 0 { described.append("indent(\(first),\(rest))") }

      case .marcusBlockquoteDepth:
        if let depth = value as? NSNumber { described.append("quote-depth(\(depth.intValue))") }

      case .marcusBlockquoteIndent:
        if let indent = value as? NSNumber {
          described.append("quote-indent(\(Int(indent.doubleValue.rounded())))")
        }

      // Set across the whole string as a marker for the `_textOf:equals:`
      // swizzle. Reporting it on every line would say nothing.
      case .marcusText:
        break

      default:
        described.append("?\(key.rawValue)")
      }
    }

    return described
  }

  private static func hex(_ color: UIColor) -> String {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    var alpha: CGFloat = 0
    color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)

    return String(
      format: "#%02X%02X%02X",
      Int((red * 255).rounded()),
      Int((green * 255).rounded()),
      Int((blue * 255).rounded())
    )
  }
}

private extension UIFont {
  var isBold: Bool { fontDescriptor.symbolicTraits.contains(.traitBold) }
  var isItalic: Bool { fontDescriptor.symbolicTraits.contains(.traitItalic) }
}
