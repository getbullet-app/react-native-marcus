import emojiRegex from "emoji-regex"
import { parse, postprocess, preprocess } from "micromark"
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal"
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough"
import type { Token, TokenType } from "micromark-util-types"

import type { MarkdownRange, MarkdownType } from "../commonTypes"
import { mentions } from "./micromark-extension-mentions"

const EMOJI_TYPE = "emoji"
const SYNTAX_TYPE = "syntax"

const MAX_DEPTH = 6

const TOKENS: {
  syntax: Set<TokenType>
  block: Partial<Record<TokenType, MarkdownType>>
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
  block: {
    blockQuote: "blockquote",

    // Ordered and unordered stay separate types so a renderer can tell them
    // apart. They nest independently: a line inside both carries one range of
    // each, and the indents add up.
    listOrdered: "list-ordered",
    listUnordered: "list-unordered",
  },
  special: {
    codeFenced: "codeblock",
    codeIndented: "codeblock",
    image: "inline-image",
  },
  scope: {
    emphasis: "italic",
    strong: "bold",
    strikethrough: "strikethrough",

    // Headings are absent: their level is only known once the marker token
    // arrives, so they are emitted from emitHeading() instead.
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

const BLOCK_PREFIX = "block-prefix"

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
  // Counted block containers, innermost last. Never exceeds MAX_DEPTH per type.
  const openBlocks: MarkdownType[] = []
  // One entry per open container, recording whether it made it into openBlocks.
  const countedBlocks: boolean[] = []
  // Heading awaiting the marker that states its level.
  let pendingHeading: Token | null = null
  // Where each open container's own marker ends on the line being built, if it
  // has one there. Cleared per line: a container whose marker was on an earlier
  // line is being continued, not opened.
  const markerEnds = new Map<MarkdownType, number>()
  const events = postprocess(
    parse({ extensions }).document().write(preprocess()(markdown, "utf-8", true)),
  )
  let lineStart = 0

  for (const event of events) {
    if (event[0] === "enter") {
      enter(event[1])
    } else {
      exit(event[1])
    }
  }

  excludeEmoji()

  return ranges

  function enter(token: Token) {
    if (EMOJI.scan.has(token.type)) {
      emitEmoji(token)
    }

    // The heading itself opens before its marker, so it is held until the
    // marker states the level. Both marker types also emit `syntax`, so this
    // falls through rather than returning.
    if (token.type === "atxHeading" || token.type === "setextHeading") {
      pendingHeading = token
    } else if (token.type === "atxHeadingSequence") {
      // ATX level is the run of `#`. A closing run is ignored: the heading has
      // already been emitted by then.
      emitHeading(token.end.offset - token.start.offset)
    } else if (token.type === "setextHeadingLineSequence") {
      emitHeading(markdown.charCodeAt(token.start.offset) === 61 ? 1 : 2)
    } else if (token.type === "listItemPrefix") {
      const list = openBlocks[openBlocks.length - 1]

      // Past the depth cap the item's own list was never opened, so its marker
      // would be recorded against whatever encloses it.
      if (list === "list-ordered" || list === "list-unordered") {
        markerEnds.set(list, token.end.offset)
      }
    } else if (token.type === "blockQuotePrefix") {
      // One per level, so the last one on the line covers all of `>>> `.
      markerEnds.set("blockquote", token.end.offset)
    }

    const block = TOKENS.block[token.type]

    if (block) {
      // Past the cap the container is ignored outright rather than counted and
      // clamped on the way out, so nesting cannot grow the stack or the work
      // flushLine does per line.
      const counted = depthOf(block) < MAX_DEPTH
      countedBlocks.push(counted)

      if (counted) {
        openBlocks.push(block)
      }

      return
    }

    if (token.type === "lineEnding" || token.type === "lineEndingBlank") {
      flushLine(token.start.offset)

      // The token can reach past the break itself: micromark folds the next
      // line's container prefix into it, so `\n>` arrives as one lineEnding.
      // Resuming at token.end would swallow that line, leaving a gap in the
      // quote. Resume just after the break instead.
      let next = token.start.offset
      if (markdown.charCodeAt(next) === 13) {
        next++
      }
      if (markdown.charCodeAt(next) === 10) {
        next++
      }
      lineStart = next > token.start.offset ? next : token.end.offset

      return
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

  function exit(token: Token) {
    if (!TOKENS.block[token.type]) {
      return
    }

    flushLine(token.end.offset)

    // Ignored containers were never pushed, so only counted ones pop. Skipped
    // ones are always innermost, so this stays balanced.
    if (countedBlocks.pop()) {
      openBlocks.pop()
    }
  }

  function emitHeading(level: number) {
    if (!pendingHeading) {
      return
    }

    push(
      pendingHeading.start.offset,
      pendingHeading.end.offset,
      "heading",
      level > MAX_DEPTH ? MAX_DEPTH : level,
    )
    pendingHeading = null
  }

  function depthOf(type: MarkdownType) {
    let depth = 0

    for (let i = 0; i < openBlocks.length; i++) {
      if (openBlocks[i] === type) {
        depth++
      }
    }

    return depth
  }

  /**
   * Emits the containers the finished line sits in, each preceded by the run of
   * text its own marker occupies there.
   *
   * The markers are real characters that the containers nested inside them are
   * laid out around, and how wide they render is a question only the platform
   * can answer -- so the offsets are handed over and the arithmetic is done
   * where the font is known.
   *
   * This prefix-then-container order is the contract the native formatters read
   * (`apple/MarkdownFormatter.swift`, `android/.../MarkdownFormatter.kt`): each
   * holds the `block-prefix` it just saw and hands it to the next container, so
   * laying out a line is one left-to-right walk. It is deliberately *not* tree
   * order -- a container arrives after the marker it encloses -- so the web
   * builder re-sorts into containment order via `sortRanges`. Reordering the
   * emission to suit web would break the pairing on both native platforms.
   */
  function flushLine(end: number) {
    if (openBlocks.length > 0 && end > lineStart) {
      let prefixStart = lineStart

      for (let i = 0; i < openBlocks.length; i++) {
        const type = openBlocks[i]!

        // Emit each distinct type once, at its first occurrence.
        if (openBlocks.indexOf(type) !== i) {
          continue
        }

        const markerEnd = markerEnds.get(type)

        if (markerEnd !== undefined && markerEnd > prefixStart) {
          push(prefixStart, markerEnd, BLOCK_PREFIX)
          prefixStart = markerEnd
        }

        push(lineStart, end, type, depthOf(type))
      }
    }

    if (end > lineStart) {
      lineStart = end
    }

    markerEnds.clear()
  }

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

  function push(start: number, end: number, type: MarkdownType, depth?: number) {
    if (start >= end) return

    const previous = ranges[ranges.length - 1]

    if (
      depth === undefined &&
      // Two containers opening on one line put their prefixes back to back.
      // Merging them would lose which prefix belongs to which container.
      type !== BLOCK_PREFIX &&
      // Adjacent syntax belongs to whatever encloses it, and neighbors often sit in different
      // enclosures: `` >` `` is a quote marker then a code fence, `` ~a~` `` closes a
      // strikethrough then opens one. A merged range would cover both and so straddle the end of
      // the first one's container -- overlapping it without containing it or being contained by
      // it, which is not a tree and renders the shared characters once per range. Runs that do
      // share an enclosure, like `>>`, cost only an extra span.
      type !== SYNTAX_TYPE &&
      previous &&
      previous.type === type &&
      previous.start + previous.length === start
    ) {
      previous.length = end - previous.start
      return
    }

    const range: MarkdownRange = {
      start,
      length: end - start,
      type,
    }

    if (depth !== undefined) {
      range.depth = depth
    }

    ranges.push(range)
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
