#import <RNMarcus/MarkdownSwiftInterop.h>
#import <RNMarcus/RCTMarcusUtils.h>

@implementation RCTMarcusUtils

- (void)applyMarkdownFormatting:
          (nonnull NSMutableAttributedString *)attributedString
      withDefaultTextAttributes:
        (nonnull NSDictionary<NSAttributedStringKey, id> *)defaultTextAttributes {
  // `markdownStyle` and `parserId` may not be set yet: props are applied after
  // the view hierarchy is built.
  if (_markdownStyle == nil || _parserId == nil) {
    return;
  }

  NSArray<MarcusRange *> *markdownRanges =
    [[MarkdownParser sharedParser] parse:attributedString.string
                            withParserId:_parserId];

  [MarkdownFormatter formatAttributedString:attributedString
                      defaultTextAttributes:defaultTextAttributes
                                     ranges:markdownRanges
                                      style:_markdownStyle];
}

@end
