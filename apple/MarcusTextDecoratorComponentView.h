#import <React/RCTViewComponentView.h>

NS_ASSUME_NONNULL_BEGIN

// The decorator has a host view only because unsetting `ForceFlattenView` in
// the shadow node forces one; nothing is drawn into it and nothing is observed
// on it. All of the formatting happens in the text layout manager the shadow
// node hands to the child paragraph.
@interface MarcusTextDecoratorComponentView : RCTViewComponentView
@end

NS_ASSUME_NONNULL_END
