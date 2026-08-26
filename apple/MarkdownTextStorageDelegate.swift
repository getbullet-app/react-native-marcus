import React
import UIKit

/// Reformats the text view's storage after every edit.
@objc public final class MarkdownTextStorageDelegate: NSObject, NSTextStorageDelegate {

  // Strong on purpose, matching the Objective-C original. Making it weak would
  // let the text view deallocate while this object is still installed as its
  // storage delegate and while KVO observers are registered on it.
  private let textView: RCTUITextView
  private let markdownUtils: RCTMarkdownUtils

  @objc public init(textView: RCTUITextView, markdownUtils: RCTMarkdownUtils) {
    self.textView = textView
    self.markdownUtils = markdownUtils
    super.init()
  }

  public func textStorage(_ textStorage: NSTextStorage,
                          didProcessEditing editedMask: NSTextStorage.EditActions,
                          range editedRange: NSRange,
                          changeInLength delta: Int) {
    markdownUtils.applyMarkdownFormatting(textStorage,
                                          withDefaultTextAttributes: textView.defaultTextAttributes ?? [:])
  }
}
