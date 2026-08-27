#include "MarkdownParser.h"
#include "MarkdownWorkletParser.h"

#include <fbjni/fbjni.h>

using namespace facebook;

namespace expensify {
namespace livemarkdown {
  jni::local_ref<JMarkdownParseResult> JMarkdownParser::nativeParse(
      jni::alias_ref<JMarkdownParser> jThis,
      jni::alias_ref<jni::JString> text,
      const int parserId) {
    // Read the UTF-16 length from the same jstring rather than taking it as a parameter,
    // so the length and the text can never disagree. The worklet reports offsets in UTF-16
    // units (they are JS string indices); validating them against the UTF-8 byte count
    // would let out-of-bounds ranges through for any non-ASCII text.
    const auto lengthUtf16 = static_cast<size_t>(
        jni::Environment::current()->GetStringLength(text.get()));

    const auto result = parseMarkdown(text->toStdString(), lengthUtf16, parserId);

    auto ranges =
        jni::JArrayClass<JMarkdownRange::javaobject>::newArray(result.ranges.size());
    for (size_t i = 0; i < result.ranges.size(); i++) {
      const auto &range = result.ranges[i];
      // Scoped so each local ref is released as we go, instead of accumulating one
      // per range in the frame.
      const auto jRange =
          JMarkdownRange::create(range.type, range.start, range.length, range.depth);
      ranges->setElement(i, jRange.get());
    }

    auto schemaError = result.schemaError.empty()
        ? jni::local_ref<jni::JString>(nullptr)
        : jni::make_jstring(result.schemaError);

    return JMarkdownParseResult::create(ranges, std::move(schemaError));
  }

  void JMarkdownParser::registerNatives() {
    javaClassStatic()->registerNatives(
        {makeNativeMethod("nativeParse", JMarkdownParser::nativeParse)});
  }

} // namespace livemarkdown
} // namespace expensify
