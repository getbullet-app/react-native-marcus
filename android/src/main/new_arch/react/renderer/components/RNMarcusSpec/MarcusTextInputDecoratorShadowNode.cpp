#include "MarcusTextInputDecoratorShadowNode.h"

#include <fbjni/fbjni.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/jni/ReadableNativeMap.h>
#if REACT_NATIVE_MINOR_VERSION < 80
#include <react/jni/SafeReleaseJniRef.h>
#endif // REACT_NATIVE_MINOR_VERSION < 80
#include <react/renderer/components/view/conversions.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <yoga/Yoga.h>

namespace facebook {
namespace react {

extern const char MarcusTextInputDecoratorViewComponentName[] =
  "MarcusTextInputDecoratorView";

MarcusTextInputDecoratorShadowNode::MarcusTextInputDecoratorShadowNode(
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

MarcusTextInputDecoratorShadowNode::MarcusTextInputDecoratorShadowNode(
  ShadowNode const &sourceShadowNode, ShadowNodeFragment const &fragment
)
    : ConcreteViewShadowNode(sourceShadowNode, fragment) {
  initialize();

  const auto &sourceDecorator =
    static_cast<const MarcusTextInputDecoratorShadowNode &>(
      sourceShadowNode
    );

  customContextContainer_ = sourceDecorator.customContextContainer_;
  previousMarkdownStyle_ = sourceDecorator.previousMarkdownStyle_;
  previousParserId_ = sourceDecorator.previousParserId_;

  updateCustomContextContainerIfNeeded();
  makeChildNodeMutable();

  if (fragment.children) {
    overwriteTextLayoutManager();
  }
}

void
MarcusTextInputDecoratorShadowNode::initialize() {
  // Setting display: contents style results in ForceFlattenView trait being set
  // on the shadow node. This trait causes the node not to have a host view. By
  // removing the trait, it's possible to force RN to create a host view, layout
  // of which can then be customized.
  ShadowNode::traits_.unset(ShadowNodeTraits::ForceFlattenView);
}

void
MarcusTextInputDecoratorShadowNode::makeChildNodeMutable() {
  // When the decorator is cloned and has a child node, the child node should be
  // cloned as well to ensure it is mutable.
  const auto &children = getChildren();
  if (!children.empty()) {
    react_native_assert(
      children.size() == 1 &&
      "MarcusTextInputDecoratorView received more than one child"
    );

    const auto clonedChild = children[0]->clone({});
    replaceChild(*children[0], clonedChild);
  }
}

void
MarcusTextInputDecoratorShadowNode::createCustomContextContainer() {
  static const auto customFabricUIManagerClass =
    jni::findClassStatic("app/getbullet/marcus/CustomFabricUIManager");
  static const auto createMethod =
    customFabricUIManagerClass->getStaticMethod<JFabricUIManager::javaobject(
      JFabricUIManager::javaobject, ReadableMap::javaobject, int
    )>(
      "create"
    );

  const auto &rawProps = this->getProps()->rawProps;
  const auto &markdownStyleIt = rawProps.find("markdownStyle");
  const auto &markdownStyle = markdownStyleIt != rawProps.items().end()
                                ? markdownStyleIt->second
                                : previousMarkdownStyle_;
  const auto &parserIdIt = rawProps.find("parserId");
  const auto parserId = parserIdIt != rawProps.items().end()
                          ? parserIdIt->second.asInt()
                          : previousParserId_;

  const auto decoratorPropsRNM =
    ReadableNativeMap::newObjectCxxArgs(markdownStyle);
  const auto decoratorPropsRM = jni::make_local(
    reinterpret_cast<ReadableMap::javaobject>(decoratorPropsRNM.get())
  );

  const auto &fabricUIManager =
    this->getContextContainer()->at<JFabricUIManager::javaobject>(
      "FabricUIManager"
    );

  const auto customFabricUIManager = SafeReleaseJniRef(
    jni::make_global(createMethod(customFabricUIManagerClass, fabricUIManager, decoratorPropsRM.get(), parserId))
  );
  const auto contextContainer = std::make_shared<ContextContainer const>();
  contextContainer->insert("FabricUIManager", customFabricUIManager);

  customContextContainer_ = contextContainer;
  previousMarkdownStyle_ = markdownStyle;
  previousParserId_ = parserId;
}

void
MarcusTextInputDecoratorShadowNode::
  updateCustomContextContainerIfNeeded() {
  const auto &rawProps = this->getProps()->rawProps;
  const auto &markdownStyleIt = rawProps.find("markdownStyle");
  if (markdownStyleIt != rawProps.items().end() &&
      markdownStyleIt->second != previousMarkdownStyle_) {
    createCustomContextContainer();
    return;
  }
  const auto &parserIdIt = rawProps.find("parserId");
  if (parserIdIt != rawProps.items().end() &&
      parserIdIt->second.asInt() != previousParserId_) {
    createCustomContextContainer();
  }
}

void
MarcusTextInputDecoratorShadowNode::overwriteTextLayoutManager() {
  const auto &children = getChildren();
  if (children.empty()) {
    return;
  }
  react_native_assert(
    children.size() == 1 &&
    "MarcusTextInputDecoratorView received more than one child"
  );

  const auto child =
    std::dynamic_pointer_cast<const AndroidTextInputShadowNode>(children[0]);

  react_native_assert(
    child != nullptr &&
    "MarcusTextInputDecoratorView received child other than a TextInput"
  );
  child->ensureUnsealed();

  const auto mutableChild =
    std::const_pointer_cast<AndroidTextInputShadowNode>(child);
  mutableChild->setTextLayoutManager(
    std::make_shared<TextLayoutManager>(customContextContainer_)
  );
}

void
MarcusTextInputDecoratorShadowNode::appendChild(
  const std::shared_ptr<const ShadowNode> &child
) {
  YogaLayoutableShadowNode::appendChild(child);

  overwriteTextLayoutManager();
}

void
MarcusTextInputDecoratorShadowNode::replaceChild(
  const ShadowNode &oldChild,
  const std::shared_ptr<const ShadowNode> &newChild,
  size_t suggestedIndex
) {
  YogaLayoutableShadowNode::replaceChild(oldChild, newChild, suggestedIndex);

  overwriteTextLayoutManager();
}

void
MarcusTextInputDecoratorShadowNode::layout(LayoutContext layoutContext) {
  YogaLayoutableShadowNode::layout(layoutContext);

  const auto &children = getChildren();
  react_native_assert(
    children.size() == 1 &&
    "MarcusTextInputDecoratorView didn't receive exactly one child"
  );

  auto child =
    std::static_pointer_cast<const YogaLayoutableShadowNode>(children[0]);
  child->ensureUnsealed();
  auto mutableChild = std::const_pointer_cast<YogaLayoutableShadowNode>(child);

  // TODO: this may not be the correct way to do this
  // Since nodes with display: contents are skipped during layout, they have
  // zero-layout. To properly display the view, assign the layout metrics from
  // the child (text input, which was calculated by Yoga) to the decorator view.
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
