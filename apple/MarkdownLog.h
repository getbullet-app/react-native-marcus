#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// RCTLogWarn is a variadic C macro, so it cannot be called from Swift. This is
// the thinnest possible shim over it, kept so parser warnings still reach LogBox.
FOUNDATION_EXPORT void
MarkdownLogWarn(NSString *message) NS_SWIFT_NAME(markdownLogWarn(_:));

NS_ASSUME_NONNULL_END
