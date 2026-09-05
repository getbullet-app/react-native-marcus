#include "MarcusTextDecoratorShadowNode.h"

#include <fbjni/fbjni.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/jni/ReadableNativeArray.h>
#include <react/jni/ReadableNativeMap.h>
#if REACT_NATIVE_MINOR_VERSION < 80
#include <react/jni/SafeReleaseJniRef.h>
#endif // REACT_NATIVE_MINOR_VERSION < 80
#include <react/renderer/components/text/ParagraphShadowNode.h>
#include <react/renderer/components/view/conversions.h>
#include <react/renderer/core/ComponentDescriptor.h>

namespace facebook {
namespace react {

extern const char MarcusTextDecoratorViewComponentName[] =
  "MarcusTextDecoratorView";

MarcusTextDecoratorShadowNode::MarcusTextDecoratorShadowNode(
  ShadowNodeFragment const &fragment, ShadowNodeFamily::Shared const &family, ShadowNodeTraits traits
)
    : ConcreteViewShadowNode(fragment, family, traits) {
  initialize();
  createCustomContextContainer();
  makeChildNodeMutable();

  if (fragment.children) {
    overwriteTextLayoutManager();
  }
}

MarcusTextDecoratorShadowNode::MarcusTextDecoratorShadowNode(
  ShadowNode const &sourceShadowNode, ShadowNodeFragment const &fragment
)
    : ConcreteViewShadowNode(sourceShadowNode, fragment) {
  initialize();

  const auto &sourceDecorator =
    static_cast<const MarcusTextDecoratorShadowNode &>(sourceShadowNode);

  customContextContainer_ = sourceDecorator.customContextContainer_;
  previousMarkdownStyle_ = sourceDecorator.previousMarkdownStyle_;
  previousRanges_ = sourceDecorator.previousRanges_;

  updateCustomContextContainerIfNeeded();
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
  // own component descriptor, which resets the layout manager to the shared one,
  // so overwriteTextLayoutManager() always follows this rather than preceding it.
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
MarcusTextDecoratorShadowNode::createCustomContextContainer() {
  static const auto customFabricUIManagerClass =
    jni::findClassStatic("app/getbullet/marcus/CustomFabricUIManager");
  static const auto createMethod =
    customFabricUIManagerClass->getStaticMethod<JFabricUIManager::javaobject(
      JFabricUIManager::javaobject, ReadableMap::javaobject, ReadableArray::javaobject
    )>(
      "createForText"
    );

  const auto &rawProps = this->getProps()->rawProps;
  const auto &markdownStyleIt = rawProps.find("markdownStyle");
  const auto &markdownStyle = markdownStyleIt != rawProps.items().end()
                                ? markdownStyleIt->second
                                : previousMarkdownStyle_;
  const auto &rangesIt = rawProps.find("ranges");
  const auto &ranges =
    rangesIt != rawProps.items().end() ? rangesIt->second : previousRanges_;

  const auto decoratorPropsRNM =
    ReadableNativeMap::newObjectCxxArgs(markdownStyle);
  const auto decoratorPropsRM = jni::make_local(
    reinterpret_cast<ReadableMap::javaobject>(decoratorPropsRNM.get())
  );

  // An absent or malformed prop still has to produce an array: the Java side
  // takes one, and an empty one simply formats nothing.
  const auto rangesRNA = ReadableNativeArray::newObjectCxxArgs(
    ranges.isArray() ? ranges : folly::dynamic::array()
  );
  const auto rangesRA = jni::make_local(
    reinterpret_cast<ReadableArray::javaobject>(rangesRNA.get())
  );

  const auto &fabricUIManager =
    this->getContextContainer()->at<JFabricUIManager::javaobject>(
      "FabricUIManager"
    );

  const auto customFabricUIManager = SafeReleaseJniRef(
    jni::make_global(createMethod(customFabricUIManagerClass, fabricUIManager, decoratorPropsRM.get(), rangesRA.get()))
  );
  const auto contextContainer = std::make_shared<ContextContainer const>();
  contextContainer->insert("FabricUIManager", customFabricUIManager);

  customContextContainer_ = contextContainer;
  previousMarkdownStyle_ = markdownStyle;
  previousRanges_ = ranges;
}

void
MarcusTextDecoratorShadowNode::updateCustomContextContainerIfNeeded() {
  const auto &rawProps = this->getProps()->rawProps;
  const auto &markdownStyleIt = rawProps.find("markdownStyle");
  if (markdownStyleIt != rawProps.items().end() &&
      markdownStyleIt->second != previousMarkdownStyle_) {
    createCustomContextContainer();
    return;
  }
  const auto &rangesIt = rawProps.find("ranges");
  if (rangesIt != rawProps.items().end() &&
      rangesIt->second != previousRanges_) {
    createCustomContextContainer();
  }
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
  mutableChild->setTextLayoutManager(
    std::make_shared<TextLayoutManager>(customContextContainer_)
  );
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
  auto childMetrics = child->getLayoutMetrics(); // makes a copy
  setLayoutMetrics(childMetrics);

  // Then, it's also needed to update the metrics on the child as the position
  // is relative to the parent, which was just moved above. By zeroing the
  // origin, the child is effectively moved to the same position it was before
  // the manipulation here.
  childMetrics.frame.origin = Point{};
  mutableChild->setLayoutMetrics(childMetrics);
}

} // namespace react
} // namespace facebook
