#import <RNMarcus/RCTMarcusStyle+Codegen.h>

#import <React/RCTConversions.h>

@implementation RCTMarcusStyle (Codegen)

- (instancetype)initWithStruct:
  (const facebook::react::MarcusTextInputDecoratorViewMarkdownStyleStruct &)style {
  if (self = [super init]) {
    self.syntaxColor = RCTUIColorFromSharedColor(style.syntax.color);

    self.linkColor = RCTUIColorFromSharedColor(style.link.color);

    self.headingFontSize = style.heading.fontSize;
    self.headingScale = style.heading.scale;

    self.emojiFontSize = style.emoji.fontSize;
    self.emojiFontFamily = RCTNSStringFromString(style.emoji.fontFamily);

    self.blockquoteBorderColor =
      RCTUIColorFromSharedColor(style.blockquote.borderColor);
    self.blockquoteBorderWidth = style.blockquote.borderWidth;
    self.blockquoteMarginLeft = style.blockquote.marginLeft;
    self.blockquotePaddingLeft = style.blockquote.paddingLeft;

    self.orderedListMarginLeft = style.orderedList.marginLeft;
    self.orderedListPaddingLeft = style.orderedList.paddingLeft;

    self.unorderedListMarginLeft = style.unorderedList.marginLeft;
    self.unorderedListPaddingLeft = style.unorderedList.paddingLeft;

    self.codeFontFamily = RCTNSStringFromString(style.code.fontFamily);
    self.codeFontSize = style.code.fontSize;
    self.codeColor = RCTUIColorFromSharedColor(style.code.color);
    self.codeBackgroundColor =
      RCTUIColorFromSharedColor(style.code.backgroundColor);

    self.preFontFamily = RCTNSStringFromString(style.pre.fontFamily);
    self.preFontSize = style.pre.fontSize;
    self.preColor = RCTUIColorFromSharedColor(style.pre.color);
    self.preBackgroundColor =
      RCTUIColorFromSharedColor(style.pre.backgroundColor);

    self.mentionHereColor = RCTUIColorFromSharedColor(style.mentionHere.color);
    self.mentionHereBackgroundColor =
      RCTUIColorFromSharedColor(style.mentionHere.backgroundColor);
    self.mentionHereBorderRadius = style.mentionHere.borderRadius;

    self.mentionUserColor = RCTUIColorFromSharedColor(style.mentionUser.color);
    self.mentionUserBackgroundColor =
      RCTUIColorFromSharedColor(style.mentionUser.backgroundColor);
    self.mentionUserBorderRadius = style.mentionUser.borderRadius;

    self.mentionReportColor =
      RCTUIColorFromSharedColor(style.mentionReport.color);
    self.mentionReportBackgroundColor =
      RCTUIColorFromSharedColor(style.mentionReport.backgroundColor);
    self.mentionReportBorderRadius = style.mentionReport.borderRadius;
  }

  return self;
}

@end
