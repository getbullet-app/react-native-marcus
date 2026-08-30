#import <RNMarcus/RCTMarkdownStyle.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

// Parses and formats in one step for the view layer.
//
// Parsing is stateful (it owns the parser's memo cache) so it stays here rather
// than moving to Swift; formatting itself is a stateless Swift call. One
// instance is owned per text input and only ever touched on the main thread.
@interface RCTMarkdownUtils : NSObject

// Nullable: both are assigned after init (props arrive after the view
// hierarchy is built), and applyMarkdownFormatting: bails out when either is
// still nil.
@property(nonatomic, nullable) RCTMarkdownStyle *markdownStyle;
@property(nonatomic, nullable) NSNumber *parserId;

- (void)applyMarkdownFormatting:
          (nonnull NSMutableAttributedString *)attributedString
      withDefaultTextAttributes:
        (nonnull NSDictionary<NSAttributedStringKey, id> *)defaultTextAttributes;

@end

NS_ASSUME_NONNULL_END
