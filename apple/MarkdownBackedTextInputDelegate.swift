import React
import UIKit

/// Sits in front of the text view's real delegate purely to fix the caret
/// position after a blockquote; every other callback is forwarded untouched.
@objc public final class MarkdownBackedTextInputDelegate: NSObject, RCTBackedTextInputDelegate {

  private weak var textView: RCTUITextView?
  private let originalTextInputDelegate: RCTBackedTextInputDelegate?

  @objc public init(textView: RCTUITextView) {
    self.textView = textView
    self.originalTextInputDelegate = textView.textInputDelegate
    super.init()
    textView.textInputDelegate = self
  }

  deinit {
    textView?.textInputDelegate = originalTextInputDelegate
  }

  public func textInputDidChangeSelection() {
    originalTextInputDelegate?.textInputDidChangeSelection()

    // After a newline at the end of a blockquote, the typing attributes for the
    // next line still carry the blockquote's paragraph indents, which pushes the
    // caret to the right instead of leaving it at the start of the line.
    guard let textView,
          let typingAttributes = textView.typingAttributes,
          let paragraphStyle = typingAttributes[.paragraphStyle] as? NSParagraphStyle,
          let mutableParagraphStyle = paragraphStyle.mutableCopy() as? NSMutableParagraphStyle
    else { return }

    mutableParagraphStyle.firstLineHeadIndent = 0
    mutableParagraphStyle.headIndent = 0

    var updated = typingAttributes
    updated[.paragraphStyle] = mutableParagraphStyle
    textView.typingAttributes = updated
  }

  // MARK: - Straight forwarding

  public func textInputDidChange() { originalTextInputDelegate?.textInputDidChange() }
  public func textInputDidBeginEditing() { originalTextInputDelegate?.textInputDidBeginEditing() }
  public func textInputDidEndEditing() { originalTextInputDelegate?.textInputDidEndEditing() }
  public func textInputDidReturn() { originalTextInputDelegate?.textInputDidReturn() }

  public func textInputShouldBeginEditing() -> Bool {
    originalTextInputDelegate?.textInputShouldBeginEditing() ?? true
  }

  public func textInputShouldEndEditing() -> Bool {
    originalTextInputDelegate?.textInputShouldEndEditing() ?? true
  }

  public func textInputShouldReturn() -> Bool {
    originalTextInputDelegate?.textInputShouldReturn() ?? true
  }

  public func textInputShouldSubmitOnReturn() -> Bool {
    originalTextInputDelegate?.textInputShouldSubmitOnReturn() ?? true
  }

  // The protocol annotates the return as nonnull, but its own documentation says
  // returning nil rejects the change. Declared as an implicitly unwrapped
  // optional so a nil from the real delegate is forwarded rather than being
  // silently turned into "accept".
  public func textInputShouldChangeText(_ text: String, in range: NSRange) -> String! {
    originalTextInputDelegate?.textInputShouldChangeText(text, in: range)
  }

  // MARK: - Paste

  // These are not part of RCTBackedTextInputDelegate; they are added by a
  // patch applied in the New Expensify app, so they are forwarded dynamically
  // and only when the real delegate actually implements them.
  // See https://github.com/Expensify/App/blob/main/patches

  @objc(textInputDidPaste:withData:)
  public func textInputDidPaste(_ type: String, withData data: String) {
    let selector = #selector(MarkdownBackedTextInputDelegate.textInputDidPaste(_:withData:))
    guard let delegate = originalTextInputDelegate as AnyObject?,
          delegate.responds(to: selector) else { return }
    _ = delegate.perform(selector, with: type, with: data)
  }

  @objc(textInputDidPaste:)
  public func textInputDidPaste(_ items: [[String: String]]) {
    let selector = #selector(MarkdownBackedTextInputDelegate.textInputDidPaste(_:) as (MarkdownBackedTextInputDelegate) -> ([[String: String]]) -> Void)
    guard let delegate = originalTextInputDelegate as AnyObject?,
          delegate.responds(to: selector) else { return }
    _ = delegate.perform(selector, with: items)
  }
}
