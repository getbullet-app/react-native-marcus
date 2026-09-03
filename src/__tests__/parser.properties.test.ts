import fc from "fast-check"

import type { MarkdownRange } from "../commonTypes"
import { parse } from "./helpers/parse"

/**
 * The fixture corpus says the parser is right about inputs we thought of. These
 * say it stays well-formed on inputs we did not -- the shape the three native
 * formatters rely on, held over arbitrary text.
 *
 * Lone surrogates live here rather than in the shared corpus: they are a real
 * hazard for UTF-16 offset math, but they do not survive a round trip through
 * `cases.json` into the Kotlin and Swift suites, so the fuzzer is the honest
 * place for them.
 */

const MAX_DEPTH = 6
const BLOCK_PREFIX = "block-prefix"
const SYNTAX = "syntax"

/** Text that leans on the parser's own vocabulary, so runs reach real states. */
const PREFIX = fc.constantFrom("", "# ", "## ", "> ", ">> ", "- ", "1. ", "> - ", "- > ", "    ")
const INLINE = fc.constantFrom(
  "**bold**",
  "*it*",
  "_it_",
  "~~s~~",
  "`code`",
  "[a](https://e.com)",
  "https://e.com",
  "@user",
  "\u{1F600}",
  "\u{1D573}",
  "中文",
  "مرحبا",
  "text",
  "\\*",
  "&amp;",
  "  ",
  "\t",
  "﻿",
)
const LINE = fc
  .tuple(PREFIX, fc.array(INLINE, { maxLength: 5 }))
  .map(([prefix, parts]) => prefix + parts.join(" "))
const DOCUMENT = fc.array(LINE, { maxLength: 6 }).map((lines) => lines.join("\n"))

/** Raw fuzz, including lone surrogates and unassigned code points. */
const NOISE = fc.string({ unit: "binary", maxLength: 120 })

const ANY = fc.oneof(DOCUMENT, NOISE)

function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) {
    return false
  }

  const high = text.charCodeAt(index - 1)
  const low = text.charCodeAt(index)

  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff
}

function describeRange(range: MarkdownRange): string {
  return `${range.type} ${range.start}..${range.start + range.length}`
}

describe("parser properties", () => {
  it("never throws", () => {
    fc.assert(
      fc.property(ANY, (markdown) => {
        parse(markdown)
      }),
    )
  })

  it("emits ranges inside the input", () => {
    fc.assert(
      fc.property(ANY, (markdown) => {
        for (const range of parse(markdown)) {
          expect(range.length).toBeGreaterThan(0)
          expect(range.start).toBeGreaterThanOrEqual(0)
          expect(range.start + range.length).toBeLessThanOrEqual(markdown.length)
        }
      }),
    )
  })

  it("keeps depth within the cap", () => {
    fc.assert(
      fc.property(ANY, (markdown) => {
        for (const range of parse(markdown)) {
          if (range.depth === undefined) continue

          expect(range.depth).toBeGreaterThanOrEqual(0)
          expect(range.depth).toBeLessThanOrEqual(MAX_DEPTH)
        }
      }),
    )
  })

  it("never splits a surrogate pair", () => {
    // A boundary landing between the halves of a pair produces half a character
    // on every platform: an unpaired surrogate in an NSAttributedString range,
    // and an out-of-bounds or mangled substring in Kotlin.
    fc.assert(
      fc.property(ANY, (markdown) => {
        for (const range of parse(markdown)) {
          const end = range.start + range.length

          if (splitsSurrogatePair(markdown, range.start)) {
            throw new Error(`start splits a pair: ${describeRange(range)}`)
          }

          if (splitsSurrogatePair(markdown, end)) {
            throw new Error(`end splits a pair: ${describeRange(range)}`)
          }
        }
      }),
    )
  })

  it("pairs every block-prefix with the container that follows it", () => {
    fc.assert(
      fc.property(ANY, (markdown) => {
        const ranges = parse(markdown)

        ranges.forEach((range, i) => {
          if (range.type !== BLOCK_PREFIX) return

          const next = ranges[i + 1]

          if (!next || next.depth === undefined) {
            throw new Error(
              `${describeRange(range)} followed by ${next ? describeRange(next) : "nothing"}`,
            )
          }
        })
      }),
    )
  })

  it("is deterministic", () => {
    fc.assert(
      fc.property(ANY, (markdown) => {
        expect(parse(markdown)).toEqual(parse(markdown))
      }),
    )
  })

  it("merges adjacent ranges that push() is supposed to merge", () => {
    // `block-prefix` and `syntax` are exempt by design -- neighbours often sit
    // in different enclosures, and a merged range would straddle one of them.
    fc.assert(
      fc.property(ANY, (markdown) => {
        const ranges = parse(markdown)

        for (let i = 1; i < ranges.length; i++) {
          const previous = ranges[i - 1]!
          const range = ranges[i]!

          const mergeable =
            previous.type === range.type &&
            range.type !== BLOCK_PREFIX &&
            range.type !== SYNTAX &&
            previous.depth === undefined &&
            range.depth === undefined &&
            previous.start + previous.length === range.start

          if (mergeable) {
            throw new Error(`unmerged: ${describeRange(previous)} then ${describeRange(range)}`)
          }
        }
      }),
    )
  })
})
