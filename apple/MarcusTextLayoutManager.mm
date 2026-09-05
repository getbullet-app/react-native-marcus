#import <RNMarcus/MarcusTextLayoutManager.h>
#import <RNMarcus/MarkdownSwiftInterop.h>

#import <react/debug/react_native_assert.h>
#import <react/renderer/textlayoutmanager/RCTTextLayoutManager.h>
#import <react/utils/ManagedObjectWrapper.h>

using namespace facebook::react;

// The one seam every text path funnels through. It is private to
// RCTTextLayoutManager, so it is redeclared here to be overridden; the
// alternative is reimplementing five public methods that each need
// `_textStorageAndLayoutManagerWithAttributesString:`, which is private too.
//
// If React Native renames it the override silently stops being called, so the
// subclass asserts on the selector at construction rather than letting
// formatting quietly disappear.
@interface RCTTextLayoutManager (Marcus)
- (NSAttributedString *)
  _nsAttributedStringFromAttributedString:(facebook::react::AttributedString)attributedString;
- (NSTextStorage *)
  _textStorageAndLayoutManagerWithAttributesString:(NSAttributedString *)attributedString
                               paragraphAttributes:(facebook::react::ParagraphAttributes)paragraphAttributes
                                              size:(CGSize)size;
@end

@interface MarcusRCTTextLayoutManager : RCTTextLayoutManager

@property(nonatomic, copy) NSArray<MarcusRange *> *ranges;
@property(nonatomic, strong) RCTMarcusStyle *markdownStyle;

@end

@implementation MarcusRCTTextLayoutManager

- (NSAttributedString *)
  _nsAttributedStringFromAttributedString:(AttributedString)attributedString {
  NSAttributedString *unformatted =
    [super _nsAttributedStringFromAttributedString:attributedString];

  if (_markdownStyle == nil || unformatted.length == 0) {
    return unformatted;
  }

  // Superclass caches what it returns, so the copy is not optional.
  NSMutableAttributedString *formatted =
    [[NSMutableAttributedString alloc] initWithAttributedString:unformatted];

  // Unlike the text input there is no separate notion of default attributes: a
  // paragraph's own attributes are already on the string, fragment by fragment,
  // and the formatter is asked to leave them alone. What it still needs is a
  // paragraph style to build indents from, which is what these supply.
  NSDictionary<NSAttributedStringKey, id> *defaultTextAttributes =
    [unformatted attributesAtIndex:0 effectiveRange:NULL];

  [MarkdownFormatter formatParagraph:formatted
               defaultTextAttributes:defaultTextAttributes
                              ranges:_ranges
                               style:_markdownStyle];

  return formatted;
}

// The second seam, for the two shapes that are not attributes at all. Every
// path builds its layout here, and swapping in a subclass is the only way to
// reach the background drawing pass -- `drawAttributedString:` takes the layout
// manager this returns and never asks what class it is.
//
// Super is called rather than reimplemented so that whatever else React Native
// does to a text container -- line breaking, font scaling, baseline offset --
// keeps happening, and keeps happening the same way for measurement as for
// drawing.
- (NSTextStorage *)
  _textStorageAndLayoutManagerWithAttributesString:(NSAttributedString *)attributedString
                               paragraphAttributes:(ParagraphAttributes)paragraphAttributes
                                              size:(CGSize)size {
  NSTextStorage *textStorage =
    [super _textStorageAndLayoutManagerWithAttributesString:attributedString
                                       paragraphAttributes:paragraphAttributes
                                                      size:size];

  if (_markdownStyle == nil || textStorage.layoutManagers.count != 1) {
    return textStorage;
  }

  NSLayoutManager *original = textStorage.layoutManagers.firstObject;

  if (original.textContainers.count != 1 ||
      [original isKindOfClass:[MarkdownParagraphLayoutManager class]]) {
    return textStorage;
  }

  NSTextContainer *textContainer = original.textContainers.firstObject;
  MarkdownParagraphLayoutManager *replacement =
    [MarkdownParagraphLayoutManager new];
  replacement.usesFontLeading = original.usesFontLeading;
  replacement.markdownStyle = _markdownStyle;

  [original removeTextContainerAtIndex:0];
  [replacement addTextContainer:textContainer];
  [textStorage addLayoutManager:replacement];
  [textStorage removeLayoutManager:original];

  return textStorage;
}

/**
 * Where a press lands.
 *
 * The touch arrives in the paragraph view's own coordinates -- padding
 * included -- while the layout it is measured against starts at the content
 * frame, so on a `Text` with any padding at all React Native looks up the
 * character that many points down and to the right of the one under the
 * finger. With 8pt of padding and a 19pt line that is the bottom half of every
 * line pressing the line below it, which is most of what makes a link feel
 * like it has to be aimed at.
 *
 * Nothing else needs the untranslated point: this is the only method that
 * takes one.
 */
- (std::shared_ptr<const EventEmitter>)
  getEventEmitterWithAttributeString:(AttributedString)attributedString
                 paragraphAttributes:(ParagraphAttributes)paragraphAttributes
                               frame:(CGRect)frame
                             atPoint:(CGPoint)point {
  CGPoint inContent =
    CGPointMake(point.x - frame.origin.x, point.y - frame.origin.y);

  return [super getEventEmitterWithAttributeString:attributedString
                               paragraphAttributes:paragraphAttributes
                                             frame:frame
                                           atPoint:inContent];
}

@end

namespace facebook {
namespace react {

MarcusTextLayoutManager::MarcusTextLayoutManager(
  const std::shared_ptr<const ContextContainer> &contextContainer,
  NSArray<MarcusRange *> *ranges,
  RCTMarcusStyle *markdownStyle
)
    : TextLayoutManager(contextContainer) {
  react_native_assert(
    [RCTTextLayoutManager instancesRespondToSelector:
                            @selector(_nsAttributedStringFromAttributedString:)] &&
    "RCTTextLayoutManager no longer converts attributed strings through "
    "-_nsAttributedStringFromAttributedString:, so markdown formatting would "
    "never be applied"
  );
  react_native_assert(
    [RCTTextLayoutManager
      instancesRespondToSelector:
        @selector(_textStorageAndLayoutManagerWithAttributesString:paragraphAttributes:size:)] &&
    "RCTTextLayoutManager no longer builds its layout through "
    "-_textStorageAndLayoutManagerWithAttributesString:paragraphAttributes:size:, "
    "so blockquote ribbons and mention pills would never be drawn"
  );

  MarcusRCTTextLayoutManager *manager = [MarcusRCTTextLayoutManager new];
  manager.ranges = ranges;
  manager.markdownStyle = markdownStyle;

  // Replaces the plain one the base constructor just made. Every method on
  // TextLayoutManager reads this member rather than a type, so none of them
  // need to be virtual for the subclass to take effect.
  nativeTextLayoutManager_ = wrapManagedObject(manager);
}

} // namespace react
} // namespace facebook
