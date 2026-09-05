import type { PartialMarkdownStyle } from "../styleUtils"
import { layoutBlocks, toNumber } from "../web/utils/blockLayout"
import type { MarkerRendering } from "../web/utils/blockLayout"
import { CASES } from "../__fixtures__/cases"
import { parse } from "./helpers/parse"

/**
 * The web half of the block layout walk, which is a deliberate port of
 * `BlockLayout` in `apple/MarkdownFormatter.swift` and its Android counterpart.
 * Measurement is injected, so the arithmetic can be pinned exactly instead of
 * being read back out of a browser.
 */

// The shipped defaults, spelled out so the expected numbers are checkable by
// hand: a quote steps 6 + 6 + 6 = 18, a list steps 6 + 18 = 24.
const STYLE: PartialMarkdownStyle = {
  blockquote: { marginLeft: 6, borderWidth: 6, paddingLeft: 6 },
  orderedList: { marginLeft: 6, paddingLeft: 18, markerScale: 0.8, markerPadding: 2 },
  unorderedList: { marginLeft: 6, paddingLeft: 18, markerScale: 0.3, markerPadding: 2 },
}

const QUOTE_STEP = 18
const LIST_STEP = 24

/** Ten units per character, so a marker's width is legible in the expectations. */
const measure = (text: string) => text.length * 10

/** A display's markers, sized from a base font round enough to check by hand. */
const DISPLAY: MarkerRendering = { display: true, fontSize: 20 }

const MARKER_PADDING = 2
/** `unorderedList.markerScale` of the base font size above. */
const BULLET = 6

function layout(markdown: string) {
  return layoutBlocks(markdown, parse(markdown), STYLE, measure)
}

/** The same document as a `MarkdownText` lays it out, markers rendered rather than shown. */
function display(markdown: string) {
  return layoutBlocks(markdown, parse(markdown), STYLE, measure, DISPLAY)
}

describe("toNumber", () => {
  it("passes numbers through and parses numeric strings", () => {
    expect(toNumber(12)).toBe(12)
    expect(toNumber("12")).toBe(12)
    expect(toNumber("12px")).toBe(12)
    expect(toNumber("1.5")).toBe(1.5)
  })

  it("treats anything unusable as zero", () => {
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber("")).toBe(0)
    expect(toNumber("auto")).toBe(0)
  })
})

describe("layoutBlocks", () => {
  it("reserves a gutter and steps over the marker", () => {
    // `> x`: reserve 18 for the bar, then step over the two characters of `> `.
    const line = layout("> x").get(0)!

    expect(line.firstLineIndent).toBe(QUOTE_STEP)
    expect(line.indent).toBe(QUOTE_STEP + measure("> "))
    expect(line.ribbons).toEqual([6])
  })

  it("draws one ribbon per quote level", () => {
    const line = layout(">> x").get(0)!

    expect(line.ribbons).toEqual([6, 6 + QUOTE_STEP])
    expect(line.firstLineIndent).toBe(QUOTE_STEP * 2)
  })

  it("reserves a list gutter without a ribbon", () => {
    const line = layout("- x").get(0)!

    expect(line.firstLineIndent).toBe(LIST_STEP)
    expect(line.indent).toBe(LIST_STEP + measure("- "))
    expect(line.ribbons).toEqual([])
  })

  it("puts a quote's ribbon after a list's marker", () => {
    // `- > x`: the list reserves first, then its bullet is stepped over, and
    // only then does the quote's bar get a place to sit.
    const line = layout("- > x").get(0)!

    expect(line.ribbons).toEqual([LIST_STEP + measure("- ") + 6])
  })

  it("puts a list's indent after a quote's marker", () => {
    const line = layout("> - x").get(0)!

    expect(line.ribbons).toEqual([6])
    expect(line.indent).toBe(QUOTE_STEP + measure("> ") + LIST_STEP + measure("- "))
  })

  it("keeps a continuation line aligned with the line that opened the block", () => {
    // The second line carries no marker of its own, so it reuses the first
    // line's. Without that it would sit a marker's width to the left and split
    // the block in two.
    const layouts = layout("- first\n  second")
    const [first, second] = [...layouts.values()]

    expect(second!.indent).toBe(first!.indent)
  })

  it("indents wrapped text past the marker", () => {
    // firstLineIndent stops where the marker starts; indent is where the line
    // resumes when it wraps, which is past it.
    const line = layout("> x").get(0)!

    expect(line.indent).toBeGreaterThan(line.firstLineIndent)
  })

  it("produces no layout for a line with no containers", () => {
    expect(layout("plain **bold** text").size).toBe(0)
  })

  it("leaves a display's ordered marker the width its own scale makes it", () => {
    // `1. x`: reserve 24, hold 2 either side of the marker, and step over `1.`
    // drawn at 0.8. Only the marker scales -- the space behind it separates the
    // marker from the text and belongs to the text's own size.
    const line = display("1. x").get(0)!

    expect(line.firstLineIndent).toBe(LIST_STEP + MARKER_PADDING)
    expect(line.indent).toBe(
      LIST_STEP + MARKER_PADDING + measure("1.") * 0.8 + measure(" ") + MARKER_PADDING,
    )
  })

  it("gives a display's bullet the width of the circle rather than of the marker", () => {
    // The `-` is not drawn, so the circle stands in for it; the space behind it
    // measures as it always did.
    const line = display("- x").get(0)!

    expect(line.indent).toBe(LIST_STEP + MARKER_PADDING + BULLET + measure(" ") + MARKER_PADDING)
  })

  it("holds the padding after a marker open with a gap", () => {
    // The same character a nested container's gutter is held open on, so the two
    // add up rather than replacing each other -- exactly as the kerning does on
    // iOS and the replacement span on Android.
    const line = display("- > x").get(0)!

    expect(line.gaps.get(0)).toBe(MARKER_PADDING + QUOTE_STEP)
  })

  it("shows an input's markers as they were typed", () => {
    // No padding and no bullet: what is on the screen is what is in the buffer,
    // and the text starts wherever the marker's own glyphs end.
    const line = layout("- x").get(0)!

    expect(line.firstLineIndent).toBe(LIST_STEP)
    expect(line.indent).toBe(LIST_STEP + measure("- "))
    expect(line.gaps.size).toBe(0)
  })

  it("is stable across every block fixture", () => {
    const blocks = CASES.filter(({ tags }) =>
      tags.some((tag) => tag === "list" || tag === "blockquote" || tag === "nesting"),
    )

    const dump = blocks
      .map(({ id, markdown }) => {
        const lines = [...layout(markdown).entries()].map(
          ([start, line]) =>
            `    ${start}: first=${line.firstLineIndent} indent=${line.indent} ` +
            `ribbons=[${line.ribbons.join(",")}] gaps={${[...line.gaps.entries()]
              .map(([k, v]) => `${k}:${v}`)
              .join(",")}}`,
        )

        return `${id}\n${lines.join("\n") || "    (none)"}`
      })
      .join("\n")

    expect(dump).toMatchSnapshot()
  })
})
