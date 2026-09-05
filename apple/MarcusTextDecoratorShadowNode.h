#pragma once

#include <react/renderer/components/RNMarcusSpec/EventEmitters.h>
#include <react/renderer/components/RNMarcusSpec/MarcusTextDecoratorState.h>
#include <react/renderer/components/RNMarcusSpec/Props.h>

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/core/LayoutContext.h>
#include <react/renderer/textlayoutmanager/TextLayoutManager.h>

#include <memory>

namespace facebook {
namespace react {

JSI_EXPORT extern const char MarcusTextDecoratorViewComponentName[];

/*
 * Wraps a `Text` and swaps the text layout manager underneath it.
 *
 * Deliberately much less invasive than its `TextInput` counterpart. A paragraph
 * measures itself through its own layout manager, so replacing that manager is
 * enough to reach measurement, drawing and hit testing alike -- there is no
 * Yoga measure callback to hijack, no cast past `private`, and no state to
 * write into. All that is left of the original technique is unsetting
 * `ForceFlattenView` so the decorator gets a host view, and copying the child's
 * layout metrics back up so wrapping it changes nothing about layout.
 */
class JSI_EXPORT MarcusTextDecoratorShadowNode final
    : public ConcreteViewShadowNode<MarcusTextDecoratorViewComponentName, MarcusTextDecoratorViewProps, MarcusTextDecoratorViewEventEmitter, MarcusTextDecoratorState> {
public:
  MarcusTextDecoratorShadowNode(ShadowNodeFragment const &fragment, ShadowNodeFamily::Shared const &family, ShadowNodeTraits traits);

  MarcusTextDecoratorShadowNode(ShadowNode const &sourceShadowNode, ShadowNodeFragment const &fragment);

  void
  appendChild(const std::shared_ptr<const ShadowNode> &child) override;

  void
  replaceChild(const ShadowNode &oldChild, const std::shared_ptr<const ShadowNode> &newChild, size_t suggestedIndex = SIZE_MAX) override;

  void
  layout(LayoutContext layoutContext) override;

private:
  void
  initialize();

  void
  makeChildNodeMutable();

  void
  createTextLayoutManager();

  void
  overwriteTextLayoutManager();

  std::shared_ptr<const TextLayoutManager> textLayoutManager_;
};

} // namespace react
} // namespace facebook
