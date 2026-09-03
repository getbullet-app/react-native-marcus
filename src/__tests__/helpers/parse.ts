import "../../parser"

import type { MarkdownRange } from "../../commonTypes"

/**
 * `src/parser/index.ts` exports nothing at runtime -- it assigns
 * `globalThis.__parse__micromark` and only *declares* a `parse` export so the
 * public typings work. The real export is synthesized by the esbuild banner in
 * `scripts/bundle-parser.mjs`, which wraps the module in a worklet function.
 *
 * So tests import the module for its side effect and reach for the global.
 * `import { parse } from "../parser"` type-checks and is `undefined` at
 * runtime; see the guard in `parser.test.ts`.
 */
function parse(markdown: string): MarkdownRange[] {
  return globalThis.__parse__micromark(markdown)
}

/**
 * Renders ranges as one line each, in emission order, with the text each one
 * covers. Order is part of the contract the native formatters rely on, so the
 * snapshot has to preserve it rather than sorting into something tidier.
 */
function formatRanges(markdown: string, ranges: MarkdownRange[]): string {
  if (ranges.length === 0) {
    return "(no ranges)"
  }

  const width = Math.max(...ranges.map((r) => r.type.length))

  return ranges
    .map((range) => {
      const end = range.start + range.length
      const span = `${range.start}..${end}`.padStart(8)
      const depth = range.depth === undefined ? "" : ` depth=${range.depth}`
      const text = JSON.stringify(markdown.slice(range.start, end))
      return `${range.type.padEnd(width)}${span}  ${text}${depth}`
    })
    .join("\n")
}

export { parse, formatRanges }
