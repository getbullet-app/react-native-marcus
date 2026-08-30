#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTTextInputComponentView.h>
#import <react/debug/react_native_assert.h>
#import <react/renderer/components/RNMarcusSpec/Props.h>

#import <RNMarcus/MarkdownSwiftInterop.h>
#import <RNMarcus/MarkdownTextInputDecoratorComponentView.h>
#import <RNMarcus/MarkdownTextInputDecoratorViewComponentDescriptor.h>
#import <RNMarcus/RCTMarkdownStyle+Codegen.h>
#import <RNMarcus/RCTTextInput+AdaptiveImageGlyph.h>

using namespace facebook::react;

// Thin Objective-C++ shell around MarkdownDecorator.
//
// Only the parts that RCTComponentViewProtocol forces into Objective-C++ live
// here -- the component descriptor, the C++ props update, and view recycling.
// Everything else is delegated to Swift.
@implementation MarkdownTextInputDecoratorComponentView {
  MarkdownDecorator *_decorator;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
    MarkdownTextInputDecoratorViewComponentDescriptor>();
}

// Needed because of this: https://github.com/facebook/react-native/pull/37274
+ (void)load {
  [super load];
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
      std::make_shared<const MarkdownTextInputDecoratorViewProps>();
    _props = defaultProps;
    _decorator = [MarkdownDecorator new];
  }

  return self;
}

- (void)didAddSubview:(UIView *)subview {
  [super didAddSubview:subview];

  react_native_assert(!_decorator.isAttached && "MarkdownTextInputDecoratorComponentView tried to add "
                                                "TextInput observers while they were attached");
  react_native_assert(
    [subview isKindOfClass:[RCTTextInputComponentView class]] &&
    "Child component of MarkdownTextInputDecoratorComponentView is not an "
    "instance of RCTTextInputComponentView."
  );

  [_decorator attachTo:subview];
}

- (void)willRemoveSubview:(UIView *)subview {
  [_decorator detach];
  [super willRemoveSubview:subview];
}

- (void)reattachTextInputObservers {
  // React Native replaces its backed text input view in place when `multiline`
  // changes, which never touches this view's own subviews. Called from the
  // RCTTextInputComponentView swizzle so the observers follow the new view
  // instead of staying bound to the discarded one.
  UIView *textInputComponentView = self.subviews.firstObject;
  if (textInputComponentView == nil) {
    return;
  }

  [_decorator attachTo:textInputComponentView];
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
    *std::static_pointer_cast<MarkdownTextInputDecoratorViewProps const>(
      _props
    );
  const auto &newViewProps =
    *std::static_pointer_cast<MarkdownTextInputDecoratorViewProps const>(
      props
    );

  if (oldViewProps.parserId != newViewProps.parserId) {
    _decorator.parserId = @(newViewProps.parserId);
  }

  // Codegen only emits operator== for the markdownStyle struct under
  // RN_SERIALIZABLE_STATE, which is not defined on iOS, so there is no cheap
  // way to tell whether the style actually changed. Rebuilding it and
  // re-formatting on every props update is wasteful -- Fabric emits one
  // whenever the props object is recreated -- but hand-written equality over
  // ~27 fields would rot silently the moment a style prop is added.
  _decorator.markdownStyle =
    [[RCTMarkdownStyle alloc] initWithStruct:newViewProps.markdownStyle];

  [_decorator applyNewStyles];

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle {
  react_native_assert(!_decorator.isAttached && "MarkdownTextInputDecoratorComponentView was being "
                                                "recycled with TextInput observers still attached");
  [super prepareForRecycle];

  static const auto defaultProps =
    std::make_shared<const MarkdownTextInputDecoratorViewProps>();
  _props = defaultProps;
  [_decorator reset];
}

Class<RCTComponentViewProtocol>
MarkdownTextInputDecoratorViewCls(void) {
  return MarkdownTextInputDecoratorComponentView.class;
}

@end
