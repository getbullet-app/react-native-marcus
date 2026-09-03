import UIKit

/// How a run's font is derived from the one already on the text.
///
/// The formatter needs React Native's font resolution -- it understands weight
/// and style names, family fallbacks and the text-size multiplier, and matching
/// it by hand would be a second implementation to keep in step. Nothing else in
/// the formatter needs React at all, though, so naming that one dependency is
/// what lets the file compile, and so be tested, without the pod graph.
///
/// `MarkdownReactFonts` is the production implementation; the test target
/// substitutes one whose output it can predict.
///
/// Not `@objc`: nothing in Objective-C names this type -- the `@objc` entry
/// point supplies the implementation itself -- and marking it so would restrict
/// conformance to classes for no reason.
public protocol MarkdownFontProviding {
  func update(_ font: UIFont?, weight: String) -> UIFont?
  func update(_ font: UIFont?, style: String) -> UIFont?
  func update(_ font: UIFont?, family: String?, size: CGFloat, weight: String?) -> UIFont?
}
