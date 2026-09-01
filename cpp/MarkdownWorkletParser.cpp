#include "MarkdownWorkletParser.h"

#include "MarkdownGlobal.h"

#include <stdexcept>
#include <string>
#include <utility>

namespace bulletpoint {
namespace marcus {

namespace {

bool
requiresDepth(const std::string &type) {
  return type == "blockquote";
}

constexpr int kMaxDepth = 6;

} // namespace

ParseResult
parseMarkdown(const std::string &utf8Text, size_t textLengthUtf16, int parserId) {
  const auto &markdownRuntime = getMarkdownRuntime();
  jsi::Runtime &rt = markdownRuntime->getJSIRuntime();

  std::shared_ptr<SerializableWorklet> markdownWorklet;
  try {
    markdownWorklet = getMarkdownWorklet(parserId);
  } catch (const std::out_of_range &) {
    // Parser was never registered, or was already unregistered.
    return {};
  }

  const auto &input = jsi::String::createFromUtf8(rt, utf8Text);

  jsi::Value output;
  try {
    output = markdownRuntime->runGuarded(markdownWorklet, input);
  } catch (const jsi::JSError &) {
    // Skip formatting; runGuarded will have surfaced the error in LogBox.
    return {};
  }

  std::vector<MarkdownRange> ranges;
  try {
    const auto &items = output.asObject(rt).asArray(rt);
    const size_t count = items.size(rt);
    ranges.reserve(count);

    for (size_t i = 0; i < count; ++i) {
      const auto &item = items.getValueAtIndex(rt, i).asObject(rt);
      auto type = item.getProperty(rt, "type").asString(rt).utf8(rt);
      const auto start =
        static_cast<int>(item.getProperty(rt, "start").asNumber());
      const auto length =
        static_cast<int>(item.getProperty(rt, "length").asNumber());
      int depth = 1;
      if (item.hasProperty(rt, "depth")) {
        depth = static_cast<int>(item.getProperty(rt, "depth").asNumber());

        if (requiresDepth(type) && depth < 1) {
          return {{}, "range of type '" + type + "' has a `depth` of " + std::to_string(depth) + ", which must be at least 1"};
        }

        if (depth > kMaxDepth) {
          depth = kMaxDepth;
        }
      } else if (requiresDepth(type)) {
        return {{}, "range of type '" + type + "' is missing `depth`"};
      }

      // `start` is checked explicitly because the offsets come from JS and a
      // negative one would wrap when converted to an unsigned platform range.
      if (length <= 0 || start < 0 ||
          static_cast<size_t>(start) + static_cast<size_t>(length) >
            textLengthUtf16) {
        continue;
      }

      ranges.push_back(MarkdownRange{std::move(type), start, length, depth});
    }
  } catch (const jsi::JSError &error) {
    return {{}, error.getMessage()};
  }

  return {std::move(ranges), ""};
}

} // namespace marcus
} // namespace bulletpoint
