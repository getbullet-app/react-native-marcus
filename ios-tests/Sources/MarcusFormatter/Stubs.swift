import UIKit

/// Swift stand-ins for the three Objective-C pieces the formatter takes as
/// parameters. See the note in `Package.swift` for why they are not symlinked.
///
/// Each one is a value holder. Nothing here reimplements formatting behaviour --
/// the file under test is the real `MarkdownFormatter.swift`.

// MARK: - MarcusRange

/// Mirrors `apple/MarcusRange.h`.
public final class MarcusRange: NSObject {
  public let type: String
  public let range: NSRange
  public let depth: UInt

  public init(type: String, range: NSRange, depth: UInt) {
    self.type = type
    self.range = range
    self.depth = depth
  }
}

// MARK: - Attribute keys

/// Mirrors `apple/MarkdownAttributes.m`. The string values matter: the render
/// model dumps them, and a mismatch would silently compare different keys.
extension NSAttributedString.Key {
  public static let marcusText = NSAttributedString.Key("RCTMarcusText")
  public static let marcusTextBackground = NSAttributedString.Key("RCTMarcusTextBackground")
  public static let marcusBlockquoteDepth = NSAttributedString.Key("RCTMarcusBlockquoteDepth")
  public static let marcusBlockquoteIndent = NSAttributedString.Key("RCTMarcusBlockquoteIndent")
}

// MARK: - RCTMarcusStyle

/// Mirrors `apple/RCTMarcusStyle.h`. Declared `@objc` members with the same
/// names and types, so the formatter compiles against it unchanged.
public final class RCTMarcusStyle: NSObject {
  public var syntaxColor: UIColor = .gray
  public var linkColor: UIColor = .blue
  public var headingFontSize: CGFloat = 38
  public var headingScale: CGFloat = 0.85
  public var emojiFontSize: CGFloat = 16
  public var emojiFontFamily: String = "System"
  public var blockquoteBorderColor: UIColor = .gray
  public var blockquoteBorderWidth: CGFloat = 6
  public var blockquoteMarginLeft: CGFloat = 6
  public var blockquotePaddingLeft: CGFloat = 6
  public var orderedListMarginLeft: CGFloat = 6
  public var orderedListPaddingLeft: CGFloat = 18
  public var unorderedListMarginLeft: CGFloat = 6
  public var unorderedListPaddingLeft: CGFloat = 18
  public var codeFontFamily: String = "Courier"
  public var codeFontSize: CGFloat = 16
  public var codeColor: UIColor = .black
  public var codeBackgroundColor: UIColor = .lightGray
  public var preFontFamily: String = "Courier"
  public var preFontSize: CGFloat = 16
  public var preColor: UIColor = .black
  public var preBackgroundColor: UIColor = .lightGray
  public var mentionHereColor: UIColor = .green
  public var mentionHereBackgroundColor: UIColor = .systemGreen
  public var mentionHereBorderRadius: CGFloat = 5
  public var mentionUserColor: UIColor = .blue
  public var mentionUserBackgroundColor: UIColor = .cyan
  public var mentionUserBorderRadius: CGFloat = 5
  public var mentionReportColor: UIColor = .red
  public var mentionReportBackgroundColor: UIColor = .systemPink
  public var mentionReportBorderRadius: CGFloat = 5
}
