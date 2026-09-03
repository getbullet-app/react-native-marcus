#!/usr/bin/env tsx
/**
 * Mirrors the TypeScript fixture corpus to JSON, and with it the ranges the
 * parser produces for each case.
 *
 * The Android and iOS test targets cannot import TypeScript, and they cannot
 * run the worklet parser either -- but a formatter takes ranges, not markdown,
 * so `ranges.json` is what makes them testable without a JS runtime at all. The
 * JS parser stays the only thing that produces ranges; the native suites
 * consume them.
 *
 * Both files are committed so the native suites need no build step, and
 * `--check` keeps them honest in CI.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import "../src/parser/index.ts"

import type { MarkdownRange } from "../src/commonTypes.ts"
import { CASES } from "../src/__fixtures__/cases.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const ids = CASES.map((c) => c.id)
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)

if (duplicates.length > 0) {
  console.error(`✖  Duplicate fixture ids: ${[...new Set(duplicates)].join(", ")}`)
  process.exit(1)
}

const ranges: Record<string, MarkdownRange[]> = {}

for (const testCase of CASES) {
  ranges[testCase.id] = globalThis.__parse__micromark(testCase.markdown)
}

const rangeCount = Object.values(ranges).reduce((total, list) => total + list.length, 0)

const artifacts = [
  {
    file: join(root, "src/__fixtures__/cases.json"),
    content: `${JSON.stringify(CASES, null, 2)}\n`,
    label: `${CASES.length} cases`,
  },
  {
    file: join(root, "src/__fixtures__/ranges.json"),
    content: `${JSON.stringify(ranges, null, 2)}\n`,
    label: `${rangeCount} ranges`,
  },
]

const checking = process.argv.includes("--check")
let stale = false

for (const { file, content, label } of artifacts) {
  const rel = relative(root, file)

  if (!checking) {
    writeFileSync(file, content)
    console.log(`✔  Wrote ${label} to ${rel}`)
    continue
  }

  let actual: string | null = null

  try {
    actual = readFileSync(file, "utf8")
  } catch {
    // Missing counts as stale.
  }

  if (actual !== content) {
    console.error(`✖  ${rel} is stale. Run \`npm run fixtures\` and commit the result.`)
    stale = true
  } else {
    console.log(`✔  ${rel} is up to date (${label})`)
  }
}

if (stale) {
  process.exit(1)
}
