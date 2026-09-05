#import <RNMarcus/MarcusTextDecoratorViewManager.h>

@implementation MarcusTextDecoratorViewManager

RCT_EXPORT_MODULE(MarcusTextDecoratorView)

RCT_EXPORT_VIEW_PROPERTY(markdownStyle, NSDictionary)

RCT_EXPORT_VIEW_PROPERTY(ranges, NSArray)

@end
