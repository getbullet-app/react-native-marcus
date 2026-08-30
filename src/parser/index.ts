import emojiRegex from "emoji-regex"
import { parse, postprocess, preprocess } from "micromark"
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal"
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough"
import type { Token, TokenType } from "micromark-util-types"

import type { MarkdownRange, MarkdownType } from "../commonTypes"
import { mentions } from "./micromark-extension-mentions"

const EMOJI_TYPE = "emoji"
const SYNTAX_TYPE = "syntax"

const TOKENS: {
  syntax: Set<TokenType>
  special: Partial<Record<TokenType, MarkdownType>>
  scope: Partial<Record<TokenType, MarkdownType>>
  content: Partial<Record<TokenType, MarkdownType>>
  link: Partial<Record<TokenType, MarkdownType>>
} = {
  syntax: new Set([
    // Emphasis.
    "emphasisSequence",
    "strongSequence",
    "strikethroughSequence",

    // Headings.
    "atxHeadingSequence",
    "setextHeadingLineSequence",

    // Block containers.
    "blockQuoteMarker",

    // Lists.
    "listItemMarker",
    "listItemValue",

    // Thematic breaks.
    "thematicBreakSequence",

    // Links/images.
    "labelMarker",
    "labelImageMarker",
    "referenceMarker",
    "resourceMarker",

    // Link/image destinations.
    "resourceDestinationLiteralMarker",

    // Titles.
    "resourceTitleMarker",

    // Definitions.
    "definitionLabelMarker",
    "definitionMarker",
    "definitionDestinationLiteralMarker",
    "definitionTitleMarker",

    // Autolinks.
    "autolinkMarker",

    // Escapes.
    "escapeMarker",

    // Hard breaks.
    "hardBreakEscape",
    "hardBreakTrailing",

    // Code.
    "codeTextSequence",
    "codeFencedFenceSequence",

    // Character references.
    "characterReferenceMarker",
    "characterReferenceMarkerNumeric",
    "characterReferenceMarkerHexadecimal",
  ]),
  special: {
    codeFenced: "codeblock",
    codeIndented: "codeblock",
    image: "inline-image",
  },
  scope: {
    emphasis: "italic",
    strong: "bold",
    strikethrough: "strikethrough",

    blockQuote: "blockquote",

    atxHeading: "h1",
    setextHeading: "h1",

    // TODO:
    // listOrdered: 'list',
    // listUnordered: 'list',
  },
  content: {
    mention: "mention-user",

    codeTextData: "code",
    codeFlowValue: "pre",

    // TODO:
    // htmlFlow: 'html',
    // htmlText: 'html',
  },
  link: {
    autolinkProtocol: "link",
    autolinkEmail: "link",

    literalAutolinkEmail: "link",
    literalAutolinkHttp: "link",
    literalAutolinkWww: "link",

    resourceDestinationString: "link",
    definitionDestinationString: "link",
  },
}

const EMOJI: {
  scan: Set<TokenType>
  exclude: Set<MarkdownType>
  pattern: RegExp
} = {
  scan: new Set([
    // Normal text.
    "data",

    // Inline code content.
    "codeTextData",

    // Fenced/indented code content.
    "codeFlowValue",

    // HTML source.
    "htmlFlowData",
    "htmlTextData",

    // Link destinations.
    "resourceDestinationString",
    "definitionDestinationString",

    // Link/image titles, if present.
    "resourceTitleString",
    "definitionTitleString",

    // Autolinks.
    "autolinkProtocol",
    "autolinkEmail",
  ]),
  exclude: new Set(["bold", "italic", "strikethrough"]),
  pattern: emojiRegex(),
}

// Bundler shenanigans: when bundling esm export ends up in wrapper function body
// which is a syntax error so don't export anything at all.
// Instead declare export so typing still works.
declare module "./index" {
  export function parse(markdown: string): MarkdownRange[]
}

declare global {
  function __parse__micromark(markdown: string): MarkdownRange[]
}

globalThis.__parse__micromark = function (markdown: string): MarkdownRange[] {
  const extensions = [gfmAutolinkLiteral(), gfmStrikethrough(), mentions()]
  const ranges: MarkdownRange[] = []
  const events = postprocess(
    parse({ extensions }).document().write(preprocess()(markdown, "utf-8", true)),
  )

  for (const event of events) {
    if (event[0] === "enter") {
      enter(event[1])
    }
    // else {
    //   exit(event[1]);
    // }
  }

  excludeEmoji()

  return ranges

  function enter(token: Token) {
    if (EMOJI.scan.has(token.type)) {
      emitEmoji(token)
    }

    if (TOKENS.special[token.type]) {
      emit(token, TOKENS.special[token.type]!)
      return
    }

    if (TOKENS.syntax.has(token.type)) {
      emit(token, SYNTAX_TYPE)
      return
    }

    if (TOKENS.scope[token.type]) {
      emit(token, TOKENS.scope[token.type]!)
      return
    }

    if (TOKENS.content[token.type]) {
      if (token.type === "codeFlowValue") {
        emitCodeBlock(token, TOKENS.content[token.type]!)
      } else {
        emit(token, TOKENS.content[token.type]!)
      }

      return
    }

    if (TOKENS.link[token.type]) {
      emit(token, TOKENS.link[token.type]!)
      return
    }
  }

  // function exit(token: Token) {}

  function emit(token: Token, type: MarkdownType) {
    push(token.start.offset, token.end.offset, type)
  }

  function emitCodeBlock(token: Token, type: MarkdownType) {
    let end = token.end.offset

    if (markdown.charCodeAt(end) === 13) {
      // CRLF
      end += markdown.charCodeAt(end + 1) === 10 ? 2 : 1
    } else if (markdown.charCodeAt(end) === 10) {
      // LF
      end++
    }

    push(token.start.offset, end, type)
  }

  function emitEmoji(token: Token) {
    const start = token.start.offset
    const end = token.end.offset

    if (start >= end) return

    const value = markdown.slice(start, end)

    EMOJI.pattern.lastIndex = 0

    let match: RegExpExecArray | null = null

    while ((match = EMOJI.pattern.exec(value)) !== null) {
      const emojiStart = start + match.index
      const emojiEnd = emojiStart + match[0].length

      push(emojiStart, emojiEnd, EMOJI_TYPE)

      if (match[0].length === 0) {
        EMOJI.pattern.lastIndex++
      }
    }
  }

  function push(start: number, end: number, type: MarkdownType) {
    if (start >= end) return

    const previous = ranges[ranges.length - 1]

    if (previous && previous.type === type && previous.start + previous.length === start) {
      previous.length = end - previous.start
      return
    }

    ranges.push({
      start,
      length: end - start,
      type,
    })
  }

  function excludeEmoji() {
    if (!ranges.find((r) => r.type === "emoji")) return

    const result: MarkdownRange[] = []

    for (const range of ranges) {
      if (!EMOJI.exclude.has(range.type)) {
        result.push(range)
        continue
      }

      const end = range.start + range.length
      let cursor = range.start

      for (const emoji of ranges) {
        if (emoji.type !== "emoji") continue

        const emojiStart = emoji.start
        const emojiEnd = emojiStart + emoji.length

        if (emojiEnd <= cursor) continue
        if (emojiStart >= end) break

        if (emojiStart > cursor) {
          result.push({
            start: cursor,
            length: emojiStart - cursor,
            type: range.type,
          })
        }

        cursor = Math.max(cursor, emojiEnd)

        if (cursor >= end) break
      }

      if (cursor < end) {
        result.push({
          start: cursor,
          length: end - cursor,
          type: range.type,
        })
      }
    }

    ranges.length = 0
    ranges.push(...result)
  }
}
