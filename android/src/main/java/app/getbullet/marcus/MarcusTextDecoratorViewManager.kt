package app.getbullet.marcus

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = MarcusTextDecoratorViewManager.NAME)
class MarcusTextDecoratorViewManager : MarcusTextDecoratorViewManagerSpec() {

  override fun getName(): String = NAME

  public override fun createViewInstance(context: ThemedReactContext): MarcusTextDecoratorView =
    MarcusTextDecoratorView(context)

  // The generated interface declares these parameters @Nullable, so the overrides have to accept
  // null even though both props always arrive set.
  @ReactProp(name = "markdownStyle")
  override fun setMarkdownStyle(view: MarcusTextDecoratorView, value: ReadableMap?) {
    val map = requireNotNull(value) { "[react-native-marcus] markdownStyle prop is required" }
    view.markdownStyle = MarkdownStyle(map, view.context)
  }

  @ReactProp(name = "ranges")
  override fun setRanges(view: MarcusTextDecoratorView, value: ReadableArray?) {
    view.ranges = MarkdownRanges.read(value)
  }

  companion object {
    const val NAME = "MarcusTextDecoratorView"
  }
}
