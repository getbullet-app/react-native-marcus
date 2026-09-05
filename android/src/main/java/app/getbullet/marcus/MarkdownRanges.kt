package app.getbullet.marcus

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType

/**
 * Reads the `ranges` prop into what the formatter wants.
 *
 * The JavaScript side has already stripped the syntax and remapped every offset onto the text the
 * child `Text` is rendering, so nothing here validates or reorders: emission order is the contract
 * the formatter walks, and reordering it would break the pairing of a block prefix with the
 * container that follows it.
 *
 * An object with `@JvmStatic` rather than a top-level function, because `CustomFabricUIManager` is
 * Java and Kotlin mangles the names of top-level internal ones.
 */
object MarkdownRanges {

  @JvmStatic
  fun read(array: ReadableArray?): List<MarkdownRange> {
    if (array == null || array.size() == 0) {
      return emptyList()
    }

    val ranges = ArrayList<MarkdownRange>(array.size())

    for (i in 0 until array.size()) {
      if (array.getType(i) != ReadableType.Map) {
        continue
      }

      val map = array.getMap(i) ?: continue
      val type = map.getString("type") ?: continue

      ranges.add(
        MarkdownRange(
          type = type,
          start = map.getInt("start"),
          length = map.getInt("length"),
          depth = map.getInt("depth")
        )
      )
    }

    return ranges
  }
}
