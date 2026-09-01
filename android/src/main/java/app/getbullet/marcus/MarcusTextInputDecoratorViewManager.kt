package app.getbullet.marcus

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = MarcusTextInputDecoratorViewManager.NAME)
class MarcusTextInputDecoratorViewManager : MarcusTextInputDecoratorViewManagerSpec() {

  override fun getName(): String = NAME

  public override fun createViewInstance(context: ThemedReactContext): MarcusTextInputDecoratorView =
    MarcusTextInputDecoratorView(context)

  // The generated interface declares this parameter @Nullable, so the override
  // has to accept null even though the prop always arrives set.
  @ReactProp(name = "markdownStyle")
  override fun setMarkdownStyle(view: MarcusTextInputDecoratorView, value: ReadableMap?) {
    val map = requireNotNull(value) { "[react-native-marcus] markdownStyle prop is required" }
    view.markdownStyle = MarkdownStyle(map, view.context)
  }

  @ReactProp(name = "parserId")
  override fun setParserId(view: MarcusTextInputDecoratorView, parserId: Int) {
    view.parserId = parserId
  }

  companion object {
    const val NAME = "MarcusTextInputDecoratorView"
  }
}
