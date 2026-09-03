import type { MarkdownRange } from "../commonTypes"
import { getTagPriority, sortRanges, ungroupRanges } from "../rangeUtils"
import { CASES } from "../__fixtures__/cases"
import { parse } from "./helpers/parse"

function range(type: string, start: number, length: number, depth?: number): MarkdownRange {
  return depth === undefined
    ? ({ type, start, length } as MarkdownRange)
    : ({ type, start, length, depth } as MarkdownRange)
}

describe("getTagPriority", () => {
  it("ranks a container above the marker it contains", () => {
    // The one inversion the table exists for. Typing `>` emits three ranges over
    // one character in the opposite order to a tree, and these keys undo that.
    expect(getTagPriority("blockquote")).toBeGreaterThan(getTagPriority("block-prefix"))
    expect(getTagPriority("block-prefix")).toBeGreaterThan(getTagPriority("syntax"))
  })

  it("ranks list containers with blockquote", () => {
    expect(getTagPriority("list-ordered")).toBe(getTagPriority("blockquote"))
    expect(getTagPriority("list-unordered")).toBe(getTagPriority("blockquote"))
  })

  it("puts heading above inline content and emoji below everything", () => {
    expect(getTagPriority("heading")).toBeGreaterThan(getTagPriority("bold"))
    expect(getTagPriority("emoji")).toBeLessThan(getTagPriority("bold"))
  })

  it("gives unknown types the default rank", () => {
    expect(getTagPriority("bold")).toBe(0)
    expect(getTagPriority("not-a-real-type")).toBe(0)
  })
})

describe("sortRanges", () => {
  it("sorts by start, then longest first, then priority", () => {
    const sorted = sortRanges([
      range("syntax", 0, 1),
      range("blockquote", 0, 5, 1),
      range("block-prefix", 0, 2),
      range("bold", 2, 3),
    ])

    expect(sorted.map((r) => r.type)).toEqual(["blockquote", "block-prefix", "syntax", "bold"])
  })

  it("keeps emission order for ranges the keys cannot separate", () => {
    // Two containers of the same size over the same line nest opposite ways in
    // `> - a` and `- > a`, so which encloses which is not a property of their
    // types -- only the order the parser emitted them in says.
    const quoteFirst = sortRanges([range("blockquote", 0, 5, 1), range("list-unordered", 0, 5, 1)])
    expect(quoteFirst.map((r) => r.type)).toEqual(["blockquote", "list-unordered"])

    const listFirst = sortRanges([range("list-unordered", 0, 5, 1), range("blockquote", 0, 5, 1)])
    expect(listFirst.map((r) => r.type)).toEqual(["list-unordered", "blockquote"])
  })

  it("sorts in place", () => {
    // Load bearing: `parserUtils` runs `layoutBlocks` over the parser's emission
    // order and only then calls this, so making it pure would silently reorder
    // the input the layout walk depends on.
    const input = [range("bold", 5, 2), range("blockquote", 0, 9, 1)]
    const result = sortRanges(input)

    expect(result).toBe(input)
    expect(input[0]!.type).toBe("blockquote")
  })

  // Two parser-level facts, not sort bugs, and not web bugs either:
  //
  //   1. Code is emitted as one multi-line range while block containers are
  //      emitted per line, so a code block inside a quote cannot nest in it.
  //   2. `emitCodeBlock` extends code content past its trailing newline but the
  //      container range keeps micromark's bounds, so on an indented block's
  //      last line the `pre` ends one character past its `codeblock`.
  //
  // `normalizeLines` already compensates on web -- `codeblock` is in
  // MULTILINE_MARKDOWN_TYPES and gets its lines merged, and anything else
  // spanning lines is split per line. So the tree invariant holds after
  // normalization, not on raw emission. Whether the native formatters
  // compensate the same way is open until the Phase 4 span dumps exist.
  const KNOWN_STRADDLES = ["code-in-blockquote", "code-indented"]

  function findStraddles(id: string, markdown: string): string[] {
    const sorted = sortRanges(parse(markdown))
    const found: string[] = []
    const open: MarkdownRange[] = []

    for (const current of sorted) {
      const end = current.start + current.length

      while (open.length > 0) {
        const top = open[open.length - 1]!
        if (top.start + top.length > current.start) break
        open.pop()
      }

      const parent = open[open.length - 1]

      if (parent && end > parent.start + parent.length) {
        found.push(
          `${id}: ${current.type} ${current.start}..${end} straddles ` +
            `${parent.type} ${parent.start}..${parent.start + parent.length}`,
        )
      }

      open.push(current)
    }

    return found
  }

  it("nests every fixture except the known code-block cases", () => {
    // Nothing may straddle: a range that starts inside another must also end
    // inside it, or the DOM builder has no tree to nest and the shared
    // characters render once per range.
    const offenders = CASES.filter(({ id, markdown }) => findStraddles(id, markdown).length > 0)

    expect(offenders.map((c) => c.id).sort()).toEqual(KNOWN_STRADDLES)
  })

  it("straddles exactly where the code-block ranges are known to", () => {
    // Snapshotted rather than asserted away: fixing either issue changes this
    // and says so, instead of leaving a stale allowance behind.
    const straddles = CASES.flatMap(({ id, markdown }) => findStraddles(id, markdown))

    expect(straddles.join("\n")).toMatchSnapshot()
  })
})

describe("ungroupRanges", () => {
  it("passes through a range with no depth", () => {
    expect(ungroupRanges([range("bold", 0, 4)])).toEqual([range("bold", 0, 4)])
  })

  it("expands a depth into that many copies and drops the depth", () => {
    const result = ungroupRanges([range("blockquote", 0, 7, 3)])

    expect(result).toHaveLength(3)
    for (const item of result) {
      expect(item).toEqual({ type: "blockquote", start: 0, length: 7 })
      expect("depth" in item).toBe(false)
    }
  })

  it("passes a depth of 0 through untouched, depth included", () => {
    // The guard is `!range.depth`, so 0 takes the pass-through branch and keeps
    // its (falsy) depth rather than being stripped like an expanded copy.
    expect(ungroupRanges([range("blockquote", 0, 7, 0)])).toEqual([
      { type: "blockquote", start: 0, length: 7, depth: 0 },
    ])
  })

  it("returns the same object for every copy of one range", () => {
    // Documented rather than endorsed: the copies alias, so a caller that edits
    // one edits them all. Fine while consumers only read.
    const [first, second] = ungroupRanges([range("blockquote", 0, 7, 2)])

    expect(first).toBe(second)
  })
})
