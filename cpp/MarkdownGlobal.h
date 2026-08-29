#pragma once

#include <jsi/jsi.h>

#include <worklets/WorkletRuntime/WorkletRuntime.h>

using namespace facebook;
using namespace worklets;

namespace bulletpoint {
namespace marcus {

void setMarkdownRuntime(
    const std::shared_ptr<WorkletRuntime> &markdownWorkletRuntime);

std::shared_ptr<WorkletRuntime> getMarkdownRuntime();

const int registerMarkdownWorklet(
    const std::shared_ptr<SerializableWorklet> &markdownWorklet);

void unregisterMarkdownWorklet(const int parserId);

std::shared_ptr<SerializableWorklet> getMarkdownWorklet(const int parserId);

} // namespace marcus
} // namespace bulletpoint
