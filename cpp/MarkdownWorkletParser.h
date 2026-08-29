#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace bulletpoint {
namespace marcus {

struct MarkdownRange {
  std::string type;
  int start;
  int length;
  int depth;
};

struct ParseResult {
  std::vector<MarkdownRange> ranges;

  // Non-empty when the worklet returned something that didn't match the
  // expected schema. Reporting is left to the caller so this stays free of any
  // platform logging dependency.
  std::string schemaError;
};

// Runs a registered markdown parser worklet and returns the ranges it produced.
//
// Stateless and lock-free on purpose. Running the worklet waits on the markdown
// runtime, and holding a lock across that wait is what allowed a background
// parse to block the main thread until iOS killed the app
// (Expensify/react-native-live-markdown#772). Caching therefore belongs to the
// caller, which must not hold its cache lock while calling this.
//
// `utf8Text` is the text to parse, UTF-8 encoded for the JSI boundary.
//
// `textLengthUtf16` is the same text's length in UTF-16 code units. It is
// passed separately rather than derived from `utf8Text.size()` because the
// worklet reports range offsets in UTF-16 units, matching JS string indices.
// For any non-ASCII text the UTF-8 byte count is larger, so validating against
// it would let out-of-bounds ranges through.
ParseResult parseMarkdown(const std::string &utf8Text, size_t textLengthUtf16,
                          int parserId);

} // namespace marcus
} // namespace bulletpoint
