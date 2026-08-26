import UIKit

/// Genmoji handling for iOS 18+.
///
/// An adaptive image glyph inserted directly would live in the text as an
/// `NSAdaptiveImageGlyph`, which markdown formatting has no representation for.
/// Instead it is flattened to a plain image and pasted, so it arrives as an
/// ordinary attachment.
@objc public final class MarkdownAdaptiveImageGlyph: NSObject {

  @objc(handlePasteInTextInputView:glyph:)
  public static func handlePaste(in textInputView: UIView, glyph: Any) {
    guard let image = flattenedImage(from: glyph) else { return }

    // Round-tripping through the pasteboard is what routes the image into the
    // text input, so the user's own clipboard contents are saved and restored.
    let pasteboard = UIPasteboard.general
    let savedItems = pasteboard.items
    pasteboard.image = image

    let paste = #selector(UIResponderStandardEditActions.paste(_:))
    if textInputView.canPerformAction(paste, withSender: nil) {
      textInputView.perform(paste, with: nil)
    }

    pasteboard.items = savedItems
  }

  private static func flattenedImage(from glyph: Any) -> UIImage? {
    guard #available(iOS 18.0, *),
          let glyph = glyph as? NSAdaptiveImageGlyph,
          let original = UIImage(data: glyph.imageContent)
    else { return nil }

    let targetSize = CGSize(width: 128, height: 128)
    let resized = UIGraphicsImageRenderer(size: targetSize).image { _ in
      original.draw(in: CGRect(origin: .zero, size: targetSize))
    }

    // The PNG round-trip drops the adaptive glyph's extra representations.
    guard let pngData = resized.pngData() else { return nil }
    return UIImage(data: pngData)
  }
}
