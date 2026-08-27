/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <fbjni/fbjni.h>

#include <string>

using namespace facebook;

namespace expensify {
namespace livemarkdown {

  struct JMarkdownRange : jni::JavaClass<JMarkdownRange> {
    static constexpr auto kJavaDescriptor =
        "Lcom/expensify/livemarkdown/MarkdownRange;";

    // fbjni keeps newInstance protected, so the factory has to live inside the class.
    static jni::local_ref<JMarkdownRange> create(const std::string &type, int start,
                                                 int length, int depth) {
      return newInstance(jni::make_jstring(type), start, length, depth);
    }
  };

  struct JMarkdownParseResult : jni::JavaClass<JMarkdownParseResult> {
    static constexpr auto kJavaDescriptor =
        "Lcom/expensify/livemarkdown/MarkdownParseResult;";

    static jni::local_ref<JMarkdownParseResult> create(
        jni::alias_ref<jni::JArrayClass<JMarkdownRange::javaobject>> ranges,
        jni::local_ref<jni::JString> schemaError) {
      return newInstance(ranges, schemaError);
    }
  };

  // A plain JavaClass, not a HybridClass: the Kotlin side holds no HybridData and nothing
  // ever constructs a C++ peer, so the hybrid machinery would only be decoration.
  struct JMarkdownParser : jni::JavaClass<JMarkdownParser> {
    static constexpr auto kJavaDescriptor =
        "Lcom/expensify/livemarkdown/MarkdownParser;";

    static jni::local_ref<JMarkdownParseResult> nativeParse(
        jni::alias_ref<JMarkdownParser> jThis,
        jni::alias_ref<jni::JString> text,
        const int parserId);

    static void registerNatives();
  };

} // namespace livemarkdown
} // namespace expensify
