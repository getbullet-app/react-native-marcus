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

/**
 * How a list's markers are drawn, which is the one thing a display does differently from an input.
 *
 * A display renders the marker rather than showing it: an unordered item's `-` becomes a bullet, an
 * ordered item's `1.` stays the number it means but at its own scale, and both hold a little room
 * either side. An input shows the marker you typed, in the base font, because there it is text
 * being edited rather than a rendering of it. `MarkdownFormatter` draws the same distinction on
 * both native platforms from the same style values.
 *
 * `fontSize` is what the wrapped element renders at, in pixels, which is what a marker is sized in
 * proportion to.
 */
type MarkerRendering = {
  display: boolean
  fontSize: number
}

/** An input's markers, and the default everywhere the question does not arise. */
const SHOWN_MARKERS: MarkerRendering = { display: false, fontSize: 0 }

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

/** The style entry a list type's markers are drawn from, or null if the type is not a list. */
function listStyle(type: MarkdownType, markdownStyle: PartialMarkdownStyle) {
  switch (type) {
    case "list-ordered":
      return markdownStyle.orderedList ?? null
    case "list-unordered":
      return markdownStyle.unorderedList ?? null
    default:
      return null
  }
}

/** Room held open either side of a marker, or nothing where the marker is shown rather than drawn. */
function markerPadding(
  type: MarkdownType,
  markdownStyle: PartialMarkdownStyle,
  rendering: MarkerRendering,
): number {
  if (!rendering.display) {
    return 0
  }

  return toNumber(listStyle(type, markdownStyle)?.markerPadding)
}

/**
 * The marker at the end of a prefix: the `-` of a bullet or the `1.` of a numbered item, without
 * the indent in front of it or the space after it.
 *
 * Read off the text rather than taken from the `syntax` range covering it, because a prefix runs
 * from wherever the previous container's marker ended and so can carry another container's marker
 * with it -- the ordered list in `- > 1. ` is handed `> 1. `. The last run of non-blanks is this
 * container's own. `MarkdownFormatter` reads it the same way on both native platforms.
 */
function markerRun(prefix: string): string {
  const trimmed = prefix.replace(/[ \t]+$/, "")
  const match = /[^ \t]+$/.exec(trimmed)

  return match ? match[0] : ""
}

/**
 * The width a prefix's glyphs take up: what it measures, with whatever the display draws in place
 * of the marker standing in for the marker's own width.
 */
function markerWidth(
  prefix: string,
  type: MarkdownType,
  markdownStyle: PartialMarkdownStyle,
  rendering: MarkerRendering,
  measure: TextMeasurer,
): number {
  const width = measure(prefix)
  const style = listStyle(type, markdownStyle)

  if (!rendering.display || rendering.fontSize <= 0 || !style) {
    return width
  }

  const run = markerRun(prefix)
  const scale = toNumber(style.markerScale)

  if (run === "" || scale <= 0) {
    return width
  }

  // What is left of the prefix -- an indent in front, the space behind -- measures as it always
  // did; only the marker itself is drawn differently.
  const rest = width - measure(run)

  return type === "list-unordered"
    ? rest + rendering.fontSize * scale
    : rest + measure(run) * scale
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
  rendering: MarkerRendering = SHOWN_MARKERS,
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

    // The room either side of a list marker is indent on the way in -- the marker moves right with
    // the text -- and a gap after the prefix on the way out, which is where the gutter of a nested
    // container goes too.
    const marker = pendingPrefix ?? markers.get(range.type)
    const padding = marker ? markerPadding(range.type, markdownStyle, rendering) : 0

    offset += padding

    if (pendingPrefix) {
      markers.set(range.type, pendingPrefix)
      if (textStart < 0) {
        textStart = offset
      }
    }

    if (marker) {
      const prefix = text.substring(marker.start, marker.start + marker.length)

      offset += markerWidth(prefix, range.type, markdownStyle, rendering, measure)
      offset += padding

      if (pendingPrefix && padding > 0) {
        current.gaps.set(pendingPrefix.start, (current.gaps.get(pendingPrefix.start) ?? 0) + padding)
      }
    }

    padded = pendingPrefix
    pendingPrefix = null

    current.firstLineIndent = textStart >= 0 ? textStart : offset
    current.indent = offset
  }

  return layouts
}

export { layoutBlocks, markerRun, SHOWN_MARKERS, toNumber }
export type { LineLayout, MarkerRendering }
