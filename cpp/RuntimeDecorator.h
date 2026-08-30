#pragma once

#include <jsi/jsi.h>

using namespace facebook;

namespace bulletpoint {
namespace marcus {

void
injectJSIBindings(jsi::Runtime &rt);

} // namespace marcus
} // namespace bulletpoint
