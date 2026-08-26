// Objective-C++ half of MarkdownTextInputDecoratorShadowNode.
//
// Everything that needs to cross into Objective-C lives here; the rest of the
// class is plain C++ in MarkdownTextInputDecoratorShadowNode.cpp. Splitting a
// class across translation units is fine -- these are just two object files
// that link together.

#include "MarkdownTextInputDecoratorShadowNode.h"

#import <React/RCTUtils.h>
#include <react/renderer/textlayoutmanager/RCTAttributedTextUtils.h>

#import "RCTMarkdownStyle+Codegen.h"
#import <RNLiveMarkdown/MarkdownParser.h>
#import <RNLiveMarkdown/MarkdownSwiftInterop.h>

namespace facebook {
namespace react {

Float MarkdownTextInputDecoratorShadowNode::fontSizeMultiplier() {
  return RCTFontSizeMultiplier();
}

void MarkdownTextInputDecoratorShadowNode::applyMarkdownFormattingToTextInputState(
    std::shared_ptr<TextInputShadowNode> textInput,
    const LayoutContext &layoutContext) const {

  const auto &textInputState =
      *std::static_pointer_cast<const react::ConcreteState<TextInputState>>(
          textInput->getState());
  const auto &stateData = textInputState.getData();
  const auto fontSizeMultiplier = layoutContext.fontSizeMultiplier;

  const auto &decoratorProps =
      *std::static_pointer_cast<MarkdownTextInputDecoratorViewProps const>(
          getProps());
  const auto &textInputProps =
      *std::static_pointer_cast<TextInputProps const>(textInput->getProps());

  const auto defaultTextAttributes =
      textInputProps.getEffectiveTextAttributes(fontSizeMultiplier);
  const auto defaultNSTextAttributes =
      RCTNSTextAttributesFromTextAttributes(defaultTextAttributes);

  // Lazily create and persist the parser so its memo cache survives repeated
  // Yoga measure callbacks instead of being discarded on every call.
  if (!markdownParser_) {
    MarkdownParser *freshParser = [[MarkdownParser alloc] init];
    markdownParser_ = std::shared_ptr<void>(
        (__bridge_retained void *)freshParser, [](void *p) { CFRelease(p); });
  }
  MarkdownParser *parser = (__bridge MarkdownParser *)markdownParser_.get();

  RCTMarkdownStyle *markdownStyle =
      [[RCTMarkdownStyle alloc] initWithStruct:decoratorProps.markdownStyle];
  NSNumber *parserId = [NSNumber numberWithInt:decoratorProps.parserId];

  // convert the attibuted string stored in state to
  // NSAttributedString
  auto nsAttributedString = RCTNSAttributedStringFromAttributedStringBox(
      stateData.attributedStringBox);

  auto newStateData = TextInputState(stateData);

  if (stateData.attributedStringBox.getMode() ==
      AttributedStringBox::Mode::Value) {

    // Handles the first render, where the text stored in props is
    // different than the one stored in state. The one in state is empty,
    // while the one in props is passed from JS. If we don't update the
    // state here, we'll end up with a one-default-line-sized text input
    if (textInputState.getRevision() == State::initialRevisionValue) {
      auto plainStringFromState =
          std::string([[nsAttributedString string] UTF8String]);

      if (plainStringFromState != textInputProps.text) {
        // creates new AttributedString from props, adapted from
        // TextInputShadowNode (ios one, text inputs are
        // platform-specific)
        auto attributedString = AttributedString{};
        attributedString.appendFragment(AttributedString::Fragment{
            textInputProps.text, defaultTextAttributes});

        auto attachments = BaseTextShadowNode::Attachments{};
        BaseTextShadowNode::buildAttributedString(
            defaultTextAttributes, *textInput, attributedString, attachments);

        // convert the newly created attributed string to
        // NSAttributedString
        nsAttributedString = RCTNSAttributedStringFromAttributedStringBox(
            AttributedStringBox{attributedString});
      }
    }

    // apply markdown
    NSMutableAttributedString *newString = [nsAttributedString mutableCopy];
    NSArray<MarkdownRange *> *markdownRanges = [parser parse:newString.string
                                                withParserId:parserId];
    [MarkdownFormatter formatAttributedString:newString
                        defaultTextAttributes:defaultNSTextAttributes
                                       ranges:markdownRanges
                                        style:markdownStyle];

    // create a clone of the old TextInputState and update the
    // attributed string box to point to the string with markdown
    // applied
    newStateData.attributedStringBox =
        RCTAttributedStringBoxFromNSAttributedString(newString);
  } else if (stateData.attributedStringBox.getMode() ==
             AttributedStringBox::Mode::OpaquePointer) {

    // apply markdown
    NSMutableAttributedString *newString = [nsAttributedString mutableCopy];
    NSArray<MarkdownRange *> *markdownRanges = [parser parse:newString.string
                                                withParserId:parserId];
    [MarkdownFormatter formatAttributedString:newString
                        defaultTextAttributes:defaultNSTextAttributes
                                       ranges:markdownRanges
                                        style:markdownStyle];

    // create a clone of the old TextInputState and update the
    // attributed string box to point to the string with markdown
    // applied
    newStateData.attributedStringBox =
        RCTAttributedStringBoxFromNSAttributedString(newString);
  }

  textInput->setStateData(std::move(newStateData));
}

} // namespace react
} // namespace facebook
