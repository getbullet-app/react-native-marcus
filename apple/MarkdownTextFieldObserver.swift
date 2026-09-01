import React
import UIKit

/// Keeps a single-line text field formatted. Unlike the multiline case there is
/// no text storage to hook, so this reacts to control events and KVO instead and
/// rewrites `attributedText` in place.
@objc public final class MarkdownTextFieldObserver: NSObject {

  // Strong on purpose -- see MarkdownTextStorageDelegate.
  private let textField: RCTUITextField
  private let markdownUtils: RCTMarcusUtils

  /// Guards against the KVO observer re-entering while we assign `attributedText`.
  private var active = true

  @objc public init(textField: RCTUITextField, markdownUtils: RCTMarcusUtils)
  {
    self.textField = textField
    self.markdownUtils = markdownUtils
    super.init()
  }

  public override func observeValue(
    forKeyPath keyPath: String?,
    of object: Any?,
    change: [NSKeyValueChangeKey: Any]?,
    context: UnsafeMutableRawPointer?
  ) {
    guard active, keyPath == "text" || keyPath == "attributedText" else {
      return
    }
    applyMarkdownFormatting()
  }

  @objc public func textFieldDidChange(_ textField: UITextField) {
    applyMarkdownFormatting()
  }

  @objc public func textFieldDidEndEditing(_ textField: UITextField) {
    // Stops iOS underlining the whole field on blur when the text ends with a
    // link: `defaultTextAttributes` does not carry NSUnderline yet at this
    // point, so pushing a fresh value forces it to be picked up. The setter
    // compares deeply, so the value has to actually differ each time -- hence
    // the counter.
    var defaultTextAttributes = self.textField.defaultTextAttributes ?? [:]
    defaultTextAttributes[Self.forceUpdateAttributeName] =
      Self.nextForceUpdateToken()
    self.textField.defaultTextAttributes = defaultTextAttributes

    applyMarkdownFormatting()
  }

  private static let forceUpdateAttributeName = NSAttributedString.Key(
    "RCTMarcusForceUpdate"
  )
  private static var forceUpdateCounter: UInt = 0

  private static func nextForceUpdateToken() -> NSNumber {
    defer { forceUpdateCounter &+= 1 }
    return NSNumber(value: forceUpdateCounter)
  }

  private func applyMarkdownFormatting() {
    // Skip during multi-stage input (e.g. Japanese kana conversion), otherwise
    // rewriting the text breaks the input method's internal state.
    guard textField.markedTextRange == nil else { return }

    guard
      let attributedText = textField.attributedText?.mutableCopy()
        as? NSMutableAttributedString
    else { return }

    markdownUtils.applyMarkdownFormatting(
      attributedText,
      withDefaultTextAttributes: textField.defaultTextAttributes ?? [:]
    )

    let selectedTextRange = textField.selectedTextRange

    active = false
    textField.attributedText = attributedText
    active = true

    textField.setSelectedTextRange(selectedTextRange, notifyDelegate: false)

    // Prevents underline flicker while typing when the previous text ends with
    // a link.
    textField.typingAttributes = textField.defaultTextAttributes
  }
}
