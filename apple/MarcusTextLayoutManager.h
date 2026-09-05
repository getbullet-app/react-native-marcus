#pragma once

#import <Foundation/Foundation.h>

#import <RNMarcus/MarcusRange.h>
#import <RNMarcus/RCTMarcusStyle.h>

#include <react/renderer/textlayoutmanager/TextLayoutManager.h>

#include <memory>

namespace facebook {
namespace react {

/*
 * A `TextLayoutManager` that formats before it lays out.
 *
 * Everything `RCTParagraphComponentView` does with text -- measuring it,
 * drawing it, hit-testing it, enumerating its lines -- goes through the
 * `RCTTextLayoutManager` this owns, and each of those paths converts the
 * shadow tree's `AttributedString` into an `NSAttributedString` first. That
 * conversion is the only place markdown has to be applied, which is why the
 * `Text` decorator needs none of the measure-callback surgery the `TextInput`
 * one does: handing the child paragraph one of these covers every path at once.
 *
 * Immutable once constructed. The decorator builds a new one when its props
 * change rather than mutating this, so the commit thread is never writing style
 * or ranges while the main thread draws with them.
 */
class MarcusTextLayoutManager : public TextLayoutManager {
public:
  MarcusTextLayoutManager(
    const std::shared_ptr<const ContextContainer> &contextContainer,
    NSArray<MarcusRange *> *ranges,
    RCTMarcusStyle *markdownStyle
  );
};

} // namespace react
} // namespace facebook
