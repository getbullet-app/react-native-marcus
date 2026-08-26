#pragma once

#include <cstddef>
#include <mutex>
#include <string>
#include <vector>

namespace expensify {
namespace livemarkdown {

struct MarkdownRange {
  std::string type;
  int start;
  int length;
  int depth;
};

struct ParseResult {
  std::vector<MarkdownRange> ranges;

  // Non-empty when the worklet returned something that didn't match the
  // expected schema. Reporting is left to the caller so that this stays free of
  // any platform logging dependency. Only ever set on a cache miss, so callers
  // log once per distinct input rather than on every repeat call.
  std::string schemaError;

  // True when `ranges` is identical to what the previous call returned, which
  // lets callers reuse a previously built platform-side representation instead
  // of rebuilding it.
  bool fromCache{false};
};

// Runs a registered markdown parser worklet and returns the ranges it produced.
//
// This header deliberately includes nothing but the standard library: no JSI,
// no folly, no React Native. Everything that touches the JS runtime lives in
// the .cpp, which keeps the type consumable from plain C++ and gives the
// Swift/C++ interop spike a narrow surface to test against.
class MarkdownWorkletParser {
public:
  // `utf8Text` is the text to parse, UTF-8 encoded for the JSI boundary.
  //
  // `textLengthUtf16` is the same text's length in UTF-16 code units. It is
  // passed separately rather than derived from `utf8Text.size()` because the
  // worklet reports range offsets in UTF-16 units, matching JS string indices.
  // For any non-ASCII text the UTF-8 byte count is larger, so validating
  // against it would let out-of-bounds ranges through.
  ParseResult parse(const std::string &utf8Text, size_t textLengthUtf16,
                    int parserId);

private:
  std::mutex mutex_;

  bool hasCachedResult_{false};
  std::string cachedText_;
  int cachedParserId_{0};
  std::vector<MarkdownRange> cachedRanges_;
};

} // namespace livemarkdown
} // namespace expensify
