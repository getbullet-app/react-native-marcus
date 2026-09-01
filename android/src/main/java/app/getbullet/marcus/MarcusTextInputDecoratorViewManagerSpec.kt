package app.getbullet.marcus

import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.MarcusTextInputDecoratorViewManagerDelegate
import com.facebook.react.viewmanagers.MarcusTextInputDecoratorViewManagerInterface

// Not generic over the view type, unlike the Java this replaces. The generated
// delegate's second type parameter is a Java intersection type
// (`BaseViewManager<T, ...> & MarcusTextInputDecoratorViewManagerInterface<T>`),
// which Kotlin has no syntax for. Naming the one concrete view type lets the
// compiler infer it from `this` instead.
abstract class MarcusTextInputDecoratorViewManagerSpec :
  ViewGroupManager<MarcusTextInputDecoratorView>(),
  MarcusTextInputDecoratorViewManagerInterface<MarcusTextInputDecoratorView> {

  private val delegate: ViewManagerDelegate<MarcusTextInputDecoratorView> =
    MarcusTextInputDecoratorViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<MarcusTextInputDecoratorView> = delegate
}
