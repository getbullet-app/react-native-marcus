#import <RNMarcus/MarkdownSwiftInterop.h>
#import <RNMarcus/RCTTextInput+AdaptiveImageGlyph.h>

#import <objc/runtime.h>

// Kept as .mm rather than .m: plain Objective-C translation units in this pod
// compile with modules enabled, which makes importing any React header build
// the React clang module -- and that fails against React Native's prebuilt
// xcframework. Objective-C++ uses textual includes and avoids it.

// Installs `marcus_insertAdaptiveImageGlyph:replacementRange:` in place
// of UIKit's `insertAdaptiveImageGlyph:replacementRange:`. The handler itself
// is in Swift; only the runtime plumbing has to live here, because Swift cannot
// define
// `+load`.
static void
RCTMarcusSwizzleAdaptiveImageGlyph(Class targetClass, SEL swizzledSelector) {
  if (@available(iOS 18.0, *)) {
    SEL originalSelector = @selector(insertAdaptiveImageGlyph:
                                             replacementRange:);

    if (![targetClass instancesRespondToSelector:originalSelector]) {
      return;
    }

    Method originalMethod =
      class_getInstanceMethod(targetClass, originalSelector);
    Method swizzledMethod =
      class_getInstanceMethod(targetClass, swizzledSelector);
    if (!originalMethod || !swizzledMethod) {
      return;
    }

    BOOL didAddMethod = class_addMethod(
      targetClass, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod)
    );
    if (didAddMethod) {
      class_replaceMethod(targetClass, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
    } else {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }
  }
}

@implementation RCTUITextField (AdaptiveImageGlyph)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    RCTMarcusSwizzleAdaptiveImageGlyph([self class], @selector(marcus_insertAdaptiveImageGlyph:
                                                                              replacementRange:));
  });
}

- (void)marcus_insertAdaptiveImageGlyph:(id)glyph
                       replacementRange:(NSRange)replacementRange {
  // Deliberately does not call through to the original: the glyph is pasted as
  // a plain image instead of being inserted as an adaptive glyph.
  [MarkdownAdaptiveImageGlyph handlePasteInTextInputView:self glyph:glyph];
}

@end

@implementation RCTUITextView (AdaptiveImageGlyph)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    RCTMarcusSwizzleAdaptiveImageGlyph([self class], @selector(marcus_insertAdaptiveImageGlyph:
                                                                              replacementRange:));
  });
}

- (void)marcus_insertAdaptiveImageGlyph:(id)glyph
                       replacementRange:(NSRange)replacementRange {
  [MarkdownAdaptiveImageGlyph handlePasteInTextInputView:self glyph:glyph];
}

@end
