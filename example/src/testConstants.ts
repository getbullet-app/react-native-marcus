const LOCAL_URL = "http://localhost:8081/"

const EXAMPLE_CONTENT = [
  "# Marcus",
  "",
  "A paragraph with **bold**, *italic*, **bold around *nested italic* inside**,",
  "~~strikethrough~~ and `inline code`, a bare link https://example.com,",
  "a [labelled link](https://example.com), emoji 😀🍕🍔, and mentions for",
  "@here, @someone@swmansion.com and #mention-report.",
  "",
  "> Blockquotes keep their **formatting**, including *italic* and `code`.",
  "",
  "```",
  "const ranges = parseMarkdown(text);",
  "```",
].join("\n")

const INPUT_ID = "MarkdownInput_Example"
const INPUT_HISTORY_DEBOUNCE_TIME_MS = 150
const TOGGLE_LINK_COLOR = "toggle-link-color"
const CHANGE_SELECTION = "change-selection"
const SELECTION_END = 20

export {
  LOCAL_URL,
  EXAMPLE_CONTENT,
  INPUT_ID,
  INPUT_HISTORY_DEBOUNCE_TIME_MS,
  TOGGLE_LINK_COLOR,
  CHANGE_SELECTION,
  SELECTION_END,
}
