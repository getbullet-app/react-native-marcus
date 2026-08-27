#import "MarkdownParser.h"

#import <RNLiveMarkdown/MarkdownWorkletParser.h>
#import <React/RCTLog.h>

// One entry is not enough once the main thread is restricted to cached ranges:
// two texts alternating (typing then undoing, or an input echoing older text
// back) evict each other and the main thread never finds what it needs. A few
// entries cover that, and the list stays small enough to scan linearly.
static const NSUInteger kMarkdownParserCacheCapacity = 4;

@interface MarkdownParserCacheEntry : NSObject
@property (nonatomic, readonly, nonnull) NSString *text;
@property (nonatomic, readonly, nonnull) NSNumber *parserId;
@property (nonatomic, readonly, nonnull) NSArray<MarkdownRange *> *markdownRanges;
@end

@implementation MarkdownParserCacheEntry

- (instancetype)initWithText:(nonnull NSString *)text
                    parserId:(nonnull NSNumber *)parserId
              markdownRanges:(nonnull NSArray<MarkdownRange *> *)markdownRanges
{
  if (self = [super init]) {
    _text = [text copy];
    _parserId = parserId;
    _markdownRanges = markdownRanges;
  }
  return self;
}

- (BOOL)matchesText:(nonnull NSString *)text parserId:(nonnull NSNumber *)parserId
{
  // Compare the parser id first; comparing numbers is cheaper than strings.
  return [_parserId isEqualToNumber:parserId] && [_text isEqualToString:text];
}

@end

@implementation MarkdownParser {
  // Newest entry first. Only touched inside @synchronized (self), which is
  // never held across a parse.
  NSMutableArray<MarkdownParserCacheEntry *> *_cache;

  NSString *_pendingText;
  NSNumber *_pendingParserId;
  void (^_pendingCompletion)(void);
  BOOL _warmupScheduled;
}

- (instancetype)init
{
  if (self = [super init]) {
    _cache = [[NSMutableArray alloc] initWithCapacity:kMarkdownParserCacheCapacity];
  }
  return self;
}

// Serial on purpose: the markdown runtime runs one parse at a time anyway, and
// serialising here avoids doing the same work twice.
+ (dispatch_queue_t)cacheWarmupQueue
{
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    dispatch_queue_attr_t attr = dispatch_queue_attr_make_with_qos_class(
        DISPATCH_QUEUE_SERIAL, QOS_CLASS_USER_INITIATED, 0);
    queue = dispatch_queue_create("com.expensify.livemarkdown.parser-cache-warmup", attr);
  });
  return queue;
}

#pragma mark - Cache

- (nullable NSArray<MarkdownRange *> *)cachedRangesForText:(nonnull NSString *)text
                                              withParserId:(nonnull NSNumber *)parserId
{
  @synchronized (self) {
    for (NSUInteger i = 0, n = _cache.count; i < n; i++) {
      MarkdownParserCacheEntry *entry = _cache[i];
      if (![entry matchesText:text parserId:parserId]) {
        continue;
      }
      if (i != 0) {
        // Promote, so the text being asked for repeatedly isn't the next evicted.
        [_cache removeObjectAtIndex:i];
        [_cache insertObject:entry atIndex:0];
      }
      return entry.markdownRanges;
    }
  }
  return nil;
}

- (void)cacheMarkdownRanges:(nonnull NSArray<MarkdownRange *> *)markdownRanges
                    forText:(nonnull NSString *)text
               withParserId:(nonnull NSNumber *)parserId
{
  MarkdownParserCacheEntry *entry = [[MarkdownParserCacheEntry alloc] initWithText:text
                                                                         parserId:parserId
                                                                   markdownRanges:markdownRanges];
  @synchronized (self) {
    for (NSUInteger i = 0, n = _cache.count; i < n; i++) {
      if ([_cache[i] matchesText:text parserId:parserId]) {
        [_cache removeObjectAtIndex:i];
        break;
      }
    }
    [_cache insertObject:entry atIndex:0];
    while (_cache.count > kMarkdownParserCacheCapacity) {
      [_cache removeLastObject];
    }
  }
}

#pragma mark - Parsing

- (NSArray<MarkdownRange *> *)parse:(nonnull NSString *)text
                       withParserId:(nonnull NSNumber *)parserId
{
  NSArray<MarkdownRange *> *cached = [self cachedRangesForText:text withParserId:parserId];
  if (cached != nil) {
    return cached;
  }

  // Deliberately parsed without holding the cache lock. Running the worklet
  // waits on the markdown runtime; holding a lock across that wait is what let a
  // background parse block the main thread until iOS killed the app. Two threads
  // may parse the same text concurrently, which is harmless -- they produce the
  // same result.
  NSArray<MarkdownRange *> *markdownRanges = [self parseUncached:text withParserId:parserId];

  [self cacheMarkdownRanges:markdownRanges forText:text withParserId:parserId];

  return markdownRanges;
}

- (NSArray<MarkdownRange *> *)parseUncached:(nonnull NSString *)text
                               withParserId:(nonnull NSNumber *)parserId
{
  // `text.length` is in UTF-16 code units, which is the unit the worklet reports
  // range offsets in. See parseMarkdown.
  const auto result = expensify::livemarkdown::parseMarkdown(text.UTF8String,
                                                             text.length,
                                                             parserId.intValue);

  if (!result.schemaError.empty()) {
    RCTLogWarn(@"[react-native-live-markdown] Incorrect schema of worklet parser output: %s",
               result.schemaError.c_str());
  }

  NSMutableArray<MarkdownRange *> *markdownRanges =
      [[NSMutableArray alloc] initWithCapacity:result.ranges.size()];
  for (const auto &range : result.ranges) {
    [markdownRanges addObject:[[MarkdownRange alloc] initWithType:@(range.type.c_str())
                                                            range:NSMakeRange(range.start, range.length)
                                                            depth:range.depth]];
  }
  return markdownRanges;
}

#pragma mark - Background warm-up

- (void)warmCacheAsyncForText:(nonnull NSString *)text
                 withParserId:(nonnull NSNumber *)parserId
                   completion:(nullable void (^)(void))completion
{
  @synchronized (self) {
    // Keep only the newest request, so stale text can never win over newer text.
    // The replaced completion goes with it; the newer request reports instead.
    _pendingText = [text copy];
    _pendingParserId = parserId;
    _pendingCompletion = completion;

    if (_warmupScheduled) {
      // A drain loop is already running and will pick this up.
      return;
    }
    _warmupScheduled = YES;
  }

  __weak MarkdownParser *weakSelf = self;
  dispatch_async([MarkdownParser cacheWarmupQueue], ^{
    [weakSelf drainPendingWarmups];
  });
}

- (void)drainPendingWarmups
{
  while (true) {
    NSString *text;
    NSNumber *parserId;
    void (^completion)(void);

    @synchronized (self) {
      if (_pendingText == nil) {
        _warmupScheduled = NO;
        return;
      }
      text = _pendingText;
      parserId = _pendingParserId;
      completion = _pendingCompletion;
      _pendingText = nil;
      _pendingParserId = nil;
      _pendingCompletion = nil;
    }

    [self parse:text withParserId:parserId];

    BOOL superseded;
    @synchronized (self) {
      superseded = _pendingText != nil;
    }
    if (completion != nil && !superseded) {
      completion();
    }
  }
}

@end
