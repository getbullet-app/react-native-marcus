#import "MarkdownParser.h"

#import <RNLiveMarkdown/MarkdownWorkletParser.h>
#import <React/RCTLog.h>

@implementation MarkdownParser {
  expensify::livemarkdown::MarkdownWorkletParser _parser;
  NSArray<MarkdownRange *> *_prevMarkdownRanges;
}

- (NSArray<MarkdownRange *> *)parse:(nonnull NSString *)text
                       withParserId:(nonnull NSNumber *)parserId
{
  // `text.length` is in UTF-16 code units, which is the unit the worklet reports
  // range offsets in. See MarkdownWorkletParser::parse.
  const auto result = _parser.parse(text.UTF8String, text.length, parserId.intValue);

  if (!result.schemaError.empty()) {
    RCTLogWarn(@"[react-native-live-markdown] Incorrect schema of worklet parser output: %s",
               result.schemaError.c_str());
  }

  // Reuse the previously built array when the parser reports the ranges are
  // unchanged, so a cache hit stays as cheap as it was before the split.
  if (result.fromCache && _prevMarkdownRanges != nil) {
    return _prevMarkdownRanges;
  }

  NSMutableArray<MarkdownRange *> *markdownRanges =
      [[NSMutableArray alloc] initWithCapacity:result.ranges.size()];
  for (const auto &range : result.ranges) {
    [markdownRanges addObject:[[MarkdownRange alloc] initWithType:@(range.type.c_str())
                                                            range:NSMakeRange(range.start, range.length)
                                                            depth:range.depth]];
  }

  _prevMarkdownRanges = markdownRanges;
  return markdownRanges;
}

@end
