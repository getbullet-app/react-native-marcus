import type { MarkdownRange, MarkdownType } from "../../commonTypes"
import type { PartialMarkdownStyle } from "../../styleUtils"
import type { TextMeasurer } from "./measureUtils"

const BLOCK_PREFIX = "block-prefix"

/**
 * Where one line's text sits, and what has to be drawn in the space to its left.
 *
 * The same three numbers the native formatters produce: `firstLineIndent` is `firstLineHeadIndent`
 * on iOS and `getLeadingMargin(true)` on Android, `indent` is the head indent the line resumes at
 * when it wraps, and `ribbons` are the offsets `MarkdownTextLayoutFragment` and
 * `MarkdownBlockIndentSpan` fill a blockquote's bars at.
 */
type LineLayout = {
  firstLineIndent: number
  indent: number
  ribbons: number[]
  /** Space to open after a marker, so the next container's gutter lands between the two. */
  gaps: Map<number, number>
}

function toNumber(value: string | number | undefined | null): number {
  if (typeof value === "number") {
    return value
  }
  if (!value) {
    return 0
  }
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The gutter one level of a container reserves, or null if the type is not one. */
function stepOf(type: MarkdownType, markdownStyle: PartialMarkdownStyle): number | null {
  switch (type) {
    case "blockquote":
      return (
        toNumber(markdownStyle.blockquote?.marginLeft) +
        toNumber(markdownStyle.blockquote?.borderWidth) +
        toNumber(markdownStyle.blockquote?.paddingLeft)
      )
    case "list-ordered":
      return (
        toNumber(markdownStyle.orderedList?.marginLeft) +
        toNumber(markdownStyle.orderedList?.paddingLeft)
      )
    case "list-unordered":
      return (
        toNumber(markdownStyle.unorderedList?.marginLeft) +
        toNumber(markdownStyle.unorderedList?.paddingLeft)
      )
    default:
      return null
  }
}

/**
 * Places the containers of every line, left to right -- the web half of `BlockLayout` in
 * `apple/MarkdownFormatter.swift` and `android/.../MarkdownFormatter.kt`, and deliberately the same
 * walk.
 *
 * Each container reserves a gutter and is then followed by its own marker, which is text and so has
 * to be stepped over rather than reserved: the container nested inside it starts after the marker,
 * not in front of it. That is what puts a quote's ribbons after a list bullet, and a list's indent
 * after a quote's `>`.
 *
 * A line continuing a block carries no marker of its own and reuses the one that opened it, which
 * is why this runs across the whole document rather than per line: without it a continuation line
 * would sit a marker's width to the left of the line above and break the block in two.
 *
 * It reads the ranges in the order the parser emits them -- marker, then the container it belongs
 * to -- so it has to run before `sortRanges` rearranges them into the containment order the DOM
 * builder needs.
 */
function layoutBlocks(
  text: string,
  ranges: MarkdownRange[],
  markdownStyle: PartialMarkdownStyle,
  measure: TextMeasurer,
): Map<number, LineLayout> {
  const layouts = new Map<number, LineLayout>()
  /** Last marker seen for each container type, for the lines that continue it. */
  const markers = new Map<MarkdownType, MarkdownRange>()
  const ribbonMargin = toNumber(markdownStyle.blockquote?.marginLeft)

  let pendingPrefix: MarkdownRange | null = null
  let line: LineLayout | null = null
  let lineStart = -1
  /** Offset reached so far, from the line's own left edge. */
  let offset = 0
  /**
   * Where the line's first marker begins, if it has one. The text starts there; everything past it
   * is held open with padding instead.
   */
  let textStart = -1
  /** Marker of the container placed most recently, if it is on this line and so has something to
   * pad. */
  let padded: MarkdownRange | null = null

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i] as MarkdownRange

    if (range.type === BLOCK_PREFIX) {
      pendingPrefix = range
      continue
    }

    const step = stepOf(range.type, markdownStyle)
    if (step === null) {
      continue
    }

    const depth = range.depth && range.depth > 0 ? range.depth : 1
    const gutter = step * depth

    if (range.start !== lineStart) {
      lineStart = range.start
      offset = 0
      textStart = -1
      padded = null
      line = { firstLineIndent: 0, indent: 0, ribbons: [], gaps: new Map() }
      layouts.set(lineStart, line)
    }

    const current = line as LineLayout

    if (padded) {
      current.gaps.set(padded.start, (current.gaps.get(padded.start) ?? 0) + gutter)
    }

    if (range.type === "blockquote") {
      for (let level = 0; level < depth; level++) {
        current.ribbons.push(offset + ribbonMargin + step * level)
      }
    }

    offset += gutter

    if (pendingPrefix) {
      markers.set(range.type, pendingPrefix)
      if (textStart < 0) {
        textStart = offset
      }
    }

    const marker = pendingPrefix ?? markers.get(range.type)
    if (marker) {
      offset += measure(text.substring(marker.start, marker.start + marker.length))
    }

    padded = pendingPrefix
    pendingPrefix = null

    current.firstLineIndent = textStart >= 0 ? textStart : offset
    current.indent = offset
  }

  return layouts
}

export { layoutBlocks, toNumber }
export type { LineLayout }
