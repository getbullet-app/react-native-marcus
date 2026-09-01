#pragma once

#include <memory>
#include <react/renderer/core/ShadowNodeFamily.h>

namespace facebook {
namespace react {

class JSI_EXPORT MarcusTextInputDecoratorState final {
public:
  using Shared = std::shared_ptr<const MarcusTextInputDecoratorState>;

  MarcusTextInputDecoratorState() {};

// TODO: Simplify once RN 0.81 is the lowest supported version
#if (defined(ANDROID) && REACT_NATIVE_MINOR_VERSION < 81) || (defined(RN_SERIALIZABLE_STATE) && REACT_NATIVE_MINOR_VERSION >= 81)
  MarcusTextInputDecoratorState(
    MarcusTextInputDecoratorState const &previousState, folly::dynamic data
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
