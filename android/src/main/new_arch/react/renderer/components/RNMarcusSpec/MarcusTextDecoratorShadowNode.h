#pragma once

#include <react/renderer/components/RNMarcusSpec/EventEmitters.h>
#include <react/renderer/components/RNMarcusSpec/MarcusTextDecoratorState.h>
#include <react/renderer/components/RNMarcusSpec/Props.h>

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/core/LayoutContext.h>

namespace facebook {
namespace react {

JSI_EXPORT extern const char MarcusTextDecoratorViewComponentName[];

/*
 * Wraps a `Text` and gives the paragraph underneath it a text layout manager
 * that formats before it measures.
 *
 * The measure half of the story only. Android builds a second spannable on the
 * UI thread when the text is mounted, and the callback React Native offers
 * there belongs to the view manager rather than to one `Text`, so that half is
 * `MarcusTextDecoratorView`'s job.
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
  std::shared_ptr<const ContextContainer> customContextContainer_;
  folly::dynamic previousMarkdownStyle_;
  folly::dynamic previousRanges_;

  void
  initialize();

  void
  overwriteTextLayoutManager();

  void
  createCustomContextContainer();

  void
  updateCustomContextContainerIfNeeded();

  void
  makeChildNodeMutable();
};

} // namespace react
} // namespace facebook
