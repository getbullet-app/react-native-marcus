import React
import UIKit

/// Re-applies formatting when the text view's default text attributes change,
/// which happens when style props such as colour or font size are updated.
@objc public final class MarkdownTextViewObserver: NSObject {

  // Strong on purpose -- see MarkdownTextStorageDelegate.
  private let textView: RCTUITextView
  private let markdownUtils: RCTMarcusUtils

  @objc public init(textView: RCTUITextView, markdownUtils: RCTMarcusUtils) {
    self.textView = textView
    self.markdownUtils = markdownUtils
    super.init()
  }

  public override func observeValue(
    forKeyPath keyPath: String?,
    of object: Any?,
    change: [NSKeyValueChangeKey: Any]?,
    context: UnsafeMutableRawPointer?
  ) {
    guard keyPath == "defaultTextAttributes" else { return }
    // Round-tripping through textStorage re-triggers the storage delegate,
    // which is what actually re-applies the formatting.
    guard let attributedText = textView.attributedText else { return }
    textView.textStorage.setAttributedString(attributedText)
  }
}
