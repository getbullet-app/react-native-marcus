package app.getbullet.marcus

import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.MarcusTextDecoratorViewManagerDelegate
import com.facebook.react.viewmanagers.MarcusTextDecoratorViewManagerInterface

// Not generic over the view type, for the same reason as
// `MarcusTextInputDecoratorViewManagerSpec`: the generated delegate's second type parameter is a
// Java intersection type, which Kotlin has no syntax for.
abstract class MarcusTextDecoratorViewManagerSpec :
  ViewGroupManager<MarcusTextDecoratorView>(),
  MarcusTextDecoratorViewManagerInterface<MarcusTextDecoratorView> {

  private val delegate: ViewManagerDelegate<MarcusTextDecoratorView> =
    MarcusTextDecoratorViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<MarcusTextDecoratorView> = delegate
}
