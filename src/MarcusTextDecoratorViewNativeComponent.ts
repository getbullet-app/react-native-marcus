import { codegenNativeComponent } from "react-native"
import type { ColorValue, ViewProps } from "react-native"

import type { Float, Int32 } from "react-native/Libraries/Types/CodegenTypes"

import type { MarkdownStyle as TextInputMarkdownStyle } from "./MarcusTextInputDecoratorViewNativeComponent"

// Codegen parses each `*NativeComponent` file on its own and does not follow
// imports, so the style has to be spelled out again rather than shared with
// `MarcusTextInputDecoratorViewNativeComponent`. The assertion further down is
// what keeps the copy honest: the two have to stay assignable in both
// directions or `tsc --noEmit` fails.

// A run of code, inline or fenced. Both are drawn as a box rather than as a
// background behind the glyphs -- rounded, with room inside it and around it --
// so both carry the same three lengths.
//
// What they hold open differs, because a block owns its lines and a run shares
// one. A block's `padding` and `margin` are held open on the left and
// vertically, and a line long enough to wrap reaches the padding on the right
// rather than stopping in front of it: neither platform can reserve a trailing
// indent per paragraph. An inline run holds its `padding` and `margin` open on
// both sides, by widening the characters it starts and ends with, and grows
// into the line's own spacing above and below rather than pushing the lines
// apart.
interface CodeBlockStyle {
  fontFamily: string
  fontSize: Float
  color: ColorValue
  backgroundColor: ColorValue
  borderRadius: Float
  padding: Float
  margin: Float
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
    scale: Float
  }
  blockquote: {
    borderColor: ColorValue
    borderWidth: Float
    marginLeft: Float
    paddingLeft: Float
  }
  // Indent, and the marker that sits in the gutter it opens. Kept as two
  // separate entries so a renderer can style ordered and unordered lists
  // differently, which is exactly what `markerScale` ends up meaning: an
  // ordered item's number is text, an unordered item's bullet is a shape.
  //
  // Both markers are drawn from the base font -- the size the wrapped `Text`
  // renders at -- rather than from a size of their own, so a list marks itself
  // in proportion to the prose it marks however that prose is sized. They are
  // drawn in `syntax.color`, which is what a marker is styled as: in a display
  // the syntax is gone, so that colour is the list marker's and nothing else's.
  //
  // Only `MarkdownText` draws them. An input shows the marker you typed, in the
  // base font, because it is text you are editing rather than a rendering of it.
  orderedList: {
    marginLeft: Float
    paddingLeft: Float
    // The item's own number, drawn at this fraction of the base font size.
    markerScale: Float
    // Room held open either side of the marker, between the gutter and the text.
    markerPadding: Float
  }
  unorderedList: {
    marginLeft: Float
    paddingLeft: Float
    // The bullet's diameter, as a fraction of the base font size. A circle,
    // centred on the line's own height rather than sat on the baseline.
    markerScale: Float
    markerPadding: Float
  }
  code: CodeBlockStyle
  pre: CodeBlockStyle
  // A name with an `@` in front of it, drawn as a pill: the same inline box an
  // inline run of code sits in, and so the same three lengths. `padding` is the
  // room inside the pill, `margin` the room around it, and both are held open
  // by widening the characters the run begins and ends with rather than by
  // pushing the line apart.
  mention: {
    color: ColorValue
    backgroundColor: ColorValue
    borderRadius: Float
    padding: Float
    margin: Float
  }
}

// `MarkdownRange` with `depth` filled in: codegen has no optional numbers, and
// the formatters read a missing depth as zero anyway.
interface MarkdownRangeStruct {
  type: string
  start: Int32
  length: Int32
  depth: Int32
}

interface NativeProps extends ViewProps {
  markdownStyle: MarkdownStyle
  // The parse result, already stripped of syntax and remapped onto the text the
  // child `Text` is rendering. Unlike the input decorator there is no parser to
  // register: a `Text`'s content only ever changes by a re-render, so JS always
  // knows the string and can hand over finished ranges.
  ranges: ReadonlyArray<MarkdownRangeStruct>
}

type Assignable<A extends B, B> = A

type StyleMatchesTextInput = [
  Assignable<MarkdownStyle, TextInputMarkdownStyle>,
  Assignable<TextInputMarkdownStyle, MarkdownStyle>,
]

export default codegenNativeComponent<NativeProps>("MarcusTextDecoratorView", {
  interfaceOnly: true,
})

export type { MarkdownRangeStruct, StyleMatchesTextInput }
