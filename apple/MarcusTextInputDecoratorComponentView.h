#import <React/RCTViewComponentView.h>

NS_ASSUME_NONNULL_BEGIN

@interface MarcusTextInputDecoratorComponentView : RCTViewComponentView

// Called when React Native swaps the backed text input view underneath the
// child TextInput, which happens on a `multiline` prop change.
- (void)reattachTextInputObservers;
@end

NS_ASSUME_NONNULL_END
