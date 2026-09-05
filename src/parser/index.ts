import emojiRegex from "emoji-regex"
import { parse, postprocess, preprocess } from "micromark"
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal"
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough"
import type { Token, TokenType } from "micromark-util-types"

import type { MarkdownRange, MarkdownType } from "../commonTypes"
import { mentions } from "./micromark-extension-mentions"

const EMOJI_TYPE = "emoji"
const SYNTAX_TYPE = "syntax"
const LABEL_TYPE = "label"
const ALT_TEXT_TYPE = "alt-text"

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

    // Whatever follows a fenced block's language. The language itself is
    // `codeblock-language` -- something will want to read it -- but the rest of
    // that line is markup like any other fence.
    "codeFencedFenceMeta",

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
    mention: "mention",

    codeTextData: "code",
    codeFlowValue: "pre",

    // The language a fenced block declares. Its own type rather than `syntax`
    // because it is metadata something will want to read -- highlighting, at
    // least -- and no formatter styles it, so it stays plain text in an input
    // the way the rest of the fence line does not.
    codeFencedFenceInfo: "codeblock-language",

    // The title after a destination -- `[a](b "title")`, on a link as much as on
    // an image. Metadata for the same reasons the language above is: a display
    // renderer removes it with the rest of the resource, and something that
    // renders an image wants to read it. Left unstyled in an input, where it is
    // text between two quotes.
    resourceTitleString: "title",

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
  // micromark's preprocessor drops a leading BOM, so every offset it reports is
  // one short of the caller's string -- a document that opens with one had every
  // range shifted left by a character, leaving the last one uncovered. Parse the
  // stripped text and shift the ranges back at the end rather than second-
  // guessing offsets at each of the two dozen places they are read.
  const bomLength = markdown.charCodeAt(0) === 0xfeff ? 1 : 0

  if (bomLength > 0) {
    markdown = markdown.slice(bomLength)
  }

  const extensions = [gfmAutolinkLiteral(), gfmStrikethrough(), mentions()]
  const ranges: MarkdownRange[] = []
  // Counted block containers, innermost last. Never exceeds MAX_DEPTH per type.
  const openBlocks: MarkdownType[] = []
  // One entry per open container, recording whether it made it into openBlocks.
  const countedBlocks: boolean[] = []
  // Heading awaiting the marker that states its level.
  let pendingHeading: Token | null = null
  // Open images. A link's label is a link; an image's label is alt text, and
  // the two are the same token type distinguished only by what encloses them.
  let openImages = 0
  // Open labels inside an image's, so that the outermost one is the alt text
  // and everything under it is suppressed.
  let altDepth = 0
  // Open link labels. A label carries everything else it is written with --
  // emphasis, code, mentions, an image -- but not a link: a link inside a link
  // is text, and the one wrapped around it is the one that is pressed.
  let labelDepth = 0
  // The container markers on the line being built, in the order they appear.
  // Positional rather than keyed by type: one type can open more than once on a
  // line, and the occurrences need not be adjacent (`> - > `). Cleared per
  // line -- a container whose marker was on an earlier line is being continued,
  // not opened.
  const markers: { type: MarkdownType; start: number; end: number }[] = []
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

  if (bomLength > 0) {
    for (const range of ranges) {
      range.start += bomLength
    }
  }

  return ranges

  function enter(token: Token) {
    // Ahead of the alt-text gate below, and deliberately: an emoji is not
    // markup but a property of a character that survives, and alt text shown as
    // prose has to draw it in the emoji font like any other.
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
        markers.push({ type: list, start: token.start.offset, end: token.end.offset })
      }
    } else if (token.type === "blockQuotePrefix") {
      // One per level, so `>>> ` arrives as three markers; flushLine folds a
      // contiguous run back into a single prefix.
      markers.push({
        type: "blockquote",
        start: token.start.offset,
        end: token.end.offset,
      })
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
      if (token.type === "image") {
        openImages++

        // An image written inside another one's label is not an image. It is
        // some of the characters that label is spelled with.
        if (altDepth > 0) {
          return
        }
      }

      emit(token, TOKENS.special[token.type]!)
      return
    }

    if (TOKENS.syntax.has(token.type)) {
      emit(token, SYNTAX_TYPE)
      return
    }

    // The visible half of a link, emitted so that a renderer which removes the
    // markup around it has something left to style. Deliberately not `link`:
    // while it is being edited the label is text you are typing, and only a
    // renderer that has taken the brackets away has any business making it look
    // like one.
    if (token.type === "labelText") {
      // A label nested inside an image's is part of that alt text, not a second
      // one: `![a [b](c) d](e)` has exactly one.
      if (altDepth > 0) {
        altDepth++
        return
      }

      // An image's label is alt text, not a link label. The two are the same
      // token, distinguished only by what encloses them -- and they part ways
      // downstream: a label is the link once the brackets are gone, while alt
      // text is what stands in for an image nobody rendered.
      if (openImages > 0) {
        emit(token, ALT_TEXT_TYPE)
        altDepth = 1
        return
      }

      emit(token, LABEL_TYPE)
      labelDepth++
      return
    }

    // Alt text is a string. CommonMark says as much -- it flattens a label to
    // plain text to render the `alt` attribute -- but micromark reports the
    // structure it found, so `![**a** [b](c)](d)` arrives carrying emphasis, a
    // whole link and that link's own destination. None of it means anything:
    // nothing can draw a link inside an image. Only the syntax handled above
    // survives, so that whatever removes markup can still remove these
    // characters, and everything downstream sees one `alt-text` range over one
    // flat string. Emoji are the exception, emitted above: they are not markup
    // and the characters they cover are still there to be drawn.
    if (altDepth > 0) {
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
      // A link written inside a label is not one: `[<https://x.com>](y)` reads
      // as its own URL and points somewhere else. Its markers are still markup
      // and still go, but what they leave behind is prose, so no range is
      // emitted over it -- a second `link` here would draw it as a link of its
      // own in an input and, once the display has taken the brackets away,
      // would cover the same characters twice.
      //
      // An image's destination is not that: it is inside the label but it is
      // the image's, and something has to render the image.
      if (labelDepth > 0 && openImages === 0) {
        return
      }

      emit(token, TOKENS.link[token.type]!)
      return
    }
  }

  function exit(token: Token) {
    if (token.type === "labelText") {
      if (altDepth > 0) {
        altDepth--
      } else if (labelDepth > 0) {
        labelDepth--
      }

      return
    }

    if (token.type === "image") {
      openImages--
      return
    }

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

        // This type's next marker at or after the walk position. Taking the
        // last one on the line instead -- which is what keying by type alone
        // did -- stretches the prefix across any marker that sits between two
        // occurrences, so `> - > ` gave the quote a `"> - > "` prefix and left
        // the list with none at all.
        const index = markers.findIndex((m) => m.type === type && m.start >= prefixStart)

        if (index !== -1) {
          // A contiguous run of one type is a single prefix: `>>> ` is three
          // markers but one step over on the way to the content.
          let markerEnd = markers[index]!.end

          for (let j = index + 1; j < markers.length; j++) {
            const marker = markers[j]!

            if (marker.type !== type || marker.start !== markerEnd) {
              break
            }

            markerEnd = marker.end
          }

          push(prefixStart, markerEnd, BLOCK_PREFIX)
          prefixStart = markerEnd
        }

        push(lineStart, end, type, depthOf(type))
      }
    }

    if (end > lineStart) {
      lineStart = end
    }

    markers.length = 0
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

