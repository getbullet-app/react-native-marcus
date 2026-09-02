import { Platform } from "react-native"
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
    },
    unorderedList: {
      marginLeft: 6,
      paddingLeft: 18,
    },
    code: {
      fontFamily: FONT_FAMILY_MONOSPACE,
      fontSize: 16,
      color: "black",
      backgroundColor: "lightgray",
    },
    pre: {
      fontFamily: FONT_FAMILY_MONOSPACE,
      fontSize: 16,
      color: "black",
      backgroundColor: "lightgray",
    },
    mentionHere: {
      color: "green",
      backgroundColor: "lime",
      borderRadius: 5,
    },
    mentionUser: {
      color: "blue",
      backgroundColor: "cyan",
      borderRadius: 5,
    },
    mentionReport: {
      color: "red",
      backgroundColor: "pink",
      borderRadius: 5,
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

export type { PartialMarkdownStyle }

export { mergeMarkdownStyleWithDefault }
