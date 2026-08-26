#include "MarkdownWorkletParser.h"

#include "MarkdownGlobal.h"

#include <stdexcept>
#include <utility>

namespace expensify {
namespace livemarkdown {

ParseResult MarkdownWorkletParser::parse(const std::string &utf8Text,
                                         size_t textLengthUtf16,
                                         int parserId) {
  std::lock_guard<std::mutex> lock(mutex_);

  if (hasCachedResult_ && cachedParserId_ == parserId && cachedText_ == utf8Text) {
    return ParseResult{cachedRanges_, "", true};
  }

  const auto store = [&](std::vector<MarkdownRange> ranges,
                         std::string schemaError) {
    cachedText_ = utf8Text;
    cachedParserId_ = parserId;
    cachedRanges_ = std::move(ranges);
    hasCachedResult_ = true;
    return ParseResult{cachedRanges_, std::move(schemaError), false};
  };

  const auto &markdownRuntime = getMarkdownRuntime();
  jsi::Runtime &rt = markdownRuntime->getJSIRuntime();

  std::shared_ptr<SerializableWorklet> markdownWorklet;
  try {
    markdownWorklet = getMarkdownWorklet(parserId);
  } catch (const std::out_of_range &) {
    // Parser was never registered, or was already unregistered.
    return store({}, "");
  }

  const auto &input = jsi::String::createFromUtf8(rt, utf8Text);

  jsi::Value output;
  try {
    output = markdownRuntime->runGuarded(markdownWorklet, input);
  } catch (const jsi::JSError &) {
    // Skip formatting; runGuarded will have surfaced the error in LogBox.
    return store({}, "");
  }

  std::vector<MarkdownRange> ranges;
  try {
    const auto &items = output.asObject(rt).asArray(rt);
    const size_t count = items.size(rt);
    ranges.reserve(count);

    for (size_t i = 0; i < count; ++i) {
      const auto &item = items.getValueAtIndex(rt, i).asObject(rt);
      auto type = item.getProperty(rt, "type").asString(rt).utf8(rt);
      const auto start = static_cast<int>(item.getProperty(rt, "start").asNumber());
      const auto length = static_cast<int>(item.getProperty(rt, "length").asNumber());
      const auto depth = item.hasProperty(rt, "depth")
                             ? static_cast<int>(item.getProperty(rt, "depth").asNumber())
                             : 1;

      // `start` is checked explicitly because the offsets come from JS and a
      // negative one would wrap when converted to an unsigned platform range.
      if (length <= 0 || start < 0 ||
          static_cast<size_t>(start) + static_cast<size_t>(length) > textLengthUtf16) {
        continue;
      }

      ranges.push_back(MarkdownRange{std::move(type), start, length, depth});
    }
  } catch (const jsi::JSError &error) {
    return store({}, error.getMessage());
  }

  return store(std::move(ranges), "");
}

} // namespace livemarkdown
} // namespace expensify
