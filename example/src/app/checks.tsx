import { useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { MarkdownTextInput, getWorkletRuntime, parser } from "react-native-marcus"
import type { MarkdownRange } from "react-native-marcus"
import { runOnJS, runOnRuntime } from "react-native-worklets"

import CASES from "../../../src/__fixtures__/cases.json"
import RANGES from "../../../src/__fixtures__/ranges.json"

/**
 * Two whole-corpus checks that only make sense on a device. Detox alone can
 * read strings out of the view hierarchy, so each mode does its own comparison
 * here and reports a single verdict for a spec to assert on.
 *
 * `?mode=parser` runs every fixture through the parser on the worklet runtime.
 * That runtime is a separate Hermes instance with no Node and no host globals,
 * and it is the only place the shipped worklet bundle ever actually executes --
 * every other suite parses in Jest, where the full Node global object is in
 * scope and a dependency reaching for `process` would go unnoticed.
 *
 * `?mode=sweep` mounts every fixture in turn through the native formatter. A
 * range the formatter mishandles takes the whole app down, so surviving the
 * corpus is the assertion.
 */

const EXPECTED = RANGES as Record<string, MarkdownRange[]>

/** Order-independent, and readable when it turns up in a failure message. */
function canonical(ranges: MarkdownRange[]) {
  return ranges
    .map((range) => `${range.type}@${range.start}+${range.length}${range.depth ?? ""}`)
    .join(" ")
}

function ParserCheck({ report }: { report: (verdict: string) => void }) {
  const compare = useCallback(
    (parsed: MarkdownRange[][]) => {
      for (const [index, entry] of CASES.entries()) {
        const actual = canonical(parsed[index] ?? [])
        const expected = canonical(EXPECTED[entry.id] ?? [])

        if (actual !== expected) {
          report(`${entry.id}: expected [${expected}] got [${actual}]`)
          return
        }
      }

      report("ok")
    },
    [report],
  )

  useEffect(() => {
    const markdowns = CASES.map((entry) => entry.markdown)

    try {
      // The runtime exists because the input below mounted first and
      // registered its parser; there is no other way to reach it.
      runOnRuntime(getWorkletRuntime(), (inputs: string[]) => {
        "worklet"
        const parsed: MarkdownRange[][] = []
        for (const input of inputs) {
          parsed.push(parser(input))
        }
        runOnJS(compare)(parsed)
      })(markdowns)
    } catch (error) {
      report(`threw: ${String(error)}`)
    }
  }, [compare, report])

  return null
}

function Sweep({ report }: { report: (verdict: string) => void }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= CASES.length) {
      report("ok")
      return
    }

    const timer = setTimeout(() => setIndex(index + 1), 16)
    return () => clearTimeout(timer)
  }, [index, report])

  const entry = CASES[Math.min(index, CASES.length - 1)]

  return <MarkdownTextInput parser={parser} value={entry?.markdown ?? ""} multiline autoFocus={false} style={styles.input} />
}

export default function Checks() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const [verdict, setVerdict] = useState("running")

  // `output: "static"` prerenders this route in Node, where there is no worklet
  // runtime and no native formatter. Nothing here is meant to run on web.
  if (Platform.OS === "web") {
    return <Text testID="harness-check">unsupported</Text>
  }

  return (
    <View testID="harness-root" style={styles.container}>
      {mode === "sweep" ? (
        <Sweep report={setVerdict} />
      ) : (
        <>
          <MarkdownTextInput parser={parser} value="" multiline autoFocus={false} style={styles.input} />
          <ParserCheck report={setVerdict} />
        </>
      )}
      <Text testID="harness-check">{verdict}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    backgroundColor: "white",
    flex: 1,
  },
  input: {
    color: "black",
    fontSize: 16,
    padding: 8,
    width: 320,
  },
})
