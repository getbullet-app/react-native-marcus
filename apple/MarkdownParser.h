#import <Foundation/Foundation.h>
#import <RNLiveMarkdown/MarkdownRange.h>

NS_ASSUME_NONNULL_BEGIN

@interface MarkdownParser : NSObject

// Returns cached ranges when there are any, otherwise parses and caches.
// Never call this from the main thread on a layout path: parsing waits on the
// markdown runtime, and that wait can outlast the watchdog.
- (NSArray<MarkdownRange *> *)parse:(nonnull NSString *)text
                       withParserId:(nonnull NSNumber *)parserId;

// Returns the ranges for (text, parserId) only if they are already cached, and
// nil otherwise. Never runs the parser, so it is safe on the main thread.
- (nullable NSArray<MarkdownRange *> *)cachedRangesForText:(nonnull NSString *)text
                                              withParserId:(nonnull NSNumber *)parserId;

// Parses on a background queue and caches the result, so the caller never waits
// on the markdown runtime.
//
// Only the newest request survives: a later call replaces one that is still
// queued. A parse already in flight cannot be cancelled, but the newest text is
// picked up as soon as it finishes.
//
// `completion` runs on the background queue once the ranges are cached, and is
// skipped when a newer request replaced this one -- that request reports instead.
- (void)warmCacheAsyncForText:(nonnull NSString *)text
                 withParserId:(nonnull NSNumber *)parserId
                   completion:(nullable void (^)(void))completion;

@end

NS_ASSUME_NONNULL_END
