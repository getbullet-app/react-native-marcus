import Foundation

/// Parses and formats in one step for the view layer.
///
/// Parsing is stateful -- the shared parser owns a memo cache -- so this holds
/// the style and parser id that a text input's props supply, and hands both to
/// the stateless formatter on each pass. One instance per text input, only ever
/// touched on the main thread.
///
/// The `Text` side needs none of this: its ranges are parsed in JavaScript and
/// arrive as props, so `MarcusTextLayoutManager` calls the formatter directly.
@objc public final class MarkdownUtils: NSObject {

  /// Both are assigned after init -- props arrive after the view hierarchy is
  /// built -- and formatting bails out while either is still nil.
  @objc public var markdownStyle: RCTMarcusStyle?
  @objc public var parserId: NSNumber?

  @objc public func applyMarkdownFormatting(
    _ attributedString: NSMutableAttributedString,
    withDefaultTextAttributes defaultTextAttributes: [NSAttributedString.Key:
      Any]
  ) {
    guard let markdownStyle, let parserId else { return }

    let ranges = MarkdownParser.sharedParser.parse(
      attributedString.string,
      withParserId: parserId
    )

    MarkdownFormatter.format(
      attributedString,
      defaultTextAttributes: defaultTextAttributes,
      ranges: ranges,
      style: markdownStyle
    )
  }
}
