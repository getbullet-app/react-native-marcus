package app.getbullet.marcus

import android.text.SpannableStringBuilder
import android.text.TextPaint
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.DisplayMetricsHolder
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * The Android render model, driven by the same corpus every other layer uses.
 *
 * Ranges come from `ranges.json`, produced by the JS parser: a formatter takes
 * ranges rather than markdown, so this suite needs no JS runtime and no device.
 *
 * The whole corpus is dumped into one baseline rather than one file per case,
 * so the Android and iOS outputs stay diffable against each other in a single
 * comparison. Regenerate with `-Dmarcus.updateBaselines=true`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MarkdownFormatterTest {

  private lateinit var style: MarkdownStyle
  private lateinit var formatter: MarkdownFormatter

  @Before
  fun setUp() {
    val context = RuntimeEnvironment.getApplication()
    // `PixelUtil.toPixelFromDIP` reads these; without them every gutter is NaN.
    DisplayMetricsHolder.initDisplayMetrics(context)

    style = MarkdownStyle(styleMap(), context)
    formatter = MarkdownFormatter(context.assets)
  }

  @Test
  fun `formats every fixture into the shared render model`() {
    val cases = JSONArray(resource("cases.json"))
    val ranges = JSONObject(resource("ranges.json"))

    val dump = buildString {
      for (i in 0 until cases.length()) {
        val entry = cases.getJSONObject(i)
        val id = entry.getString("id")
        val markdown = entry.getString("markdown")

        val ssb = SpannableStringBuilder(markdown)
        formatter.format(ssb, rangesOf(ranges.getJSONArray(id)), style, textPaint())

        append(id).append('\n')
        append(RenderModel.dump(markdown, ssb).prependIndent("  ")).append('\n')
      }
    }

    val baseline = File("src/test/resources/render-model.txt")

    if (System.getProperty("marcus.updateBaselines") == "true" || !baseline.exists()) {
      baseline.parentFile.mkdirs()
      baseline.writeText(dump)
      println("Wrote baseline to ${baseline.absolutePath}")
      return
    }

    if (baseline.readText() != dump) {
      val actual = File("build/render-model-actual.txt")
      actual.parentFile.mkdirs()
      actual.writeText(dump)
    }

    assertEquals(baseline.readText(), dump)
  }

  @Test
  fun `applies bold across the whole emphasis span`() {
    val ssb = SpannableStringBuilder("**bold**")
    formatter.format(
      ssb,
      listOf(
        MarkdownRange("bold", 0, 8, 0),
        MarkdownRange("syntax", 0, 2, 0),
        MarkdownRange("syntax", 6, 2, 0),
      ),
      style,
      textPaint(),
    )

    assertEquals(
      """
         0..8    bold
         0..2    color(#808080)
         6..8    color(#808080)
      """.trimIndent(),
      RenderModel.dump("**bold**", ssb).trimIndent(),
    )
  }

  @Test
  fun `leaves plain text unspanned`() {
    val ssb = SpannableStringBuilder("no markdown here")
    formatter.format(ssb, emptyList(), style, textPaint())

    assertEquals("(no spans)", RenderModel.dump("no markdown here", ssb))
  }

  private fun textPaint() = TextPaint().apply { textSize = 16f }

  private fun rangesOf(array: JSONArray): List<MarkdownRange> =
    (0 until array.length()).map { i ->
      val range = array.getJSONObject(i)
      MarkdownRange(
        range.getString("type"),
        range.getInt("start"),
        range.getInt("length"),
        range.optInt("depth", 0),
      )
    }

  private fun resource(name: String): String =
    requireNotNull(javaClass.classLoader?.getResourceAsStream(name)) {
      "$name is not on the test classpath -- is sourceSets.test.resources pointing at src/__fixtures__?"
    }.bufferedReader().readText()

  /** The same style the web harness pins, so the dumps are comparable. */
  private fun styleMap(): ReadableMap {
    fun group(vararg entries: Pair<String, Any>): JavaOnlyMap = JavaOnlyMap().apply {
      entries.forEach { (key, value) ->
        when (value) {
          is Int -> putInt(key, value)
          is Double -> putDouble(key, value)
          is String -> putString(key, value)
        }
      }
    }

    return JavaOnlyMap().apply {
      putMap("syntax", group("color" to 0xFF808080.toInt()))
      putMap("link", group("color" to 0xFF0000FF.toInt()))
      putMap("heading", group("fontSize" to 38.0, "scale" to 0.85))
      putMap("emoji", group("fontSize" to 16.0, "fontFamily" to "System"))
      putMap(
        "blockquote",
        group(
          "borderColor" to 0xFF808080.toInt(),
          "borderWidth" to 6.0,
          "marginLeft" to 6.0,
          "paddingLeft" to 6.0,
        ),
      )
      putMap("orderedList", group("marginLeft" to 6.0, "paddingLeft" to 18.0))
      putMap("unorderedList", group("marginLeft" to 6.0, "paddingLeft" to 18.0))
      putMap(
        "code",
        group(
          "fontFamily" to "monospace",
          "fontSize" to 16.0,
          "color" to 0xFF000000.toInt(),
          "backgroundColor" to 0xFFD3D3D3.toInt(),
        ),
      )
      putMap(
        "pre",
        group(
          "fontFamily" to "monospace",
          "fontSize" to 16.0,
          "color" to 0xFF000000.toInt(),
          "backgroundColor" to 0xFFD3D3D3.toInt(),
        ),
      )
      putMap(
        "mentionHere",
        group(
          "color" to 0xFF008000.toInt(),
          "backgroundColor" to 0xFF00FF00.toInt(),
          "borderRadius" to 5.0,
        ),
      )
      putMap(
        "mentionUser",
        group(
          "color" to 0xFF0000FF.toInt(),
          "backgroundColor" to 0xFF00FFFF.toInt(),
          "borderRadius" to 5.0,
        ),
      )
      putMap(
        "mentionReport",
        group(
          "color" to 0xFFFF0000.toInt(),
          "backgroundColor" to 0xFFFFC0CB.toInt(),
          "borderRadius" to 5.0,
        ),
      )
    }
  }
}
