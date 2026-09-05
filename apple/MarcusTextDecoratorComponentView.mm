#import <React/RCTFabricComponentsPlugins.h>
#import <react/renderer/components/RNMarcusSpec/Props.h>

#import <RNMarcus/MarcusTextDecoratorComponentView.h>
#import <RNMarcus/MarcusTextDecoratorViewComponentDescriptor.h>

using namespace facebook::react;

@implementation MarcusTextDecoratorComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
    MarcusTextDecoratorViewComponentDescriptor>();
}

// Needed because of this: https://github.com/facebook/react-native/pull/37274
+ (void)load {
  [super load];
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
      std::make_shared<const MarcusTextDecoratorViewProps>();
    _props = defaultProps;
  }

  return self;
}

- (void)prepareForRecycle {
  [super prepareForRecycle];

  static const auto defaultProps =
    std::make_shared<const MarcusTextDecoratorViewProps>();
  _props = defaultProps;
}

Class<RCTComponentViewProtocol>
MarcusTextDecoratorViewCls(void) {
  return MarcusTextDecoratorComponentView.class;
}

@end
