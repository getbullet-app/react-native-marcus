import type { PartialMarkdownStyle } from "../../styleUtils"
import { SHOWN_MARKERS, toNumber } from "./blockLayout"
import type { LineLayout, MarkerRendering } from "./blockLayout"
import type { NodeType } from "./treeUtils"

/**
 * Assigns CSS properties, skipping the ones the style does not define.
 *
 * Lengths arrive here already carrying their unit -- `processMarkdownStyle` runs the style through
 * react-native-web's compiler before it reaches the builder -- but `parseRangesToHTMLNodes` can be
 * called with a plain object that has not, and `CSSStyleDeclaration` silently drops a bare number.
 * Adding the unit here means both spellings render the same.
 */
function applyStyle(node: HTMLElement, styles: Record<string, string | number | undefined>) {
  const target = node
  Object.entries(styles).forEach(([property, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(target.style as any)[property] = typeof value === "number" ? `${value}px` : value
  })
}

/**
 * Applies the layout the block walk computed for one line.
 *
 * Everything a container contributes lands here rather than on the container's own span: its gutter
 * is part of the paragraph's indent, and its ribbon is painted behind the whole paragraph. That is
 * how the native formatters do it too, and on the web it is the only placement that works -- a
 * container's span begins before the markers of the containers outside it, so a border drawn on it
 * would sit in front of a bullet that is meant to precede it, and a gutter set on it would open
 * before that bullet rather than after.
 *
 * `padding-left` holds every line of the paragraph at the indent, and the negative `text-indent`
 * pulls the first one back to where its own marker starts -- `firstLineHeadIndent` and `headIndent`,
 * spelled in CSS. A line that wraps, or a line continuing the block with no marker of its own, then
 * lines up with the text above it instead of with the marker.
 */
function addLineLayout(
  node: HTMLElement,
  layout: LineLayout | undefined,
  markdownStyle: PartialMarkdownStyle,
) {
  applyStyle(node, {
    margin: "0",
    padding: "0",
  })

  if (!layout) {
    return
  }

  if (layout.indent > 0) {
    applyStyle(node, {
      paddingLeft: `${layout.indent}px`,
      textIndent: `${layout.firstLineIndent - layout.indent}px`,
    })
  }

  const width = toNumber(markdownStyle.blockquote?.borderWidth)
  if (layout.ribbons.length === 0 || width <= 0) {
    return
  }

  // One background layer per ribbon, each a solid bar of its own. They are painted on the paragraph
  // rather than on any span so that they run its full height -- a quote that wraps gets one
  // unbroken bar, exactly as `MarkdownTextLayoutFragment` draws it over the whole fragment.
  const color = (markdownStyle.blockquote?.borderColor as string) || "transparent"
  applyStyle(node, {
    backgroundImage: layout.ribbons.map(() => `linear-gradient(${color}, ${color})`).join(", "),
    backgroundPosition: layout.ribbons.map((x) => `${x}px 0`).join(", "),
    backgroundSize: layout.ribbons.map(() => `${width}px 100%`).join(", "),
    backgroundRepeat: "no-repeat",
  })
}

/**
 * Opens the space a marker holds for the container that follows it.
 *
 * `MarkdownFormatter` kerns the marker's last character; the effect is the same, and it is what
 * puts a nested list's indent between the quote's `>` and the bullet rather than in front of both.
 */
function addBlockPrefixGap(node: HTMLElement, gap: number | undefined) {
  if (gap) {
    node.style.marginRight = `${gap}px`
  }
}

function addStyleToBlock(
  targetElement: HTMLElement,
  type: NodeType,
  markdownStyle: PartialMarkdownStyle,
  isMultiline = true,
  rendering: MarkerRendering = SHOWN_MARKERS,
) {
  const node = targetElement

  switch (type) {
    // A fenced block's language is its own type so that something can read it,
    // but in an input it is part of the fence you are typing and reads as
    // markup, so it is coloured like the rest of it.
    case "syntax":
    case "codeblock-language": {
      // A list's marker is the one syntax a display keeps, and it is drawn there
      // rather than shown -- everything else the colour is for has been stripped
      // out by the time a display is built, so this is the only case where the
      // two components part company.
      const list = rendering.display && type === "syntax" ? markerList(node) : null

      if (list) {
        addMarkerStyle(node, list, markdownStyle, rendering)
      } else {
        applyStyle(node, { color: markdownStyle.syntax?.color as string })
      }
      break
    }
    case "bold":
      node.style.fontWeight = "bold"
      break
    case "italic":
      node.style.fontStyle = "italic"
      break
    case "strikethrough":
      node.style.textDecoration = "line-through"
      break
    case "emoji":
      applyStyle(node, {
        fontFamily: markdownStyle.emoji?.fontFamily,
        fontSize: markdownStyle.emoji?.fontSize,
        // Native re-centres a run whose font changed against the line height; the browser has no
        // equivalent, and an emoji font left on the alphabetic baseline sits low.
        verticalAlign: "middle",
      })
      break
    // A pill: the same inline box an inline run of code sits in, and drawn the same way. The
    // padding and margin push the words either side of it apart, the padding grows into the
    // line's own spacing above and below rather than pushing the lines apart, and a mention that
    // wraps is rounded only where it begins and ends.
    case "mention":
      applyStyle(node, {
        color: markdownStyle.mention?.color as string,
        backgroundColor: markdownStyle.mention?.backgroundColor as string,
        borderRadius: markdownStyle.mention?.borderRadius,
        padding: markdownStyle.mention?.padding,
        margin: markdownStyle.mention?.margin,
      })
      break
    case "link":
      applyStyle(node, {
        color: markdownStyle.link?.color as string,
        textDecoration: "underline",
      })
      break
    // An inline box, which is what the platforms draw by hand: the padding and margin push the
    // words either side of it apart, the padding grows into the line's own spacing above and
    // below rather than pushing the lines apart, and a run that wraps is rounded only where it
    // begins and ends. All three are what CSS does with an inline element by default.
    case "code":
      applyStyle(node, {
        fontFamily: markdownStyle.code?.fontFamily,
        fontSize: markdownStyle.code?.fontSize,
        color: markdownStyle.code?.color as string,
        backgroundColor: markdownStyle.code?.backgroundColor as string,
        borderRadius: markdownStyle.code?.borderRadius,
        padding: markdownStyle.code?.padding,
        margin: markdownStyle.code?.margin,
      })
      break
    // The font and the colour of a block; the box it sits in is `codeblock`, which is the range
    // that covers the whole thing rather than only the code inside it.
    case "pre":
      applyStyle(node, {
        fontFamily: markdownStyle.pre?.fontFamily,
        fontSize: markdownStyle.pre?.fontSize,
        color: markdownStyle.pre?.color as string,
      })
      break
    case "codeblock":
      addCodeBlockStyle(node, markdownStyle, isMultiline)
      break
    // Block containers hold no box of their own: their gutters and ribbons belong to the
    // paragraph, in `addLineLayout`. All that is left is letting a long unbroken word inside one
    // break rather than push the line past the input's edge.
    case "blockquote":
    case "list-ordered":
    case "list-unordered":
      applyStyle(node, { overflowWrap: "anywhere" })
      break
    case "heading":
      addHeadingStyle(node, markdownStyle)
      break
    case "text":
      if (!isMultiline && targetElement.parentElement?.style) {
        // Move text background styles from parent to the text node
        const parentElement = targetElement.parentElement
        node.style.cssText = parentElement.style.cssText
        parentElement.style.cssText = ""
      }
      break
    default:
      break
  }
}

/**
 * The box behind a fenced or indented block: one fill for the whole thing, from the first line to
 * the last, which is what the native formatters draw.
 *
 * `codeblock` covers the block including its fences, and the builder merges all of its lines into
 * one element, so here the box is a real box rather than the several line rects each platform has
 * to fill by hand. What that costs is the one thing an element cannot do: a block opened after a
 * bullet or a quote's `>` shares that line in the buffer but not on screen, because a block-level
 * box drops below the marker in front of it.
 *
 * A singleline input has no room for a block at all -- every line of it is drawn on one -- so there
 * the background stays an inline one, painted behind the text.
 */
function addCodeBlockStyle(
  node: HTMLElement,
  markdownStyle: PartialMarkdownStyle,
  isMultiline: boolean,
) {
  const style = markdownStyle.pre

  applyStyle(node, {
    backgroundColor: style?.backgroundColor as string,
    borderRadius: style?.borderRadius,
  })

  if (!isMultiline) {
    return
  }

  applyStyle(node, {
    display: "block",
    // The padding is inside the box, so the box still spans the line rather than overflowing it.
    boxSizing: "border-box",
    padding: style?.padding,
    margin: style?.margin,
  })
}

/**
 * The list whose marker `node` is, or null if this syntax is something else.
 *
 * A marker is a `syntax` inside the `block-prefix` of a list container, which is a shape only a
 * list has: a quote's `>` is removed with the rest of the markup before a display is built.
 */
function markerList(node: HTMLElement): "list-ordered" | "list-unordered" | null {
  let current = node.parentNode as HTMLElement | null
  let inPrefix = false

  while (current && current.contentEditable !== "true") {
    const type = current.getAttribute?.("data-type")

    if (type === "block-prefix") {
      inPrefix = true
    } else if (type === "list-ordered" || type === "list-unordered") {
      return inPrefix ? type : null
    }

    current = current.parentNode as HTMLElement | null
  }

  return null
}

/**
 * Draws a list's marker: a bullet for an unordered item, the number at its own scale for an
 * ordered one.
 *
 * Both are sized from the base font rather than from a length of their own, so a list marks itself
 * in proportion to the prose it marks, and both are drawn in `syntax.color` -- which in a display,
 * where every other piece of syntax has been removed, is the list marker's colour and nothing
 * else's. `MarkdownFormatter` draws the same two shapes from the same numbers on iOS and Android.
 *
 * The bullet keeps the marker character inside it, boxed and invisible: it is what a reader copies
 * and what a screen reader announces, and the box is exactly the width `layoutBlocks` indented the
 * text past.
 */
function addMarkerStyle(
  node: HTMLElement,
  type: "list-ordered" | "list-unordered",
  markdownStyle: PartialMarkdownStyle,
  rendering: MarkerRendering,
) {
  const color = markdownStyle.syntax?.color as string
  const { fontSize } = rendering
  const scale = toNumber(
    (type === "list-ordered" ? markdownStyle.orderedList : markdownStyle.unorderedList)?.markerScale,
  )

  if (scale <= 0 || fontSize <= 0) {
    applyStyle(node, { color })
    return
  }

  if (type === "list-ordered") {
    applyStyle(node, { color, fontSize: fontSize * scale })
    return
  }

  const diameter = fontSize * scale

  // A box one line high, aligned to the top of the line, with the circle painted in the middle of
  // it: that is what centres the bullet on the line rather than on the text, which is where both
  // native platforms draw it. The height is the marker character's own line box -- an inline block
  // holding one line of text is exactly one line high -- so it follows the line height without
  // having to be told it.
  applyStyle(node, {
    display: "inline-block",
    width: diameter,
    verticalAlign: "top",
    backgroundImage: `radial-gradient(circle closest-side, ${color} 100%, transparent 100%)`,
    backgroundSize: `${diameter}px ${diameter}px`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    // The character is still in the box, and stays out of sight of everything but a selection.
    color: "transparent",
    overflow: "hidden",
  })
}

/**
 * Sizes a heading the way native does: level N is the base size scaled N-1 times.
 *
 * The level does not reach here -- `ungroupRanges` turns it into one nested span per level -- so
 * the scaling is expressed in `em` and compounds down the nesting to the same number. This runs
 * once the span is in the tree, which is what lets it tell an inner level from the outermost one.
 */
function addHeadingStyle(node: HTMLElement, markdownStyle: PartialMarkdownStyle) {
  const nested = isChildOfMarkdownElement(node, "heading")
  const scale = markdownStyle.heading?.scale

  applyStyle(node, {
    fontWeight: "bold",
    fontSize: nested ? `${scale === undefined ? 1 : scale}em` : markdownStyle.heading?.fontSize,
  })
}

const MULTILINE_MARKDOWN_TYPES = ["codeblock"]

function isMultilineMarkdownType(type: NodeType) {
  return MULTILINE_MARKDOWN_TYPES.includes(type)
}

function isDescendantOfMarkdownElement(
  node: HTMLElement,
  predicate: (type: string | null) => boolean,
): boolean {
  let currentNode = node.parentNode
  while (currentNode && (currentNode as HTMLElement)?.contentEditable !== "true") {
    const elementType = (currentNode as HTMLElement).getAttribute?.("data-type")
    if (predicate(elementType)) {
      return true
    }
    currentNode = currentNode.parentNode
  }
  return false
}

function isChildOfMarkdownElement(node: HTMLElement, elementType: NodeType): boolean {
  return isDescendantOfMarkdownElement(node, (type) => type === elementType)
}
function isChildOfMultilineMarkdownElement(node: HTMLElement): boolean {
  return isDescendantOfMarkdownElement(node, (type) =>
    MULTILINE_MARKDOWN_TYPES.includes(type as NodeType),
  )
}

export {
  addStyleToBlock,
  addLineLayout,
  addBlockPrefixGap,
  isMultilineMarkdownType,
  isChildOfMarkdownElement,
  isChildOfMultilineMarkdownElement,
  MULTILINE_MARKDOWN_TYPES,
}
