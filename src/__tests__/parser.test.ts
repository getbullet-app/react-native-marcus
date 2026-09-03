import { CASES } from "../__fixtures__/cases"
import { formatRanges, parse } from "./helpers/parse"

const MAX_DEPTH = 6

describe("parser", () => {
  it.each(CASES)("$id", ({ markdown }) => {
    expect(formatRanges(markdown, parse(markdown))).toMatchSnapshot()
  })
})

describe("range invariants", () => {
  it.each(CASES)("$id", ({ markdown }) => {
    const ranges = parse(markdown)

    for (const range of ranges) {
      // Zero-length ranges are dropped by push(); an empty one reaching a
      // formatter would apply an attribute to nothing on iOS and throw on
      // Android.
      expect(range.length).toBeGreaterThan(0)
      expect(range.start).toBeGreaterThanOrEqual(0)
      expect(range.start + range.length).toBeLessThanOrEqual(markdown.length)

      if (range.depth !== undefined) {
        expect(range.depth).toBeGreaterThanOrEqual(0)
        expect(range.depth).toBeLessThanOrEqual(MAX_DEPTH)
      }
    }
  })

  // MarkdownFormatter.swift stashes a `block-prefix` in `pendingPrefix` and
  // hands it to the next range that has a gutter. Anything emitted between the
  // two would strand the prefix on the wrong container, so adjacency is part of
  // the emission contract rather than an incidental property of the output.
  it.each(CASES)("$id: every block-prefix is immediately followed by a container", ({
    markdown,
  }) => {
    const ranges = parse(markdown)

    ranges.forEach((range, i) => {
      if (range.type !== "block-prefix") return

      const next = ranges[i + 1]
      expect(next).toBeDefined()
      expect(next!.depth).toBeDefined()
    })
  })
})

describe("module shape", () => {
  it("exports nothing at runtime", async () => {
    // The `parse` export is declared for typings only and synthesized by the
    // esbuild banner at bundle time. If this ever starts passing, the parser
    // gained a real export and `helpers/parse.ts` should stop reaching for the
    // global.
    const mod = (await import("../parser")) as Record<string, unknown>
    expect(mod.parse).toBeUndefined()
  })

  it("installs the global the bundle footer calls", () => {
    expect(typeof globalThis.__parse__micromark).toBe("function")
  })
})
