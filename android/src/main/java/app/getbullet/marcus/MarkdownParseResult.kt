package app.getbullet.marcus

/**
 * What [MarkdownParser.nativeParse] hands back across JNI. Constructed from C++ via fbjni
 * `newInstance`, so the constructor signature is load-bearing:
 * `([Lapp/getbullet/marcus/MarkdownRange;Ljava/lang/String;)V`.
 */
class MarkdownParseResult(
  @JvmField val ranges: Array<MarkdownRange>,
  /** Non-null when the worklet returned something that did not match the expected schema. */
  @JvmField val schemaError: String?
)
