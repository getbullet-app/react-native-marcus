import React
import UIKit

/// React Native's font resolution, and the only part of formatting that needs
/// the React pod graph.
@objc public final class MarkdownReactFonts: NSObject, MarkdownFontProviding {
  public func update(_ font: UIFont?, weight: String) -> UIFont? {
    RCTFont.update(font, withWeight: weight)
  }

  public func update(_ font: UIFont?, style: String) -> UIFont? {
    RCTFont.update(font, withStyle: style)
  }

  public func update(
    _ font: UIFont?,
    family: String?,
    size: CGFloat,
    weight: String?
  ) -> UIFont? {
    RCTFont.update(
      font,
      withFamily: family,
      size: NSNumber(value: Float(size)),
      weight: weight,
      style: nil,
      variant: nil,
      scaleMultiplier: 0
    )
  }
}

extension MarkdownFormatter {
  /// The entry point the Objective-C++ callers use, unchanged. It supplies the
  /// React font resolution so those call sites never have to know a seam exists.
  @objc(formatAttributedString:defaultTextAttributes:ranges:style:)
  public static func format(
    _ attributedString: NSMutableAttributedString,
    defaultTextAttributes: [NSAttributedString.Key: Any],
    ranges: [MarcusRange],
    style: RCTMarcusStyle
  ) {
    format(
      attributedString,
      defaultTextAttributes: defaultTextAttributes,
      ranges: ranges,
      style: style,
      fonts: MarkdownReactFonts()
    )
  }
}
