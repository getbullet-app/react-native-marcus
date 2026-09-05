import { StyleSheet, Text, View } from "react-native"
import React from "react"
import type { TextProps } from "react-native"

import MarcusTextDecoratorViewNativeComponent from "./MarcusTextDecoratorViewNativeComponent"
import type { MarkdownRangeStruct } from "./MarcusTextDecoratorViewNativeComponent"
import { processMarkdownStyle } from "./styleUtils"
import type { PartialMarkdownStyle } from "./styleUtils"
import { stripSyntax } from "./stripUtils"
import type { StrippedMarkdown } from "./stripUtils"
import { flattenText } from "./childrenUtils"
import type { MarkdownRange } from "./commonTypes"

/**
 * What to show in place of an image.
 *
 * Must return a single view with a definite width and height, or nothing: the
 * text layout has to know how much room to leave before it can lay the line
 * out, and markdown carries no dimensions. Anything that reports no size --
 * a bare `Image` with a remote source, most obviously -- measures zero and
 * disappears.
 *
 * The alt text is passed through rather than used: what it is good for, an
 * accessibility label most of all, is a question only the caller can answer.
 *
 * `inline` says whether the image shares its line with anything else, which is
 * usually what decides how big it should be: alone on a line it is a figure,
 * and in the middle of a sentence it is a badge. A block marker does not count
 * as company, and another image does.
 *
 * Every string is always a string: an image written without a title is handed
 * an empty one rather than nothing, so a caller never has to tell the two
 * apart.
 */
type RenderEmbed = (
  uri: string,
  alt: string,
  title: string,
  inline: boolean,
) => React.ReactElement | null | undefined

/**
 * What to do when a link is pressed.
 *
 * The label is the text the link was rendered as, which is all a reader saw of
 * it: the destination is not in the document any more. Reference links are not
 * covered -- their destination is written somewhere else and is not resolved
 * yet -- so they render as links and do nothing.
 *
 * Opening the URL is deliberately not done for you: what a link means is the
 * application's to decide, and a message from a stranger is the last place to
 * hand an arbitrary URL to `Linking.openURL` without looking at it first.
 *
 * Every string is always a string: a link written without a title is handed an
 * empty one rather than nothing.
 */
type OnLinkPress = (uri: string, label: string, title: string) => void

interface MarkdownTextProps extends TextProps {
  markdownStyle?: PartialMarkdownStyle
  parser: (value: string) => MarkdownRange[]
  renderEmbed?: RenderEmbed
  onLinkPress?: OnLinkPress
}

type MarkdownText = Text & React.Component<MarkdownTextProps>

/**
 * The stripped text with the embeds spliced back in and the links wrapped, as
 * the children of one `Text`.
 *
 * A view nested in a `Text` is one character to the platform -- iOS and Android
 * both put a single U+FFFC in the string their formatters index -- and it is
 * the very character the strip left behind, so the ranges need no adjusting and
 * an embed inside a blockquote is laid out inside the quote's indent by the
 * same code that indents the prose around it.
 *
 * A nested `Text` costs no characters at all: its content goes into that same
 * string where it stands. So a link can be wrapped in one to be pressed without
 * moving anything either, and the decorator styles it through the ranges the
 * way it styles a link nobody can press.
 */
function textChildren(
  markdown: StrippedMarkdown,
  renderEmbed: RenderEmbed | undefined,
  onLinkPress: React.RefObject<OnLinkPress | undefined>,
) {
  const { text, embeds, links } = markdown
  const children: React.ReactNode[] = []
  // Embeds are in text order and each is used once, whether it falls inside a
  // link or between two, so one walk covers both.
  let next = 0

  /** The text between two offsets, with any embeds in it spliced in. */
  function content(from: number, to: number) {
    const between: React.ReactNode[] = []
    let cursor = from

    while (next < embeds.length && embeds[next]!.index < to) {
      const embed = embeds[next]!

      if (embed.index > cursor) {
        between.push(text.slice(cursor, embed.index))
      }

      between.push(
        <React.Fragment key={`embed-${embed.index}`}>
          {/* Something has to stand in the placeholder's place even when the
              caller declines to render anything, or every range after it would
              be one character out. An empty view is the cheapest attachment
              there is, and takes up as much room as the nothing it draws. */}
          {renderEmbed?.(embed.uri, embed.alt, embed.title, embed.inline) ?? <View />}
        </React.Fragment>,
      )

      cursor = embed.index + 1
      next++
    }

    if (cursor < to) {
      between.push(text.slice(cursor, to))
    }

    return between
  }

  let cursor = 0

  for (const link of links) {
    if (link.start > cursor) {
      children.push(...content(cursor, link.start))
    }

    const end = link.start + link.length

    children.push(
      <Text
        key={`link-${link.start}`}
        role="link"
        onPress={() => onLinkPress.current?.(link.uri, link.label, link.title)}
      >
        {content(link.start, end)}
      </Text>,
    )

    cursor = end
  }

  children.push(...content(cursor, text.length))

  return children
}

const EMPTY_RANGES: MarkdownRangeStruct[] = []

function toRangeStructs(ranges: MarkdownRange[]): MarkdownRangeStruct[] {
  return ranges.map((range) => ({
    type: range.type,
    start: range.start,
    length: range.length,
    depth: range.depth ?? 0,
  }))
}

/**
 * `Text`, with the markdown in its content rendered rather than shown.
 *
 * The syntax is removed in JavaScript before the text ever reaches the shadow
 * tree, so what gets measured, drawn, selected, copied and read out is the
 * finished prose. What is left over -- which run is bold, where a quote starts
 * -- is handed to the native decorator as ranges over that stripped string, and
 * styled by the same formatter the input uses, so a message and the composer it
 * was typed in agree by construction.
 *
 * List markers are the exception that stays: `1.` numbers an item and `-`
 * stands in for a bullet, so they are laid out rather than removed.
 */
const MarkdownText = React.forwardRef<MarkdownText, MarkdownTextProps>((props, ref) => {
  const {
    markdownStyle: markdownStyleProp,
    parser,
    renderEmbed,
    onLinkPress,
    children,
    ...textProps
  } = props

  const markdownStyle = React.useMemo(
    () => processMarkdownStyle(markdownStyleProp),
    [markdownStyleProp],
  )

  if (parser === undefined) {
    throw new Error("[react-native-marcus] `parser` is undefined")
  }

  // Whether there is a handler, not which one: a caller who writes the callback
  // inline would otherwise re-parse the document on every render.
  const withEmbeds = renderEmbed !== undefined
  const withLinks = onLinkPress !== undefined

  const markdown = React.useMemo(() => {
    const text = flattenText(children)

    return text === null
      ? null
      : stripSyntax(text, parser(text), { embeds: withEmbeds, links: withLinks })
  }, [children, parser, withEmbeds, withLinks])

  // The handler as the caller last wrote it, kept beside the text rather than
  // baked into it. Written inline -- which is how a handler that reaches for
  // component state has to be written -- it is a different function on every
  // render, and rebuilding the children for each press means rebuilding the
  // string the platform lays out, on the main thread, for every press.
  const pressHandler = React.useRef(onLinkPress)

  React.useEffect(() => {
    pressHandler.current = onLinkPress
  }, [onLinkPress])

  // Rebuilt when the document changes, or when a caller hands over a different
  // renderer -- one that draws from state has to be able to draw again.
  const spliced = React.useMemo(
    () =>
      markdown === null || (markdown.embeds.length === 0 && markdown.links.length === 0)
        ? null
        : textChildren(markdown, renderEmbed, pressHandler),
    [markdown, renderEmbed],
  )

  // The same array while the document is the same one: a new one is a new props
  // object to the mounting layer, and every press that a caller answers with a
  // `setState` would otherwise have the decorator format the paragraph again.
  const ranges = React.useMemo(
    () => (markdown === null ? EMPTY_RANGES : toRangeStructs(markdown.ranges)),
    [markdown],
  )

  if (markdown === null) {
    if (__DEV__) {
      console.warn(
        "[react-native-marcus] `MarkdownText` was given children other than text and is rendering them unformatted.",
      )
    }

    return (
      <Text {...textProps} ref={ref}>
        {children}
      </Text>
    )
  }

  return (
    <MarcusTextDecoratorViewNativeComponent
      style={styles.displayContents}
      markdownStyle={markdownStyle}
      ranges={ranges}
    >
      <Text {...textProps} ref={ref}>
        {spliced ?? markdown.text}
      </Text>
    </MarcusTextDecoratorViewNativeComponent>
  )
})

const styles = StyleSheet.create({
  displayContents: {
    display: "contents",
  },
})

export type { MarkdownTextProps, OnLinkPress, RenderEmbed }

export default MarkdownText
