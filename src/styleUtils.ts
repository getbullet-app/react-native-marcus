import { Platform, processColor } from "react-native"
import type { MarkdownStyle } from "./MarcusTextInputDecoratorViewNativeComponent"

type PartialMarkdownStyle = Partial<{
  [K in keyof MarkdownStyle]: Partial<MarkdownStyle[K]>
}>

const FONT_FAMILY_MONOSPACE = Platform.select({
  ios: "Courier",
  default: "monospace",
})

const FONT_FAMILY_EMOJI = Platform.select({
  ios: "System",
  android: "Noto Color Emoji",
  default: "System, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji",
})

function makeDefaultMarkdownStyle(): MarkdownStyle {
  return {
    syntax: {
      color: "gray",
    },
    link: {
      color: "blue",
    },
    heading: {
      fontSize: 38,
      scale: 0.85,
    },
    emoji: {
      fontSize: 16,
      fontFamily: FONT_FAMILY_EMOJI,
    },
    blockquote: {
      borderColor: "gray",
      borderWidth: 6,
      marginLeft: 6,
      paddingLeft: 6,
    },
    orderedList: {
      marginLeft: 6,
      paddingLeft: 18,
      markerScale: 0.8,
      markerPadding: 2,
    },
    unorderedList: {
      marginLeft: 6,
      paddingLeft: 18,
      markerScale: 0.3,
      markerPadding: 2,
    },
    code: {
      fontFamily: FONT_FAMILY_MONOSPACE,
      fontSize: 16,
      color: "black",
      backgroundColor: "lightgray",
      borderRadius: 4,
      padding: 2,
      margin: 2,
    },
    pre: {
      fontFamily: FONT_FAMILY_MONOSPACE,
      fontSize: 16,
      color: "black",
      backgroundColor: "lightgray",
      borderRadius: 4,
      padding: 8,
      margin: 4,
    },
    mention: {
      color: "blue",
      backgroundColor: "cyan",
      borderRadius: 5,
      padding: 2,
      margin: 0,
    },
  }
}

function mergeMarkdownStyleWithDefault(input: PartialMarkdownStyle | undefined): MarkdownStyle {
  const output = makeDefaultMarkdownStyle()

  if (input !== undefined) {
    Object.keys(input).forEach((key) => {
      if (!(key in output)) {
        return
      }

      const outputValue = output[key as keyof MarkdownStyle]
      if (outputValue) {
        Object.assign(outputValue, input[key as keyof MarkdownStyle])
      }
    })
  }

  return output
}

function processColorsInMarkdownStyle(input: MarkdownStyle): MarkdownStyle {
  const output = JSON.parse(JSON.stringify(input))

  Object.keys(output).forEach((key) => {
    const obj = output[key]
    Object.keys(obj).forEach((prop) => {
      // TODO: use ReactNativeStyleAttributes from 'react-native/Libraries/Components/View/ReactNativeStyleAttributes'
      if (!(prop === "color" || prop.endsWith("Color"))) {
        return
      }
      obj[prop] = processColor(obj[prop])
    })
  })

  return output as MarkdownStyle
}

// The shape the native decorators take: defaults filled in, colours turned into
// the platform representation. Shared by both components so a style means the
// same thing whether it is being typed into or read.
function processMarkdownStyle(input: PartialMarkdownStyle | undefined): MarkdownStyle {
  return processColorsInMarkdownStyle(mergeMarkdownStyleWithDefault(input))
}

export type { PartialMarkdownStyle }

export { mergeMarkdownStyleWithDefault, processMarkdownStyle }
