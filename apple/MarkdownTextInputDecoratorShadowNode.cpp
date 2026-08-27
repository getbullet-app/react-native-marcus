#include "MarkdownTextInputDecoratorShadowNode.h"

#include <react/renderer/components/view/conversions.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <yoga/Yoga.h>

namespace facebook {
namespace react {

extern const char MarkdownTextInputDecoratorViewComponentName[] =
    "MarkdownTextInputDecoratorView";

MarkdownTextInputDecoratorShadowNode::MarkdownTextInputDecoratorShadowNode(
    ShadowNodeFragment const &fragment,
    ShadowNodeFamily::Shared const &family,
    ShadowNodeTraits traits)
    : ConcreteViewShadowNode(fragment, family, traits) {
  initialize();
  makeChildNodeMutable();
  
  if (fragment.children) {
    overwriteMeasureCallbackConnector();
  }
}

MarkdownTextInputDecoratorShadowNode::MarkdownTextInputDecoratorShadowNode(
    ShadowNode const &sourceShadowNode,
    ShadowNodeFragment const &fragment)
    : ConcreteViewShadowNode(sourceShadowNode, fragment) {
  // Carry the persisted parser over from the source node so its memo cache
  // survives the frequent cloning that happens during layout and re-render
  // cycles.
  const auto &source =
      static_cast<const MarkdownTextInputDecoratorShadowNode &>(sourceShadowNode);
  markdownParser_ = source.markdownParser_;
  needsRemeasure_ = source.needsRemeasure_;

  initialize();
  makeChildNodeMutable();
  
  if (fragment.children) {
    overwriteMeasureCallbackConnector();
  }
}

void MarkdownTextInputDecoratorShadowNode::initialize() {
  // Setting display: contents style results in ForceFlattenView trait being set
  // on the shadow node. This trait causes the node not to have a host view. By
  // removing the trait, it's possible to force RN to create a host view, layout
  // of which can then be customized.
  ShadowNode::traits_.unset(ShadowNodeTraits::ForceFlattenView);
}

void MarkdownTextInputDecoratorShadowNode::makeChildNodeMutable() {
  // When the decorator is cloned and has a child node, the child node should be
  // cloned as well to ensure it is mutable.
  const auto &children = getChildren();
  if (!children.empty()) {
    react_native_assert(
        children.size() == 1 &&
        "MarkdownTextInputDecoratorView received more than one child");

    const auto clonedChild = children[0]->clone({});
    replaceChild(*children[0], clonedChild);
  }
}

void MarkdownTextInputDecoratorShadowNode::overwriteMeasureCallbackConnector() {
  const auto &children = getChildren();
  if (children.empty()) {
    return;
  }
  react_native_assert(
      children.size() == 1 &&
      "MarkdownTextInputDecoratorView received more than one child");

  const auto child = std::dynamic_pointer_cast<const TextInputShadowNode>(children[0]);
  react_native_assert(
      child != nullptr &&
      "MarkdownTextInputDecoratorView received child other than a TextInput");
  child->ensureUnsealed();

  // This is obviously not correct, but since both MarkdownTextInputDecoratorShadowNode and
  // TextInputShadowNode inherit from YogaLayoutableShadowNode by doing this cast it's
  // possible to access protected members from TextInputShadowNode like yogaNode_.
  // As only things from YogaLayoutableShadowNode are accessed, it should be safe,
  // since the vtable should be the same between them.
  const auto &nodeWithAccessibleYogaNode =
      std::reinterpret_pointer_cast<const MarkdownTextInputDecoratorShadowNode>(child);

  // decorator node cannot have a measure function since it's not a leaf node
  // but we can redirect measuring of the child input to call measureContent
  // on the decorator
  const auto &yogaNode = &nodeWithAccessibleYogaNode->yogaNode_;
  YGNodeSetMeasureFunc(yogaNode, yogaNodeMeasureCallbackConnector);

  // If a background parse finished since the last layout, the size Yoga has for
  // the child was measured from unformatted text. Nothing dirties this part of
  // the tree on its own -- Yoga never measures the decorator -- so the stale
  // height would stick until something else changed the layout.
  //
  // Both nodes are marked by hand rather than via YGNodeMarkDirty(): the child
  // is usually already dirty from completeClone(), which stops the flag
  // propagating upwards and would leave the decorator clean. Parents pick it up
  // themselves when updateYogaChildren() runs.
  if (needsRemeasure_ != nullptr && needsRemeasure_->exchange(false)) {
    yogaNode->setDirty(true);
    yogaNode_.setDirty(true);
  }
}

void MarkdownTextInputDecoratorShadowNode::appendChild(
    const std::shared_ptr<const ShadowNode> &child) {
  YogaLayoutableShadowNode::appendChild(child);

  overwriteMeasureCallbackConnector();
}

void MarkdownTextInputDecoratorShadowNode::replaceChild(
    const ShadowNode &oldChild, const std::shared_ptr<const ShadowNode> &newChild,
    size_t suggestedIndex) {
  YogaLayoutableShadowNode::replaceChild(oldChild, newChild, suggestedIndex);

  overwriteMeasureCallbackConnector();
};

Size MarkdownTextInputDecoratorShadowNode::measureContent(
    const LayoutContext &layoutContext,
    const LayoutConstraints &layoutConstraints) const {
  const auto &children = getChildren();
  react_native_assert(
      children.size() == 1 &&
      "MarkdownTextInputDecoratorView received wrong number of children");

  const auto child =
      std::static_pointer_cast<const TextInputShadowNode>(children[0]);

  child->ensureUnsealed();

  // apply markdown formatting before measuring the child
  const auto &mutableChild =
      std::const_pointer_cast<TextInputShadowNode>(child);
  applyMarkdownFormattingToTextInputState(mutableChild, layoutContext);

  const auto childWithMeasureContentAccess =
      std::static_pointer_cast<const YogaLayoutableShadowNode>(child);
  return childWithMeasureContentAccess->measureContent(layoutContext, layoutConstraints);
}

void MarkdownTextInputDecoratorShadowNode::layout(LayoutContext layoutContext) {
  YogaLayoutableShadowNode::layout(layoutContext);

  const auto &children = getChildren();
  react_native_assert(
      children.size() == 1 &&
      "MarkdownTextInputDecoratorView didn't receive exactly one child");

  const auto child =
      std::static_pointer_cast<const TextInputShadowNode>(children[0]);

  child->ensureUnsealed();

  const auto &mutableChild =
      std::const_pointer_cast<TextInputShadowNode>(child);

  // TODO: this may not be the correct way to do this
  // Since nodes with display: contents are skipped during layout, they have
  // zero-layout. To properly display the view, assign the layout metrics from
  // the child (text input, which was calculated by Yoga) to the decorator view.
  auto childMetrics = child->getLayoutMetrics();
  setLayoutMetrics(childMetrics);

  // Then, it's also needed to update the metrics on the child as the position
  // is relative to the parent, which was just moved above. By zeroing the
  // origin, the child is effectively moved to the same position it was before
  // the manipulation here.
  childMetrics.frame.origin = Point{};
  mutableChild->setLayoutMetrics(childMetrics);
}


// this is private in YogaLayoutableShadowNode
YGSize MarkdownTextInputDecoratorShadowNode::yogaNodeMeasureCallbackConnector(
    YGNodeConstRef yogaNode, float width, YGMeasureMode widthMode, float height,
    YGMeasureMode heightMode) {

  auto minimumSize = Size{0, 0};
  auto maximumSize = Size{std::numeric_limits<Float>::infinity(),
                          std::numeric_limits<Float>::infinity()};

  switch (widthMode) {
  case YGMeasureModeUndefined:
    break;
  case YGMeasureModeExactly:
    minimumSize.width = floatFromYogaFloat(width);
    maximumSize.width = floatFromYogaFloat(width);
    break;
  case YGMeasureModeAtMost:
    maximumSize.width = floatFromYogaFloat(width);
    break;
  }

  switch (heightMode) {
  case YGMeasureModeUndefined:
    break;
  case YGMeasureModeExactly:
    minimumSize.height = floatFromYogaFloat(height);
    maximumSize.height = floatFromYogaFloat(height);
    break;
  case YGMeasureModeAtMost:
    maximumSize.height = floatFromYogaFloat(height);
    break;
  }

  // This is where changes begin compared to the copied code
  const auto &decoratorYogaNode = YGNodeGetParent(const_cast<YGNodeRef>(yogaNode));
  const auto &decoratorShadowNode = shadowNodeFromContext(decoratorYogaNode);

  LayoutContext context{};
  context.fontSizeMultiplier = fontSizeMultiplier();

  const auto size = decoratorShadowNode.measureContent(context, {minimumSize, maximumSize});

  return YGSize{yogaFloatFromFloat(size.width),
                yogaFloatFromFloat(size.height)};
}

// this is private in YogaLayoutableShadowNode
YogaLayoutableShadowNode &
MarkdownTextInputDecoratorShadowNode::shadowNodeFromContext(
    YGNodeConstRef yogaNode) {
  return dynamic_cast<YogaLayoutableShadowNode &>(
      *static_cast<ShadowNode *>(YGNodeGetContext(yogaNode)));
}

} // namespace react
} // namespace facebook
