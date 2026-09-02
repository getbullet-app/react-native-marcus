import { codegenNativeComponent } from "react-native"
import type { ColorValue, ViewProps } from "react-native"

import type { Float, Int32 } from "react-native/Libraries/Types/CodegenTypes"

// Font, colour and background, and nothing else: neither formatter draws a
// border or reserves padding around a code run, so there is nothing to
// configure.
interface CodeBlockStyle {
  fontFamily: string
  fontSize: Float
  color: ColorValue
  backgroundColor: ColorValue
}

interface MarkdownStyle {
  syntax: {
    color: ColorValue
  }
  emoji: {
    fontSize: Float
    fontFamily: string
  }
  link: {
    color: ColorValue
  }
  heading: {
    fontSize: Float
    // Each level down multiplies the one above, so level N is
    // fontSize * scale^(N - 1). Six levels, matching HTML.
    scale: Float
  }
  blockquote: {
    borderColor: ColorValue
    borderWidth: Float
    marginLeft: Float
    paddingLeft: Float
  }
  // Indent only, no gutter decoration. Kept as two separate entries so a
  // renderer can style ordered and unordered lists differently.
  orderedList: {
    marginLeft: Float
    paddingLeft: Float
  }
  unorderedList: {
    marginLeft: Float
    paddingLeft: Float
  }
  code: CodeBlockStyle
  pre: CodeBlockStyle
  mentionHere: {
    color: ColorValue
    backgroundColor: ColorValue
    borderRadius?: Float
  }
  mentionUser: {
    color: ColorValue
    backgroundColor: ColorValue
    borderRadius?: Float
  }
  mentionReport: {
    color: ColorValue
    backgroundColor: ColorValue
    borderRadius?: Float
  }
}

interface NativeProps extends ViewProps {
  markdownStyle: MarkdownStyle
  parserId: Int32
}

export default codegenNativeComponent<NativeProps>("MarcusTextInputDecoratorView", {
  interfaceOnly: true,
})

export type { MarkdownStyle }
