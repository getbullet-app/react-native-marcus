import type { PartialMarkdownStyle } from "../../styleUtils"
import { toNumber } from "./blockLayout"
import type { LineLayout } from "./blockLayout"
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
) {
  const node = targetElement

  switch (type) {
    case "syntax":
      applyStyle(node, { color: markdownStyle.syntax?.color as string })
      break
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
    case "mention-here":
      addMentionStyle(node, markdownStyle.mentionHere)
      break
    case "mention-user":
      addMentionStyle(node, markdownStyle.mentionUser)
      break
    case "mention-report":
      addMentionStyle(node, markdownStyle.mentionReport)
      break
    case "link":
      applyStyle(node, {
        color: markdownStyle.link?.color as string,
        textDecoration: "underline",
      })
      break
    // Both carry a font, a colour and a background, and nothing else: native draws no border, no
    // corner radius and no padding around either, so neither does this.
    case "code":
      applyStyle(node, {
        fontFamily: markdownStyle.code?.fontFamily,
        fontSize: markdownStyle.code?.fontSize,
        color: markdownStyle.code?.color as string,
        backgroundColor: markdownStyle.code?.backgroundColor as string,
      })
      break
    case "pre":
      applyStyle(node, {
        fontFamily: markdownStyle.pre?.fontFamily,
        fontSize: markdownStyle.pre?.fontSize,
        color: markdownStyle.pre?.color as string,
        backgroundColor: markdownStyle.pre?.backgroundColor as string,
      })
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

function addMentionStyle(
  node: HTMLElement,
  style:
    | { color?: unknown; backgroundColor?: unknown; borderRadius?: string | number }
    | undefined,
) {
  applyStyle(node, {
    color: style?.color as string,
    backgroundColor: style?.backgroundColor as string,
    borderRadius: style?.borderRadius,
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
