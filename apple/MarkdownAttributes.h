#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

// Custom attributed-string keys used across the module. They live here rather
// than alongside the formatter so that consumers which only need the key -- the
// `_textOf:equals:` swizzle, for instance -- don't pull in the formatter.

// Marks a string as markdown-formatted, which switches the swizzled
// `_textOf:equals:` to compare plain strings instead of full attributes.
FOUNDATION_EXPORT const
  NSAttributedStringKey RCTMarcusTextAttributeName NS_SWIFT_NAME(marcusText);

// Carries a MarkdownTextBackground for mention pills, drawn by the layout
// fragment rather than by NSBackgroundColorAttributeName.
FOUNDATION_EXPORT const NSAttributedStringKey
  RCTMarcusTextBackgroundAttributeName NS_SWIFT_NAME(marcusTextBackground);

// Carries a MarkdownCodeBlock over a fenced or indented block, drawn as one box
// behind the whole thing rather than as a background behind its glyphs.
FOUNDATION_EXPORT const NSAttributedStringKey
  RCTMarcusCodeBlockAttributeName NS_SWIFT_NAME(marcusCodeBlock);

// Carries a MarkdownListBullet over the marker character of an unordered list
// item, whose glyph is left undrawn so that the circle can be drawn in its
// place. Only a display ever carries it: an input shows the marker you typed.
FOUNDATION_EXPORT const NSAttributedStringKey
  RCTMarcusListBulletAttributeName NS_SWIFT_NAME(marcusListBullet);

// Blockquote nesting level, used to draw the ribbons.
FOUNDATION_EXPORT const NSAttributedStringKey
  RCTMarcusBlockquoteDepthAttributeName NS_SWIFT_NAME(marcusBlockquoteDepth);

// Distance from the paragraph's left edge to the blockquote's own box: the
// indent the line already carried when the blockquote was applied, plus any
// room left for a list marker drawn in front of the ribbons. They are drawn
// from there rather than from the text origin, which also moves with containers
// nested inside the quote (a list, say).
FOUNDATION_EXPORT const NSAttributedStringKey
  RCTMarcusBlockquoteIndentAttributeName NS_SWIFT_NAME(marcusBlockquoteIndent);

NS_ASSUME_NONNULL_END
