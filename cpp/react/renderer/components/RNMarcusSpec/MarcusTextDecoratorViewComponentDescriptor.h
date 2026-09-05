#pragma once

#include "MarcusTextDecoratorShadowNode.h"
#include <react/debug/react_native_assert.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook {
namespace react {

class MarcusTextDecoratorViewComponentDescriptor final
    : public ConcreteComponentDescriptor<MarcusTextDecoratorShadowNode> {
public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
};

} // namespace react
} // namespace facebook
