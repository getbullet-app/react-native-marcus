type MarkdownType =
  | "bold"
  | "italic"
  | "strikethrough"
  | "emoji"
  | "mention-here"
  | "mention-user"
  | "mention-short"
  | "mention-report"
  | "link"
  | "code"
  | "pre"
  | "blockquote"
  | "list-ordered"
  | "list-unordered"
  | "list-ordered-continuation"
  | "list-unordered-continuation"
  | "heading"
  | "syntax"
  | "inline-image"
  | "codeblock"

interface MarkdownRange {
  type: MarkdownType
  start: number
  length: number
  depth?: number
  syntaxType?: "opening" | "closing"
}

type InlineImagesInputProps = {
  addAuthTokenToImageURLCallback?: (url: string) => string
  imagePreviewAuthRequiredURLs?: string[]
}

export type { MarkdownType, MarkdownRange, InlineImagesInputProps }
