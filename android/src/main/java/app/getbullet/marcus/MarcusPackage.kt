package app.getbullet.marcus

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class MarcusPackage : BaseReactPackage() {

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> = listOf(MarkdownTextInputDecoratorViewManager())

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      NativeMarcusModuleSpec.NAME to ReactModuleInfo(
        NativeMarcusModuleSpec.NAME,
        MarcusModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        true // isTurboModule
      )
    )
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeMarcusModuleSpec.NAME) MarcusModule(reactContext) else null
}
