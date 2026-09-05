#import <RNMarcus/RCTMarcusStyle.h>

#import <React/RCTConversions.h>

NS_ASSUME_NONNULL_BEGIN

// Conversion from the codegen props struct lives in a separate header so that
// `RCTMarcusStyle.h` itself stays free of C++. Only the component views and the
// shadow nodes need this one; everything downstream can import the plain header.
//
// It is a template rather than an initialiser because codegen emits a separate
// struct type per component even when the shape is identical, and both
// decorators take the same style. The shape is held together on the JavaScript
// side instead, by the assignability assertion in
// `MarcusTextDecoratorViewNativeComponent.ts`.
template <typename MarkdownStyleStruct>
static inline RCTMarcusStyle *
RCTMarcusStyleFromStruct(const MarkdownStyleStruct &style) {
  RCTMarcusStyle *result = [RCTMarcusStyle new];

  result.syntaxColor = RCTUIColorFromSharedColor(style.syntax.color);

  result.linkColor = RCTUIColorFromSharedColor(style.link.color);

  result.headingFontSize = style.heading.fontSize;
  result.headingScale = style.heading.scale;

  result.emojiFontSize = style.emoji.fontSize;
  result.emojiFontFamily = RCTNSStringFromString(style.emoji.fontFamily);

  result.blockquoteBorderColor =
    RCTUIColorFromSharedColor(style.blockquote.borderColor);
  result.blockquoteBorderWidth = style.blockquote.borderWidth;
  result.blockquoteMarginLeft = style.blockquote.marginLeft;
  result.blockquotePaddingLeft = style.blockquote.paddingLeft;

  result.orderedListMarginLeft = style.orderedList.marginLeft;
  result.orderedListPaddingLeft = style.orderedList.paddingLeft;
  result.orderedListMarkerScale = style.orderedList.markerScale;
  result.orderedListMarkerPadding = style.orderedList.markerPadding;

  result.unorderedListMarginLeft = style.unorderedList.marginLeft;
  result.unorderedListPaddingLeft = style.unorderedList.paddingLeft;
  result.unorderedListMarkerScale = style.unorderedList.markerScale;
  result.unorderedListMarkerPadding = style.unorderedList.markerPadding;

  result.codeFontFamily = RCTNSStringFromString(style.code.fontFamily);
  result.codeFontSize = style.code.fontSize;
  result.codeColor = RCTUIColorFromSharedColor(style.code.color);
  result.codeBackgroundColor =
    RCTUIColorFromSharedColor(style.code.backgroundColor);
  result.codeBorderRadius = style.code.borderRadius;
  result.codePadding = style.code.padding;
  result.codeMargin = style.code.margin;

  result.preFontFamily = RCTNSStringFromString(style.pre.fontFamily);
  result.preFontSize = style.pre.fontSize;
  result.preColor = RCTUIColorFromSharedColor(style.pre.color);
  result.preBackgroundColor =
    RCTUIColorFromSharedColor(style.pre.backgroundColor);
  result.preBorderRadius = style.pre.borderRadius;
  result.prePadding = style.pre.padding;
  result.preMargin = style.pre.margin;

  result.mentionColor = RCTUIColorFromSharedColor(style.mention.color);
  result.mentionBackgroundColor =
    RCTUIColorFromSharedColor(style.mention.backgroundColor);
  result.mentionBorderRadius = style.mention.borderRadius;
  result.mentionPadding = style.mention.padding;
  result.mentionMargin = style.mention.margin;

  return result;
}

NS_ASSUME_NONNULL_END
