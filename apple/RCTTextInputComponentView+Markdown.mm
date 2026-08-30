#import <RNMarcus/MarkdownAttributes.h>
#import <RNMarcus/MarkdownTextInputDecoratorComponentView.h>
#import <RNMarcus/RCTTextInputComponentView+Markdown.h>
#import <objc/message.h>

@implementation RCTTextInputComponentView (Markdown)

- (BOOL)markdown__textOf:(NSAttributedString *)newText
                  equals:(NSAttributedString *)oldText {
  __block BOOL isMarkdownTextInput = false;
  [oldText enumerateAttribute:RCTMarcusTextAttributeName
                      inRange:NSMakeRange(0, oldText.length)
                      options:0
                   usingBlock:^(id value, NSRange range, BOOL *stop) {
                     if (value) {
                       isMarkdownTextInput = true;
                       *stop = YES;
                     }
                   }];
  if (isMarkdownTextInput) {
    return [newText.string isEqualToString:oldText.string];
  }

  return [self markdown__textOf:newText equals:oldText];
}

- (void)markdown_didAddSubview:(UIView *)subview {
  [self markdown_didAddSubview:subview];

  // React Native swaps `_backedTextInputView` in place when `multiline`
  // changes: it removes the old view from this component view and adds a new
  // one. That never touches the decorator's own subviews, so its didAddSubview:
  // does not fire and its observers would stay bound to the discarded view --
  // keeping it alive and leaving the new, visible one unformatted.
  UIView *parent = self.superview;
  if ([parent isKindOfClass:[MarkdownTextInputDecoratorComponentView class]]) {
    [(MarkdownTextInputDecoratorComponentView *)
        parent reattachTextInputObservers];
  }
}

// Installs `swizzledSelector` in place of `originalSelector` on `cls`.
//
// method_exchangeImplementations alone is only safe when `cls` implements
// `originalSelector` itself. For an inherited method -- didAddSubview:, for
// instance -- class_getInstanceMethod returns the *superclass's* method, and
// exchanging it rewrites UIView for every view in the app. So the
// implementation is added to this class first; when that succeeds, the
// "call the original" selector is pointed at the inherited implementation.
static void
RCTMarcusSwizzle(Class cls, SEL originalSelector, SEL swizzledSelector) {
  Method originalMethod = class_getInstanceMethod(cls, originalSelector);
  Method swizzledMethod = class_getInstanceMethod(cls, swizzledSelector);
  if (originalMethod == NULL || swizzledMethod == NULL) {
    return;
  }

  BOOL didAddMethod = class_addMethod(cls, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
  if (didAddMethod) {
    class_replaceMethod(cls, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
  } else {
    method_exchangeImplementations(originalMethod, swizzledMethod);
  }
}

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [self class];

    // Implemented by this class, so this is a plain exchange.
    RCTMarcusSwizzle(cls, @selector(_textOf:equals:), @selector(markdown__textOf:equals:));

    // Inherited from UIView, so this must go through class_addMethod.
    RCTMarcusSwizzle(cls, @selector(didAddSubview:), @selector(markdown_didAddSubview:));
  });
}

@end
