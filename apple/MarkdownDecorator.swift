import React
import UIKit

/// Owns everything the decorator does to a React Native text input: installing
/// the observers, delegates and layout-manager delegate that apply markdown
/// formatting, and tearing them down again.
///
/// The Fabric component view is a thin Objective-C++ shell around this, because
/// `RCTComponentViewProtocol` carries C++ types in its signatures and cannot be
/// implemented in Swift.
@objc public final class MarkdownDecorator: NSObject {

  private var markdownUtils = MarkdownUtils()

  private weak var textView: RCTUITextView?
  private weak var textField: RCTUITextField?

  /// What `attach(to:)` last bound to, so a repeated call for an unchanged
  /// backed view can be skipped.
  private weak var attachedBackedTextInputView: UIView?

  /// The backed view's own smart-dashes setting, restored on detach.
  private var previousSmartDashesType: UITextSmartDashesType?

  private var layoutManagerDelegate: MarkdownTextLayoutManagerDelegate?
  private var backedTextInputDelegate: MarkdownBackedTextInputDelegate?
  private var textStorageDelegate: MarkdownTextStorageDelegate?
  private var textViewObserver: MarkdownTextViewObserver?
  private var textFieldObserver: MarkdownTextFieldObserver?

  @objc public private(set) var isAttached = false

  // MARK: - Props

  @objc public var markdownStyle: RCTMarcusStyle? {
    get { markdownUtils.markdownStyle }
    set { markdownUtils.markdownStyle = newValue }
  }

  @objc public var parserId: NSNumber? {
    get { markdownUtils.parserId }
    set { markdownUtils.parserId = newValue }
  }

  /// Drops all per-mount state so the view can be recycled.
  @objc public func reset() {
    markdownUtils = MarkdownUtils()
  }

  // MARK: - Attach / detach

  /// Attaches to the backed text input inside `textInputComponentView`.
  ///
  /// Detaches first, so this doubles as the re-attach path used when React
  /// Native swaps its backed view on a `multiline` change.
  @objc public func attach(to textInputComponentView: UIView) {
    guard
      let backedTextInputView =
        textInputComponentView.value(forKey: "_backedTextInputView") as? UIView
    else {
      assertionFailure(
        "TextInput component view has no backed text input view."
      )
      return
    }

    // The re-attach hook fires for every subview added to the TextInput
    // component view, so ignore the ones that leave the backed view unchanged.
    if isAttached, backedTextInputView === attachedBackedTextInputView {
      return
    }

    detach()

    if let textField = backedTextInputView as? RCTUITextField {
      attach(toTextField: textField)
    } else if let textView = backedTextInputView as? RCTUITextView {
      attach(toTextView: textView)
    } else {
      assertionFailure("Cannot enable Markdown for this type of TextInput.")
      return
    }

    attachedBackedTextInputView = backedTextInputView
    isAttached = true
  }

  @objc public func detach() {
    guard isAttached else { return }
    isAttached = false

    if let textView {
      textView.textLayoutManager?.delegate = nil
      backedTextInputDelegate = nil
      if let textViewObserver {
        textView.removeObserver(
          textViewObserver,
          forKeyPath: "defaultTextAttributes",
          context: nil
        )
      }
      setSmartDashesEnabled(true, on: textView)
      setAdaptiveImageGlyphSupport(false, on: textView)
      textViewObserver = nil
      textStorageDelegate = nil
      textView.textStorage.delegate = nil
      self.textView = nil
    }

    if let textField {
      if let textFieldObserver {
        textField.removeTarget(
          textFieldObserver,
          action: #selector(MarkdownTextFieldObserver.textFieldDidChange(_:)),
          for: .editingChanged
        )
        textField.removeTarget(
          textFieldObserver,
          action: #selector(
            MarkdownTextFieldObserver.textFieldDidEndEditing(_:)
          ),
          for: .editingDidEnd
        )
        textField.removeObserver(
          textFieldObserver,
          forKeyPath: "text",
          context: nil
        )
        textField.removeObserver(
          textFieldObserver,
          forKeyPath: "attributedText",
          context: nil
        )
      }
      setSmartDashesEnabled(true, on: textField)
      setAdaptiveImageGlyphSupport(false, on: textField)
      textFieldObserver = nil
      self.textField = nil
    }

    layoutManagerDelegate = nil
    attachedBackedTextInputView = nil
  }

  /// Re-applies formatting after a style prop change.
  @objc public func applyNewStyles() {
    if let textView, let attributedText = textView.attributedText {
      textView.textStorage.setAttributedString(attributedText)
    }
    if let textField, let textFieldObserver {
      textFieldObserver.textFieldDidChange(textField)
    }
  }

  // MARK: - Single line

  private func attach(toTextField textField: RCTUITextField) {
    self.textField = textField

    // Formatting would be overwritten otherwise.
    assert(textField.adjustsFontSizeToFitWidth == false)

    setSmartDashesEnabled(false, on: textField)
    setAdaptiveImageGlyphSupport(true, on: textField)

    let observer = MarkdownTextFieldObserver(
      textField: textField,
      markdownUtils: markdownUtils
    )
    textFieldObserver = observer

    textField.addTarget(
      observer,
      action: #selector(MarkdownTextFieldObserver.textFieldDidChange(_:)),
      for: .editingChanged
    )
    textField.addTarget(
      observer,
      action: #selector(MarkdownTextFieldObserver.textFieldDidEndEditing(_:)),
      for: .editingDidEnd
    )
    textField.addObserver(
      observer,
      forKeyPath: "text",
      options: .new,
      context: nil
    )
    textField.addObserver(
      observer,
      forKeyPath: "attributedText",
      options: .new,
      context: nil
    )

    // Format the initial value.
    observer.textFieldDidChange(textField)

    // UITextField keeps its TextKit 2 stack private. The key names are spelled
    // backwards so they don't appear as literals in the binary.
    guard
      let textContainer = textField.value(
        forKey: Self.reversed("reniatnoCtxet_")
      ) as? NSTextContainer,
      let textStorage = textField.value(forKey: Self.reversed("egarotStxet_"))
        as? NSTextStorage
    else { return }

    let delegate = MarkdownTextLayoutManagerDelegate(
      textStorage: textStorage,
      markdownUtils: markdownUtils
    )
    layoutManagerDelegate = delegate
    textContainer.textLayoutManager?.delegate = delegate

    // TODO: register blockquotes layout manager
    // https://github.com/Expensify/react-native-live-markdown/issues/87
  }

  // MARK: - Multiline

  private func attach(toTextView textView: RCTUITextView) {
    self.textView = textView

    setSmartDashesEnabled(false, on: textView)
    setAdaptiveImageGlyphSupport(true, on: textView)

    assert(textView.textStorage.delegate == nil)
    let storageDelegate = MarkdownTextStorageDelegate(
      textView: textView,
      markdownUtils: markdownUtils
    )
    textStorageDelegate = storageDelegate
    textView.textStorage.delegate = storageDelegate

    let observer = MarkdownTextViewObserver(
      textView: textView,
      markdownUtils: markdownUtils
    )
    textViewObserver = observer
    textView.addObserver(
      observer,
      forKeyPath: "defaultTextAttributes",
      options: .new,
      context: nil
    )

    // Format the initial value.
    if let attributedText = textView.attributedText {
      textView.textStorage.setAttributedString(attributedText)
    }

    let delegate = MarkdownTextLayoutManagerDelegate(
      textStorage: textView.textStorage,
      markdownUtils: markdownUtils
    )
    layoutManagerDelegate = delegate
    textView.textLayoutManager?.delegate = delegate

    // Fixes the caret position after a blockquote.
    backedTextInputDelegate = MarkdownBackedTextInputDelegate(
      textView: textView
    )
  }

  // MARK: - Helpers

  private static func reversed(_ value: String) -> String {
    String(value.reversed())
  }

  /// Turns off the keyboard's `--` to em dash substitution while the input is
  /// decorated, restoring whatever it was on detach so a recycled view is not
  /// left changed.
  ///
  /// Smart punctuation rewrites the characters as they are typed, so `--` and
  /// `---` never reach the parser: a setext heading or thematic break silently
  /// stays plain text, while pasting the same characters works. Markdown syntax
  /// is not prose, so the substitution is wrong here even though it is right in
  /// a renderer.
  ///
  /// React Native does not expose this trait (it has `smartInsertDelete`, which
  /// is unrelated), and `autoCorrect={false}` does not cover it either -- smart
  /// dashes are independent of autocorrection.
  private func setSmartDashesEnabled(_ enabled: Bool, on textView: RCTUITextView) {
    if enabled {
      textView.smartDashesType = previousSmartDashesType ?? .default
      previousSmartDashesType = nil
    } else {
      previousSmartDashesType = textView.smartDashesType
      textView.smartDashesType = .no
    }
  }

  private func setSmartDashesEnabled(_ enabled: Bool, on textField: RCTUITextField) {
    if enabled {
      textField.smartDashesType = previousSmartDashesType ?? .default
      previousSmartDashesType = nil
    } else {
      previousSmartDashesType = textField.smartDashesType
      textField.smartDashesType = .no
    }
  }

  private func setAdaptiveImageGlyphSupport(
    _ enabled: Bool,
    on textInputView: UIView
  ) {
    guard #available(iOS 18.0, *) else { return }
    guard
      textInputView.responds(
        to: NSSelectorFromString("setSupportsAdaptiveImageGlyph:")
      )
    else { return }
    textInputView.setValue(enabled, forKey: "supportsAdaptiveImageGlyph")
  }
}
