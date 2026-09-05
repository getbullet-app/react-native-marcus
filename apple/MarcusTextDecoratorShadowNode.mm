#import <RNMarcus/MarcusTextDecoratorShadowNode.h>

#import <RNMarcus/MarcusTextLayoutManager.h>
#import <RNMarcus/RCTMarcusStyle+Codegen.h>

#import <react/renderer/components/text/ParagraphShadowNode.h>
#import <react/renderer/core/ComponentDescriptor.h>

namespace facebook {
namespace react {

extern const char MarcusTextDecoratorViewComponentName[] =
  "MarcusTextDecoratorView";

MarcusTextDecoratorShadowNode::MarcusTextDecoratorShadowNode(
  ShadowNodeFragment const &fragment,
  ShadowNodeFamily::Shared const &family,
  ShadowNodeTraits traits
)
    : ConcreteViewShadowNode(fragment, family, traits) {
  initialize();
  createTextLayoutManager();
  makeChildNodeMutable();

  if (fragment.children) {
    overwriteTextLayoutManager();
  }
}

MarcusTextDecoratorShadowNode::MarcusTextDecoratorShadowNode(
  ShadowNode const &sourceShadowNode,
  ShadowNodeFragment const &fragment
)
    : ConcreteViewShadowNode(sourceShadowNode, fragment) {
  initialize();

  const auto &sourceDecorator =
    static_cast<const MarcusTextDecoratorShadowNode &>(sourceShadowNode);
  textLayoutManager_ = sourceDecorator.textLayoutManager_;

  // Fabric hands a clone the very same props object whenever nothing about the
  // props changed, so pointer identity is both exact and cheap here. Codegen
  // only emits `operator==` for prop structs under RN_SERIALIZABLE_STATE, which
  // iOS does not define, and hand-written equality over the style would rot the
  // moment a field is added.
  if (textLayoutManager_ == nullptr ||
      getProps().get() != sourceDecorator.getProps().get()) {
    createTextLayoutManager();
  }

  makeChildNodeMutable();

  if (fragment.children) {
    overwriteTextLayoutManager();
  }
}

void
MarcusTextDecoratorShadowNode::initialize() {
  // Setting display: contents style results in ForceFlattenView trait being set
  // on the shadow node. This trait causes the node not to have a host view. By
  // removing the trait, it's possible to force RN to create a host view, layout
  // of which can then be customized.
  ShadowNode::traits_.unset(ShadowNodeTraits::ForceFlattenView);
}

void
MarcusTextDecoratorShadowNode::makeChildNodeMutable() {
  // When the decorator is cloned and has a child node, the child node should be
  // cloned as well to ensure it is mutable. Cloning it also runs the paragraph's
  // own component descriptor, which resets the layout manager to the shared one
  // -- hence overwriteTextLayoutManager() always following this, never the other
  // way around.
  const auto &children = getChildren();
  if (!children.empty()) {
    react_native_assert(
      children.size() == 1 &&
      "MarcusTextDecoratorView received more than one child"
    );

    const auto clonedChild = children[0]->clone({});
    replaceChild(*children[0], clonedChild);
  }
}

void
MarcusTextDecoratorShadowNode::createTextLayoutManager() {
  const auto &props = getConcreteProps();

  NSMutableArray<MarcusRange *> *ranges =
    [NSMutableArray arrayWithCapacity:props.ranges.size()];

  for (const auto &range : props.ranges) {
    [ranges addObject:[[MarcusRange alloc]
                        initWithType:RCTNSStringFromString(range.type)
                               range:NSMakeRange(range.start, range.length)
                               depth:static_cast<NSUInteger>(range.depth)]];
  }

  textLayoutManager_ = std::make_shared<const MarcusTextLayoutManager>(
    getContextContainer(),
    ranges,
    RCTMarcusStyleFromStruct(props.markdownStyle)
  );
}

void
MarcusTextDecoratorShadowNode::overwriteTextLayoutManager() {
  const auto &children = getChildren();
  if (children.empty()) {
    return;
  }
  react_native_assert(
    children.size() == 1 &&
    "MarcusTextDecoratorView received more than one child"
  );

  const auto child =
    std::dynamic_pointer_cast<const ParagraphShadowNode>(children[0]);

  react_native_assert(
    child != nullptr &&
    "MarcusTextDecoratorView received child other than a Text"
  );

  if (child == nullptr) {
    return;
  }

  child->ensureUnsealed();

  const auto mutableChild =
    std::const_pointer_cast<ParagraphShadowNode>(child);
  mutableChild->setTextLayoutManager(textLayoutManager_);
}

void
MarcusTextDecoratorShadowNode::appendChild(
  const std::shared_ptr<const ShadowNode> &child
) {
  YogaLayoutableShadowNode::appendChild(child);

  overwriteTextLayoutManager();
}

void
MarcusTextDecoratorShadowNode::replaceChild(
  const ShadowNode &oldChild,
  const std::shared_ptr<const ShadowNode> &newChild,
  size_t suggestedIndex
) {
  YogaLayoutableShadowNode::replaceChild(oldChild, newChild, suggestedIndex);

  overwriteTextLayoutManager();
}

void
MarcusTextDecoratorShadowNode::layout(LayoutContext layoutContext) {
  YogaLayoutableShadowNode::layout(layoutContext);

  const auto &children = getChildren();
  react_native_assert(
    children.size() == 1 &&
    "MarcusTextDecoratorView didn't receive exactly one child"
  );

  if (children.size() != 1) {
    return;
  }

  auto child =
    std::static_pointer_cast<const YogaLayoutableShadowNode>(children[0]);
  child->ensureUnsealed();
  auto mutableChild = std::const_pointer_cast<YogaLayoutableShadowNode>(child);

  // Since nodes with display: contents are skipped during layout, they have
  // zero-layout. To properly display the view, assign the layout metrics from
  // the child (the paragraph, which was calculated by Yoga) to the decorator
  // view.
  auto childMetrics = child->getLayoutMetrics();
  setLayoutMetrics(childMetrics); // makes a copy

  // Then, it's also needed to update the metrics on the child as the position
  // is relative to the parent, which was just moved above. By zeroing the
  // origin, the child is effectively moved to the same position it was before
  // the manipulation here.
  childMetrics.frame.origin = Point{};
  mutableChild->setLayoutMetrics(childMetrics);
}

} // namespace react
} // namespace facebook
