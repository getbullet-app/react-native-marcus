import { useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { MarkdownText, MarkdownTextInput, parser } from "react-native-marcus"

import CASES from "../../../src/__fixtures__/cases.json"

/**
 * The test harness. Not part of the demo -- Playwright and Detox drive this
 * route, one fixture at a time.
 *
 * A single static route taking `?case=<id>` rather than a dynamic segment: with
 * `output: "static"` a dynamic route only exists in `dist/` for the params
 * enumerated by `generateStaticParams`, and the query form needs no codegen and
 * doubles as the native deep link. `?text=` drives an input the corpus does not
 * carry, which is what the edit-sequence specs need.
 *
 * Everything that would make a rendering non-deterministic is pinned: a fixed
 * width, an explicit markdownStyle, no placeholder, and no autofocus -- a
 * blinking caret is the classic screenshot flake.
 */

const CASE_BY_ID = new Map(CASES.map((entry) => [entry.id, entry]))

function renderEmbed(uri: string, alt: string, title: string, inline: boolean) {
  return (
    <View
      testID="harness-embed"
      // Where a spec reads back what the callback was handed: the label is not
      // in the markup the component builds, so nothing else would show it.
      accessibilityLabel={`${alt} ${inline ? "inline" : "block"}`}
      style={styles.embed}
    />
  )
}

const MARKDOWN_STYLE = {
  syntax: { color: "gray" },
  link: { color: "blue" },
  heading: { fontSize: 38, scale: 0.85 },
  blockquote: { borderColor: "gray", borderWidth: 6, marginLeft: 6, paddingLeft: 6 },
  orderedList: { marginLeft: 6, paddingLeft: 18 },
  unorderedList: { marginLeft: 6, paddingLeft: 18 },
  code: { color: "black", backgroundColor: "lightgray" },
  pre: { color: "black", backgroundColor: "lightgray" },
} as const

export default function Harness() {
  const {
    case: caseId,
    text,
    display,
    embeds,
    links,
  } = useLocalSearchParams<{
    case?: string
    text?: string
    display?: string
    embeds?: string
    links?: string
  }>()
  const [value, setValue] = useState<string | null>(null)
  const [pressed, setPressed] = useState("none")

  // Everything the callback was handed, on one line, so a spec can assert the
  // whole signature rather than just that something fired.
  const onLinkPress = useCallback((uri: string, label: string, title: string) => {
    setPressed((previous) => {
      const count = Number(previous.split("#")[1]?.split(" ")[0] ?? 0) + 1
      return `#${count} ${uri} | ${label}${title === "" ? "" : ` | ${title}`}`
    })
  }, [])

  // Resolved in an effect rather than during render: `expo export` prerenders
  // this route in Node, where there is no query string, so reading the params
  // straight into the first render guarantees a hydration mismatch and throws
  // away the server HTML. Matching the server on the first client render keeps
  // the console clean, which is what makes a real page error visible.
  useEffect(() => {
    const resolved = text ?? (caseId ? CASE_BY_ID.get(caseId)?.markdown : undefined)
    setValue(resolved ?? null)
  }, [caseId, text])

  if (value === null) {
    return (
      <View testID="harness-root" style={styles.container}>
        <Text testID="harness-empty">no case</Text>
      </View>
    )
  }

  if (display) {
    return (
      <View testID="harness-root" style={styles.container}>
        <MarkdownText
          testID="harness-display"
          parser={parser}
          markdownStyle={MARKDOWN_STYLE}
          style={styles.input}
          // A fixed box rather than an image: an embed only has to be something
          // of a known size, and a fixture that fetches nothing cannot flake.
          renderEmbed={embeds ? renderEmbed : undefined}
          onLinkPress={links ? onLinkPress : undefined}
        >
          {value}
        </MarkdownText>
        <Text testID="harness-link" style={styles.hidden}>
          {pressed}
        </Text>
        <Text testID="harness-ready" style={styles.hidden}>
          ready
        </Text>
      </View>
    )
  }

  return (
    <View testID="harness-root" style={styles.container}>
      <MarkdownTextInput
        testID="harness-input"
        parser={parser}
        value={value}
        onChangeText={setValue}
        markdownStyle={MARKDOWN_STYLE}
        multiline
        autoFocus={false}
        // Nothing the platform does to text on its own belongs in a fixture:
        // Android capitalizes after a sentence break and both platforms will
        // happily correct markdown syntax into something else.
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={styles.input}
      />
      {/* The buffer as the component currently holds it, so a spec can assert
          what an edit actually produced rather than inferring it from the DOM. */}
      <Text testID="harness-value" style={styles.hidden}>
        {value}
      </Text>
      <Text testID="harness-ready" style={styles.hidden}>
        ready
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    backgroundColor: "white",
    flex: 1,
  },
  // Off-screen rather than zero-sized: a view with no height and no opacity is
  // not in the iOS accessibility hierarchy at all, so Detox cannot read it.
  hidden: {
    position: "absolute",
    top: -1000,
  },
  embed: {
    backgroundColor: "rebeccapurple",
    height: 20,
    width: 40,
  },
  input: {
    backgroundColor: "white",
    color: "black",
    fontSize: 16,
    padding: 8,
    width: 480,
  },
})
