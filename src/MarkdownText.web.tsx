import { Text } from "react-native"
import React from "react"
import { createPortal } from "react-dom"
import type { TextProps } from "react-native"

import { flattenText } from "./childrenUtils"
import { OBJECT_REPLACEMENT, stripSyntax } from "./stripUtils"
import { createTextMeasurer } from "./web/utils/measureUtils"
import { parseRangesToHTMLNodes } from "./web/utils/parserUtils"
import { processMarkdownStyle } from "./web/utils/webStyleUtils"
import type { PartialMarkdownStyle } from "./styleUtils"
import type { HTMLMarkdownElement } from "./MarkdownTextInput.web"
import type { MarkdownLink } from "./stripUtils"
import type { TreeNode } from "./web/utils/treeUtils"
import type { MarkdownRange } from "./commonTypes"

/**
 * What to show in place of an image.
 *
 * The native contract asks for a view with a definite size, because the text
 * layout has to know how much room to leave before it lays the line out. The
 * web has no such requirement -- the browser reflows around whatever turns up
 * -- but the same callback runs on both, so write it for the stricter one.
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

// `useLayoutEffect` warns when it runs during a server render, and there is no layout to be before
// on a server anyway. Same seam the input uses.
const useClientEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const NO_SLOTS: HTMLElement[] = []

/**
 * Replaces each placeholder character in the built markup with an empty element
 * to render an embed into.
 *
 * The elements have to be made here rather than rendered, because everything
 * under the host is raw DOM this component built and React knows nothing about
 * -- so the embeds are portalled into these afterwards, which is the one way to
 * put a React subtree somewhere React did not put it.
 *
 * Text nodes are collected before any of them is split: splitting rewrites the
 * tree the walker is walking.
 */
function mountEmbedSlots(host: HTMLElement): HTMLElement[] {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  // `globalThis` because `Text` in this file is the react-native one.
  const texts: globalThis.Text[] = []

  while (walker.nextNode()) {
    texts.push(walker.currentNode as globalThis.Text)
  }

  const slots: HTMLElement[] = []

  for (const text of texts) {
    let node = text
    let index = node.data.indexOf(OBJECT_REPLACEMENT)

    while (index !== -1) {
      const placeholder = node.splitText(index)
      const rest = placeholder.splitText(OBJECT_REPLACEMENT.length)
      const slot = document.createElement("span")

      // Inline-block so the embed sits in the line the way an attachment does
      // on native, on the baseline and taking the width it asks for.
      slot.style.display = "inline-block"
      slot.setAttribute("data-embed", String(slots.length))

      placeholder.replaceWith(slot)
      slots.push(slot)

      node = rest
      index = node.data.indexOf(OBJECT_REPLACEMENT)
    }
  }

  return slots.length > 0 ? slots : NO_SLOTS
}

/**
 * How the list markers are drawn, read off the element they will be drawn in.
 *
 * A display renders them rather than showing them, and their size comes from the base font --
 * whatever the wrapped `Text` resolved to, so it is asked rather than assumed.
 */
function markerRendering(host: HTMLElement) {
  return { display: true, fontSize: parseFloat(window.getComputedStyle(host).fontSize) || 0 }
}

/** Anything with a scheme this does not name stays a span rather than an anchor. */
const SAFE_SCHEME = /^(?:https?|mailto|tel):/i
const SCHEME = /^[a-z][a-z0-9+.\-]*:/i

/**
 * The destination as an `href`, or nothing if it must not become one.
 *
 * A browser strips whitespace and control characters before it reads a scheme,
 * so `java\nscript:alert(1)` is `javascript:` as far as it is concerned, and it
 * has to be here too. Anything carrying a scheme that is not one of the four
 * safe ones is refused outright rather than guessed at; a destination with no
 * scheme is a relative URL and is left to resolve the way any other relative
 * link on the page does.
 */
function hrefFor(uri: string) {
  const bare = uri.replace(/[\u0000-\u0020]/g, "")

  if (bare === "" || (SCHEME.test(bare) && !SAFE_SCHEME.test(bare))) {
    return null
  }

  return uri
}

/**
 * Turns the elements a link was built into into anchors, and marks them with
 * the link they belong to.
 *
 * The markup is not one element per link: a label split over two lines is built
 * into one span per line, and a label with emphasis in it is a span with more
 * spans inside. So the press is caught on the host and walked back up to the
 * nearest marked ancestor, and all this has to do is put the mark on every
 * element that a link's own range produced.
 *
 * An anchor rather than a marked span because only an anchor is a link to the
 * browser: it shows the destination in the status bar on hover, it is in the
 * tab order, screen readers announce it, and the context menu can copy or open
 * it. The click handler stops it navigating -- what a link means is the
 * application's to decide -- and lets a modified click through, which is how
 * "open in a new tab" keeps working. A destination that cannot safely be an
 * href stays a marked span: pressable, but not something a browser will follow.
 */
function markLinks(node: TreeNode, links: MarkdownLink[]) {
  if (node.type === "link") {
    const index = links.findIndex(
      (link) => node.start >= link.start && node.start < link.start + link.length,
    )

    // A reference link has no destination yet, so its label is styled as a link
    // and left inert rather than marked.
    if (index !== -1) {
      const link = links[index]!
      const href = hrefFor(link.uri)
      let element = node.element

      if (href !== null) {
        const anchor = document.createElement("a") as unknown as HTMLMarkdownElement

        // Everything the builder put on the span, styles and `data-type` and
        // the tree's own `data-id` alike: this is the same node, in a tag that
        // means something.
        for (const attribute of Array.from(element.attributes)) {
          anchor.setAttribute(attribute.name, attribute.value)
        }

        anchor.value = element.value
        anchor.append(...Array.from(element.childNodes))
        anchor.setAttribute("href", href)
        // Untrusted markdown opened in a new tab has no business reaching back.
        anchor.setAttribute("rel", "noopener noreferrer")

        if (link.title !== "") {
          anchor.setAttribute("title", link.title)
        }

        element.replaceWith(anchor)
        node.element = anchor
        element = anchor
      } else {
        // Nothing else on the page is reachable by keyboard, and a link a
        // pointer can press and a keyboard cannot is not a link.
        element.setAttribute("role", "link")
        element.setAttribute("tabindex", "0")
        element.style.cursor = "pointer"
      }

      element.setAttribute("data-link", String(index))
    }
  }

  node.childNodes.forEach((child) => markLinks(child, links))
}

/**
 * `Text`, with the markdown in its content rendered rather than shown.
 *
 * Built by the same DOM builder the input uses, from the same ranges, so a message and the composer
 * it was typed in agree by construction -- which on the web means agreeing about indents, about
 * ribbons drawn as background layers, and about the marker widths those are measured from. The only
 * difference is the input, where the syntax is still there to be edited.
 *
 * Rendered as a real `Text` whose children are then replaced. React only ever writes the stripped
 * string into the host element -- a lone string child is set with `textContent`, never as a node it
 * holds on to -- so the effect below is free to put the built markup there instead, and a render
 * that changes the text simply wipes it and lets the effect rebuild before the frame is painted.
 * Rendering the plain string rather than nothing also means a prerendered page carries the prose:
 * `expo export` runs every route through Node, where there is no DOM to build markup with.
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

  if (parser === undefined) {
    throw new Error("[react-native-marcus] `parser` is undefined")
  }

  const hostRef = React.useRef<HTMLElement | null>(null)
  const [slots, setSlots] = React.useState<HTMLElement[]>(NO_SLOTS)

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

  const markdownStyle = React.useMemo(
    () => processMarkdownStyle(markdownStyleProp as never),
    [markdownStyleProp],
  )

  // What React writes into the host, and so what a prerendered page carries. The placeholders go:
  // they only mean anything to the markup the effect builds, and a page rendered in Node -- where
  // there is no DOM to build that markup with -- would otherwise show a row of tofu.
  const content = React.useMemo(() => {
    if (markdown === null) {
      return null
    }

    return markdown.embeds.length > 0
      ? markdown.text.split(OBJECT_REPLACEMENT).join("")
      : markdown.text
  }, [markdown])

  useClientEffect(() => {
    const host = hostRef.current
    if (!host || markdown === null) {
      return
    }

    const { dom, tree } = parseRangesToHTMLNodes(
      markdown.text,
      markdown.ranges,
      true,
      markdownStyle,
      false,
      // Measured against this element, so marker widths come out in the font the text is actually
      // drawn in rather than the document's default.
      createTextMeasurer(host),
      // A display renders the list markers rather than showing them, sized from the font this
      // element renders at: the base font, which is the wrapped `Text`'s own.
      markerRendering(host),
    )

    if (markdown.links.length > 0) {
      markLinks(tree, markdown.links)
    }

    host.replaceChildren(...Array.from(dom.childNodes))

    const next = markdown.embeds.length > 0 ? mountEmbedSlots(host) : NO_SLOTS

    // Both empty is the overwhelmingly common case, and setting state there would re-render every
    // document that has no embeds in it for nothing.
    setSlots((previous) => (previous === NO_SLOTS && next === NO_SLOTS ? previous : next))
    // React wipes the host with `textContent` whenever the string child changes, which is exactly
    // when `markdown` does, so these two are all it takes to be sure the markup is back before the
    // frame is painted.
  }, [markdown, markdownStyle])

  // On the host rather than on each link: the markup underneath is rebuilt from
  // scratch whenever the text changes, and a listener per element would have to
  // be attached again every time.
  useClientEffect(() => {
    const host = hostRef.current

    if (!host || markdown === null || onLinkPress === undefined || markdown.links.length === 0) {
      return undefined
    }

    const { links } = markdown

    const linkAt = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest("[data-link]") : null

      return element === null ? undefined : links[Number(element.getAttribute("data-link"))]
    }

    const press = (event: MouseEvent | KeyboardEvent) => {
      const link = linkAt(event.target)

      if (link === undefined) {
        return
      }

      // A modified click belongs to the browser: on an anchor it opens the
      // destination in a new tab or a new window, which is what the reader
      // asked for and something no callback can do for them.
      if (
        "button" in event &&
        (event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey)
      ) {
        return
      }

      event.preventDefault()
      onLinkPress(link.uri, link.label, link.title)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Enter and not Space: Space activates a button, and scrolls everywhere
      // else, which is what a reader who has tabbed onto a link expects of it.
      if (event.key === "Enter") {
        press(event)
      }
    }

    host.addEventListener("click", press as EventListener)
    host.addEventListener("keydown", onKeyDown as EventListener)

    return () => {
      host.removeEventListener("click", press as EventListener)
      host.removeEventListener("keydown", onKeyDown as EventListener)
    }
  }, [markdown, onLinkPress])

  const setRef = React.useCallback(
    (node: unknown) => {
      hostRef.current = node as HTMLElement | null

      if (typeof ref === "function") {
        ref(node as MarkdownText)
      } else if (ref) {
        // eslint-disable-next-line no-param-reassign
        ref.current = node as MarkdownText
      }
    },
    [ref],
  )

  return (
    <>
      <Text {...textProps} ref={setRef as never}>
        {markdown === null ? children : content}
      </Text>
      {renderEmbed !== undefined && markdown !== null
        ? slots.map((slot, index) => {
            const embed = markdown.embeds[index]

            // The slots were made from this very `markdown`, so they line up -- but a render
            // between a text change and the effect that follows it can still see the previous
            // set, one entry longer than the new document has embeds.
            return embed === undefined
              ? null
              : createPortal(
                  renderEmbed(embed.uri, embed.alt, embed.title, embed.inline),
                  slot,
                  String(index),
                )
          })
        : null}
    </>
  )
})

export type { MarkdownTextProps, OnLinkPress, RenderEmbed }

export default MarkdownText
