package com.expensify.livemarkdown

import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.MarkdownTextInputDecoratorViewManagerDelegate
import com.facebook.react.viewmanagers.MarkdownTextInputDecoratorViewManagerInterface

// Not generic over the view type, unlike the Java this replaces. The generated
// delegate's second type parameter is a Java intersection type
// (`BaseViewManager<T, ...> & MarkdownTextInputDecoratorViewManagerInterface<T>`),
// which Kotlin has no syntax for. Naming the one concrete view type lets the
// compiler infer it from `this` instead.
abstract class MarkdownTextInputDecoratorViewManagerSpec :
  ViewGroupManager<MarkdownTextInputDecoratorView>(),
  MarkdownTextInputDecoratorViewManagerInterface<MarkdownTextInputDecoratorView> {

  private val delegate: ViewManagerDelegate<MarkdownTextInputDecoratorView> =
    MarkdownTextInputDecoratorViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<MarkdownTextInputDecoratorView> = delegate
}
