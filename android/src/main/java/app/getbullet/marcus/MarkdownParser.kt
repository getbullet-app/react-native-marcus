package app.getbullet.marcus

import android.os.Trace
import app.getbullet.marcus.MarkdownParser.Companion.shared
import com.facebook.soloader.SoLoader

/**
 * Runs the registered markdown parser worklet and caches its output.
 *
 * Use [shared]. Each markdown input has two independent callers, the decorator view's
 * TextWatcher and CustomFabricUIManager's measureText, and one cache shared between them
 * beats one cache each. Note this is not a 2x saving: tracing shows a keystroke produces
 * four parse calls but only one worklet run, because they all ask for the same text.
 *
 * Knows nothing about ReactContext or logging: it outlives every reload, so holding a context
 * would leak it, and reporting is left to the caller via [onSchemaError].
 */
class MarkdownParser private constructor() {

  private data class CacheKey(val text: String, val parserId: Int)

  private val lock = Any()

  private val cache =
    object : LinkedHashMap<CacheKey, List<MarkdownRange>>(CACHE_CAPACITY, 0.75f, true) {
      override fun removeEldestEntry(
        eldest: MutableMap.MutableEntry<CacheKey, List<MarkdownRange>>
      ): Boolean = size > CACHE_CAPACITY
    }

  // Registered from C++ by JMarkdownParser::registerNatives in MarkdownParser.cpp. Must stay
  // an instance method to match the `alias_ref<JMarkdownParser>` first parameter there.
  private external fun nativeParse(text: String, parserId: Int): MarkdownParseResult

  fun parse(
    text: String,
    parserId: Int,
    onSchemaError: (String) -> Unit
  ): List<MarkdownRange> {
    try {
      Trace.beginSection("parse")

      val key = CacheKey(text, parserId)
      synchronized(lock) { cache[key] }?.let { return it }

      // Deliberately outside the lock. nativeParse waits on the markdown worklet runtime,
      // and holding a lock across that wait is what let a background parse block the main
      // thread until iOS killed the app (Expensify/react-native-live-markdown#772). Android
      // has no watchdog to make it fatal, but it is the same defect.
      val ranges = parseUncached(text, parserId, onSchemaError)

      synchronized(lock) { cache[key] = ranges }
      return ranges
    } finally {
      Trace.endSection()
    }
  }

  private fun parseUncached(
    text: String,
    parserId: Int,
    onSchemaError: (String) -> Unit
  ): List<MarkdownRange> {
    val result = try {
      Trace.beginSection("nativeParse")
      nativeParse(text, parserId)
    } catch (e: Exception) {
      // Skip formatting, runGuarded will show the error in LogBox
      return emptyList()
    } finally {
      Trace.endSection()
    }

    result.schemaError?.let(onSchemaError)

    return result.ranges.asList()
  }

  companion object {
    private const val CACHE_CAPACITY = 8

    init {
      SoLoader.loadLibrary("marcus")
    }

    @JvmStatic
    val shared: MarkdownParser = MarkdownParser()
  }
}
