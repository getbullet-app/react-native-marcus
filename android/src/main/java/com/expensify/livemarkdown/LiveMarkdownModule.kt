package com.expensify.livemarkdown

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.soloader.SoLoader

class LiveMarkdownModule(reactContext: ReactApplicationContext) :
  NativeLiveMarkdownModuleSpec(reactContext) {

  override fun install(): Boolean {
    val contextHolder = requireNotNull(reactApplicationContext.javaScriptContextHolder) {
      "[react-native-live-markdown] JavaScriptContextHolder is null"
    }
    injectJSIBindings(contextHolder.get())
    return true
  }

  // OnLoad.cpp hand-writes this symbol as
  // Java_com_expensify_livemarkdown_LiveMarkdownModule_injectJSIBindings, so the package,
  // class and method names are frozen. It must also stay an instance method: the native
  // signature takes `jobject thiz`, which a @JvmStatic version would not supply.
  private external fun injectJSIBindings(jsiRuntime: Long)

  companion object {
    init {
      SoLoader.loadLibrary("livemarkdown")
    }
  }
}
