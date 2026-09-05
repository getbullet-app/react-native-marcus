#pragma once

#include <memory>
#include <react/renderer/core/ShadowNodeFamily.h>

namespace facebook {
namespace react {

// The decorator carries no state of its own; the formatting it applies lives on
// the text layout manager it hands to the child. This exists only because a
// shadow node has to name a state type, and because Android's mounting layer
// wants one it can serialize.
class JSI_EXPORT MarcusTextDecoratorState final {
public:
  using Shared = std::shared_ptr<const MarcusTextDecoratorState>;

  MarcusTextDecoratorState() {};

// TODO: Simplify once RN 0.81 is the lowest supported version
#if (defined(ANDROID) && REACT_NATIVE_MINOR_VERSION < 81) || (defined(RN_SERIALIZABLE_STATE) && REACT_NATIVE_MINOR_VERSION >= 81)
  MarcusTextDecoratorState(
    MarcusTextDecoratorState const &previousState, folly::dynamic data
  ) {};

  folly::dynamic
  getDynamic() const {
    return {};
  }
#if REACT_NATIVE_MINOR_VERSION < 81
  MapBuffer
  getMapBuffer() const { return MapBufferBuilder::EMPTY(); };
#endif // REACT_NATIVE_MINOR_VERSION < 81
#endif // (defined(ANDROID) && REACT_NATIVE_MINOR_VERSION < 81) || (defined(RN_SERIALIZABLE_STATE) && REACT_NATIVE_MINOR_VERSION >= 81)
};

} // namespace react
} // namespace facebook
