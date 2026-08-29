#import <React/RCTUITextField.h>
#import <React/RCTUITextView.h>

NS_ASSUME_NONNULL_BEGIN

@interface RCTUITextField (AdaptiveImageGlyph)
- (void)marcus_insertAdaptiveImageGlyph:(id)glyph
                       replacementRange:(NSRange)replacementRange;
@end

@interface RCTUITextView (AdaptiveImageGlyph)
- (void)marcus_insertAdaptiveImageGlyph:(id)glyph
                       replacementRange:(NSRange)replacementRange;
@end

NS_ASSUME_NONNULL_END
