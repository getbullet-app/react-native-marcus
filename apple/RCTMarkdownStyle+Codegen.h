#import <RNLiveMarkdown/RCTMarkdownStyle.h>

#import <react/renderer/components/RNLiveMarkdownSpec/Props.h>

NS_ASSUME_NONNULL_BEGIN

// Conversion from the codegen props struct lives in a separate category so that
// `RCTMarkdownStyle.h` itself stays free of C++. Only the component view and the
// shadow node need this header; everything downstream can import the plain one.
@interface RCTMarkdownStyle (Codegen)

- (instancetype)initWithStruct:(const facebook::react::MarkdownTextInputDecoratorViewMarkdownStyleStruct &)style;

@end

NS_ASSUME_NONNULL_END
