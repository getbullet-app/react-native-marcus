#import <RNLiveMarkdown/RCTMarkdownUtils.h>
#import <RNLiveMarkdown/MarkdownParser.h>
#import <RNLiveMarkdown/MarkdownSwiftInterop.h>

@implementation RCTMarkdownUtils {
  MarkdownParser *_markdownParser;
}

- (instancetype)init
{
  if (self = [super init]) {
    _markdownParser = [MarkdownParser new];
  }

  return self;
}

- (void)applyMarkdownFormatting:(nonnull NSMutableAttributedString *)attributedString
      withDefaultTextAttributes:(nonnull NSDictionary<NSAttributedStringKey, id> *)defaultTextAttributes
{
  // `markdownStyle` and `parserId` may not be set yet: props are applied after
  // the view hierarchy is built.
  if (_markdownStyle == nil || _parserId == nil) {
    return;
  }

  NSArray<MarkdownRange *> *markdownRanges = [_markdownParser parse:attributedString.string
                                                       withParserId:_parserId];

  [MarkdownFormatter formatAttributedString:attributedString
                      defaultTextAttributes:defaultTextAttributes
                                     ranges:markdownRanges
                                      style:_markdownStyle];
}

@end
