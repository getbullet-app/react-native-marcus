#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

// Custom attributed-string keys used across the module. They live here rather
// than alongside the formatter so that consumers which only need the key -- the
// `_textOf:equals:` swizzle, for instance -- don't pull in the formatter.

// Marks a string as markdown-formatted, which switches the swizzled
// `_textOf:equals:` to compare plain strings instead of full attributes.
FOUNDATION_EXPORT const NSAttributedStringKey RCTLiveMarkdownTextAttributeName
    NS_SWIFT_NAME(liveMarkdownText);

// Carries an RCTMarkdownTextBackground for mention pills, drawn by the layout
// fragment rather than by NSBackgroundColorAttributeName.
FOUNDATION_EXPORT const NSAttributedStringKey RCTLiveMarkdownTextBackgroundAttributeName
    NS_SWIFT_NAME(liveMarkdownTextBackground);

// Blockquote nesting level, used to draw the ribbons.
FOUNDATION_EXPORT const NSAttributedStringKey RCTLiveMarkdownBlockquoteDepthAttributeName
    NS_SWIFT_NAME(liveMarkdownBlockquoteDepth);

NS_ASSUME_NONNULL_END
