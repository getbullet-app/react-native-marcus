#pragma once

#include "MarcusTextInputDecoratorShadowNode.h"
#include <react/debug/react_native_assert.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook {
namespace react {

class MarcusTextInputDecoratorViewComponentDescriptor final
    : public ConcreteComponentDescriptor<MarcusTextInputDecoratorShadowNode> {
public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
};

} // namespace react
} // namespace facebook
