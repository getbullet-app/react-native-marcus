type MarkdownType =
  | "bold"
  | "italic"
  | "strikethrough"
  | "emoji"
  // One type. A mention is a name with an `@` in front of it; who it names is
  // the application's business, not the parser's, and nothing here can tell a
  // person from a room from a report.
  | "mention"
  | "link"
  // The text between a link's brackets. Its own type rather than `link`: no
  // formatter styles it, so it stays plain while it is being edited, and only
  // the display renderer -- which has removed the brackets -- turns it into one.
  | "label"
  // The text between an image's brackets. Content rather than text: CommonMark
  // flattens it to a string only when it renders the `alt` attribute, and
  // micromark keeps the structure, so emphasis, code, a link or another image
  // nested in there all arrive as ranges of their own inside this one.
  | "alt-text"
  // The title a link or image carries after its destination. Metadata rather
  // than content: no formatter styles it, and a display renderer removes it
  // along with the destination it belongs to.
  | "title"
  | "code"
  | "pre"
  | "blockquote"
  | "list-ordered"
  | "list-unordered"
  | "block-prefix"
  | "heading"
  | "syntax"
  | "inline-image"
  | "codeblock"
  // The language a fenced block declares. Metadata rather than content: no
  // formatter styles it and the display renderer removes it outright.
  | "codeblock-language"

interface MarkdownRange {
  type: MarkdownType
  start: number
  length: number
  depth?: number
  syntaxType?: "opening" | "closing"
}

export type { MarkdownType, MarkdownRange }
