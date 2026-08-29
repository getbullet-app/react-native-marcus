package app.getbullet.marcus

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.soloader.SoLoader

class MarcusModule(reactContext: ReactApplicationContext) :
  NativeMarcusModuleSpec(reactContext) {

  override fun install(): Boolean {
    val contextHolder = requireNotNull(reactApplicationContext.javaScriptContextHolder) {
      "[react-native-marcus] JavaScriptContextHolder is null"
    }
    injectJSIBindings(contextHolder.get())
    return true
  }

  // OnLoad.cpp hand-writes this symbol as
  // Java_app_getbullet_marcus_MarcusModule_injectJSIBindings, so the package,
  // class and method names are frozen. It must also stay an instance method: the native
  // signature takes `jobject thiz`, which a @JvmStatic version would not supply.
  private external fun injectJSIBindings(jsiRuntime: Long)

  companion object {
    init {
      SoLoader.loadLibrary("marcus")
    }
  }
}
