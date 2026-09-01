#import <RNMarcus/RCTMarcusStyle.h>

#import <react/renderer/components/RNMarcusSpec/Props.h>

NS_ASSUME_NONNULL_BEGIN

// Conversion from the codegen props struct lives in a separate category so that
// `RCTMarcusStyle.h` itself stays free of C++. Only the component view and
// the shadow node need this header; everything downstream can import the plain
// one.
@interface RCTMarcusStyle (Codegen)

- (instancetype)initWithStruct:
  (const facebook::react::MarcusTextInputDecoratorViewMarkdownStyleStruct &)style;

@end

NS_ASSUME_NONNULL_END
