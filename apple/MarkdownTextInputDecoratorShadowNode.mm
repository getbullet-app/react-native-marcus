// Objective-C++ half of MarkdownTextInputDecoratorShadowNode.
//
// Everything that needs to cross into Objective-C lives here; the rest of the
// class is plain C++ in MarkdownTextInputDecoratorShadowNode.cpp. Splitting a
// class across translation units is fine -- these are just two object files
// that link together.

#include "MarkdownTextInputDecoratorShadowNode.h"

#import <React/RCTUtils.h>
#include <react/renderer/core/ConcreteState.h>
#include <react/renderer/textlayoutmanager/RCTAttributedTextUtils.h>

#include <atomic>
#include <memory>

#import "RCTMarkdownStyle+Codegen.h"
#import <RNMarcus/MarkdownSwiftInterop.h>

namespace facebook {
namespace react {

namespace {

using DecoratorState = ConcreteState<MarkdownTextInputDecoratorState>;

// Formats `string` in place.
//
// On the main thread only already-cached ranges are used; the parser is never
// run there. Running it waits on the markdown runtime, and on a Yoga measure
// pass that wait can outlast the watchdog
// (Expensify/react-native-live-markdown#772). On a cache miss the text is left
// unformatted for this pass and parsed in the background instead, then
// `needsRemeasure` and a state update ask for another measure so the size
// measured from unformatted text -- wrong for h1, code fonts, blockquote
// indents and emoji -- does not stick.
//
// This is rare in practice: text changes are normally parsed off the main
// thread first, so the main thread finds the ranges already cached.
void ApplyMarkdownFormatting(
    NSMutableAttributedString *string,
    NSDictionary<NSAttributedStringKey, id> *defaultTextAttributes,
    RCTMarkdownStyle *markdownStyle, NSNumber *parserId, MarkdownParser *parser,
    std::shared_ptr<std::atomic_bool> needsRemeasure,
    std::shared_ptr<const DecoratorState> state) {
  NSString *text = string.string;
  NSArray<MarkdownRange *> *markdownRanges =
      [parser cachedRangesForText:text withParserId:parserId];

  if (markdownRanges == nil) {
    if ([NSThread isMainThread]) {
      [parser
          warmCacheAsyncForText:text
                   withParserId:parserId
                     completion:^{
                       // Only ever runs for the newest text, so this cannot
                       // loop: the next measure finds the ranges cached, or the
                       // text changed again and a new measure was needed
                       // anyway.
                       if (needsRemeasure != nullptr) {
                         needsRemeasure->store(true);
                       }
                       if (state != nullptr) {
                         // Changes nothing; it exists only to schedule a
                         // commit. updateState() is safe from any thread and
                         // handles an already-gone family.
                         state->updateState(MarkdownTextInputDecoratorState{});
                       }
                     }];
      return;
    }

    // Background threads may parse inline: the watchdog only applies to the
    // main thread, and parsing no longer holds a lock the main thread waits on.
    markdownRanges = [parser parse:text withParserId:parserId];
  }

  [MarkdownFormatter formatAttributedString:string
                      defaultTextAttributes:defaultTextAttributes
                                     ranges:markdownRanges
                                      style:markdownStyle];
}

} // namespace

Float MarkdownTextInputDecoratorShadowNode::fontSizeMultiplier() {
  return RCTFontSizeMultiplier();
}

void MarkdownTextInputDecoratorShadowNode::
    applyMarkdownFormattingToTextInputState(
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

  // The parser is shared process-wide, so its cache survives the cloning that
  // happens during layout without this node having to hold on to it.
  MarkdownParser *parser = [MarkdownParser sharedParser];

  if (!needsRemeasure_) {
    needsRemeasure_ = std::make_shared<std::atomic_bool>(false);
  }

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
    ApplyMarkdownFormatting(
        newString, defaultNSTextAttributes, markdownStyle, parserId, parser,
        needsRemeasure_,
        std::static_pointer_cast<const DecoratorState>(getState()));

    // create a clone of the old TextInputState and update the
    // attributed string box to point to the string with markdown
    // applied
    newStateData.attributedStringBox =
        RCTAttributedStringBoxFromNSAttributedString(newString);
  } else if (stateData.attributedStringBox.getMode() ==
             AttributedStringBox::Mode::OpaquePointer) {

    // apply markdown
    NSMutableAttributedString *newString = [nsAttributedString mutableCopy];
    ApplyMarkdownFormatting(
        newString, defaultNSTextAttributes, markdownStyle, parserId, parser,
        needsRemeasure_,
        std::static_pointer_cast<const DecoratorState>(getState()));

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
