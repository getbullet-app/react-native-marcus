import type { MarkdownRange } from "./commonTypes"

// Removing the markdown syntax from the string before it reaches the platform
// is what separates the display component from the input one: the input shows
// what you typed, the display shows what it meant. Everything downstream --
// measurement, drawing, selection, VoiceOver -- then sees only the text that is
// meant to be read, without any of the hiding tricks that a formatter would
// otherwise have to play on characters that are still there.
//
// The parser's offsets are into the original string, so cutting characters out
// invalidates every range it emitted. Both halves happen here, in one pass, so
// there is never a moment where a range and the string it indexes disagree.

/** What an image stood for, for a caller that has something to show instead. */
interface MarkdownEmbed {
  /** Where the placeholder character stands in the stripped text. */
  index: number
  uri: string
  alt: string
  /** Empty when the image was written without one, never absent. */
  title: string
  /**
   * Whether the image shares its line with anything else.
   *
   * An image is written inline and is laid out inline either way, but what it
   * is for depends on what is around it: alone on a line it is a figure, and
   * in the middle of a sentence it is a badge or an emoji. Only the caller can
   * pick a size, and this is what that decision is usually made on.
   *
   * A block marker does not count as company -- an image alone in a list item
   * or a quote is still alone -- and another image does.
   */
  inline: boolean
}

/** A link the display can hand to whatever is going to act on a press. */
interface MarkdownLink {
  /** Where the link's text stands in the stripped text. */
  start: number
  length: number
  uri: string
  /** The text between the brackets, which is all that is left of the link. */
  label: string
  /** Empty when the link was written without one, never absent. */
  title: string
}

interface StrippedMarkdown {
  text: string
  ranges: MarkdownRange[]
  embeds: MarkdownEmbed[]
  links: MarkdownLink[]
}

interface StripOptions {
  /**
   * Replace each image with a single placeholder character and report what it
   * stood for, instead of leaving its alt text behind as prose.
   *
   * One character because that is exactly what a view mounted inside text costs
   * the platform: both iOS and Android splice a single U+FFFC into the string
   * the formatters index, in place of the attachment. So the ranges this
   * returns are already right for a `Text` whose children have the embed
   * spliced in where the placeholder is.
   */
  embeds?: boolean
  /**
   * Report where each link ended up and where it points.
   *
   * The destination is removed along with the rest of the markup, so a display
   * that means to do something when a link is pressed has to be told here or
   * not at all.
   */
  links?: boolean
}

/**
 * The character standing in for an embed, matching what the platforms use for
 * an attachment so that the stripped text and the string that reaches the
 * formatters are the same length.
 */
const OBJECT_REPLACEMENT = "\uFFFC"

/** Shared so that the common case of a document with no embeds allocates nothing. */
const NO_EMBEDS: MarkdownEmbed[] = []

/** Shared for the same reason. */
const NO_LINKS: MarkdownLink[] = []

const TAB = 9
const LINE_FEED = 10
const CARRIAGE_RETURN = 13
const SPACE = 32
const GREATER_THAN = 62
const LEFT_PAREN = 40
const RIGHT_PAREN = 41

function isBlank(code: number) {
  return code === SPACE || code === TAB
}

function isLineBreak(code: number) {
  return code === LINE_FEED || code === CARRIAGE_RETURN
}

/**
 * Spans of the block markers that survive stripping, in original offsets.
 *
 * A list's marker is the only syntax that carries meaning of its own -- `1.`
 * numbers the item and `-` stands in for a bullet -- so it stays in the string
 * and is laid out the way the input lays it out. A blockquote's `>` says
 * nothing the ribbon beside it does not already say, so it goes.
 *
 * `flushLine` emits a `block-prefix` immediately before the container that owns
 * it, which is the same pairing the native formatters read, so the container is
 * simply the range that follows.
 */
function listMarkers(ranges: MarkdownRange[]) {
  const markers: { start: number; end: number }[] = []

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!

    if (range.type !== "block-prefix") {
      continue
    }

    const container = ranges[i + 1]

    if (container && (container.type === "list-ordered" || container.type === "list-unordered")) {
      markers.push({ start: range.start, end: range.start + range.length })
    }
  }

  return markers
}

/**
 * Whether a syntax range is a quote marker sitting inside a list's prefix.
 *
 * A prefix is measured from wherever the previous container's marker ended, so
 * the ordered list in `- > 1. ` is handed the whole run `> 1. ` -- quote marker
 * included. Containment alone would therefore keep a `>` that belongs to
 * something else, and `>` is the only block marker that can appear there.
 */
function isQuoteMarker(text: string, start: number, end: number) {
  for (let i = start; i < end; i++) {
    if (text.charCodeAt(i) !== GREATER_THAN) {
      return false
    }
  }

  return true
}

/** The `( ... )` an inline link or image carries, and what it carries in it. */
interface Resource {
  open: number
  close: number
  /**
   * What was written between the markers. Both are strings whether or not the
   * markdown carried them, so that everything downstream -- a press handler
   * most of all -- is handed the same shape every time.
   */
  uri: string
  title: string
}

/**
 * The resources in `text`, in the order they are written.
 *
 * The parser reports the brackets and parentheses as syntax but the destination
 * itself as a `link`, which is right for an input -- the URL is text you can
 * edit -- and wrong for a display, where cutting only the punctuation out of
 * `[text](url)` leaves `texturl`. So the whole run between the markers goes,
 * and reading it on the way past is what leaves something to hand a press
 * handler afterwards.
 *
 * `(` is emitted as syntax only by `resourceMarker`, so there is nothing else
 * this can match, and one resource cannot hold another: the inner parentheses
 * of `[a](b(c))` are part of the destination rather than markers of their own.
 * Reference links and their definitions are not covered: their label is
 * punctuation around prose the way emphasis is, and telling `[text]` a
 * reference from `[text]` a label needs more than the ranges carry.
 */
function resourceSpans(text: string, ranges: MarkdownRange[]) {
  const spans: Resource[] = []
  let current: Resource | null = null

  for (const range of ranges) {
    if (range.type === "syntax" && range.length === 1) {
      const code = text.charCodeAt(range.start)

      if (code === LEFT_PAREN) {
        current = { open: range.start, close: -1, uri: "", title: "" }
      } else if (code === RIGHT_PAREN && current !== null) {
        current.close = range.start
        spans.push(current)
        current = null
      }

      continue
    }

    // A destination and a title are emitted between the two markers, so
    // whichever resource is open is the one they belong to. Anything else that
    // arrives in between -- a container flushed at a line break inside a title
    // -- is neither and is passed over.
    if (current === null) {
      continue
    }

    if (range.type === "link") {
      current.uri = text.slice(range.start, range.start + range.length)
    } else if (range.type === "title") {
      current.title = text.slice(range.start, range.start + range.length)
    }
  }

  return spans
}

/** Marks every resource for removal, markers and all. */
function cutResources(resources: Resource[], cut: Uint8Array) {
  let cutSomething = false

  for (const resource of resources) {
    for (let i = resource.open; i <= resource.close; i++) {
      cut[i] = 1
      cutSomething = true
    }
  }

  return cutSomething
}

/**
 * Whether anything but block markers shares a line with the character at
 * `index`.
 *
 * Read off the stripped text, which is the text that will be laid out: by this
 * point a quote's marker is gone entirely and a list's is a `block-prefix`
 * range over characters that were kept to be laid out rather than read.
 */
function sharesItsLine(text: string, prefixes: MarkdownRange[], index: number) {
  let start = index

  while (start > 0 && !isLineBreak(text.charCodeAt(start - 1))) {
    start--
  }

  let end = index

  while (end < text.length && !isLineBreak(text.charCodeAt(end))) {
    end++
  }

  for (let i = start; i < end; i++) {
    if (i === index || isBlank(text.charCodeAt(i))) {
      continue
    }

    if (prefixes.some((prefix) => i >= prefix.start && i < prefix.start + prefix.length)) {
      continue
    }

    return true
  }

  return false
}

/** The characters of a span that survive the cut, which is CommonMark's `alt`. */
function flatten(text: string, cut: Uint8Array, start: number, end: number) {
  let flattened = ""
  let segmentStart = start

  for (let i = start; i < end; i++) {
    if (cut[i] === 1) {
      if (segmentStart < i) {
        flattened += text.slice(segmentStart, i)
      }
      segmentStart = i + 1
    }
  }

  return segmentStart < end ? flattened + text.slice(segmentStart, end) : flattened
}

interface ImageSpan {
  start: number
  end: number
  uri: string
  alt: string
  title: string
}

/** Shared for the same reason `NO_EMBEDS` is. */
const NO_IMAGES: ImageSpan[] = []

/**
 * The images in `text`, with the three things a renderer needs to show one.
 *
 * Read straight off the ranges, because the parser has already made an image
 * flat: inside a label it emits nothing but the `syntax` the markup is spelled
 * with and one `alt-text` range over the lot. So there is exactly one `link`
 * range in a span -- the destination -- and no image nested in another, and
 * neither case needs guarding here.
 *
 * `alt` still has to be flattened, since a single range cannot skip the `**` in
 * `![**a**](b)`. `cut` is what does it: it already marks every character the
 * strip is removing, so reading the label through it gives exactly the string
 * CommonMark would have put in the attribute.
 */
function imageSpans(text: string, ranges: MarkdownRange[], cut: Uint8Array) {
  const spans: ImageSpan[] = []

  for (let i = 0; i < ranges.length; i++) {
    const image = ranges[i]!

    if (image.type !== "inline-image") {
      continue
    }

    const start = image.start
    const end = Math.min(start + image.length, text.length)
    const span: ImageSpan = { start, end, uri: "", alt: "", title: "" }

    for (let j = i + 1; j < ranges.length; j++) {
      const inner = ranges[j]!
      const innerEnd = inner.start + inner.length

      // Ranges are not sorted -- a container is emitted after the content of
      // the line it encloses -- so anything reaching past the image is one of
      // those and is skipped rather than ending the walk.
      if (inner.start >= end) {
        break
      }
      if (innerEnd > end) {
        continue
      }

      if (inner.type === "alt-text") {
        span.alt = flatten(text, cut, inner.start, innerEnd)
      } else if (inner.type === "link") {
        span.uri = text.slice(inner.start, innerEnd)
      } else if (inner.type === "title") {
        span.title = text.slice(inner.start, innerEnd)
      }
    }

    spans.push(span)
  }

  return spans
}

interface LinkSpan {
  start: number
  end: number
  uri: string
  title: string
}

/** Shared for the same reason `NO_EMBEDS` is. */
const NO_LINK_SPANS: LinkSpan[] = []

/**
 * The links in `text`, as the text that will be left of each and where it
 * points.
 *
 * A written link is a label followed immediately by a resource, so the label is
 * the one that opens at `](`. A label with no resource after it is a reference
 * or a shortcut, and nothing here can resolve one: it is still styled as a link
 * -- that much the ranges say -- but there is no destination to press it to.
 *
 * An autolink has no label at all and is its own text, so any `link` left over
 * is one. Left over means outside every resource: the destinations are `link`
 * ranges too, and each has already been taken by the label in front of it or
 * belongs to an image, which has no label to press. The exception is a
 * definition's destination -- `[ref]: https://example.com` -- which is written
 * plainly, is shown as written, and is treated as what it looks like.
 */
function linkSpans(text: string, ranges: MarkdownRange[], resources: Resource[]) {
  const spans: LinkSpan[] = []

  for (const range of ranges) {
    const end = range.start + range.length
    let span: LinkSpan | null = null

    if (range.type === "label") {
      const resource = resources.find((candidate) => candidate.open === end + 1)

      if (resource !== undefined) {
        span = { start: range.start, end, uri: resource.uri, title: resource.title }
      }
    } else if (
      range.type === "link" &&
      !resources.some((resource) => range.start > resource.open && range.start < resource.close)
    ) {
      span = { start: range.start, end, uri: text.slice(range.start, end), title: "" }
    }

    if (span === null) {
      continue
    }

    // A link cannot hold another one, but micromark still reports the construct
    // it finds inside a label: `[see <https://x.com>](y)` arrives as a label
    // with an autolink in it. A label is emitted before its own content, so the
    // one that encloses the other is the one already here -- and it is the one
    // to keep, being the whole of what the reader is shown. Two of them would
    // be worse than a wrong choice: the caller splices the text at these, and
    // spans that overlap would splice the run they share in twice.
    if (spans.length > 0 && span.start < spans[spans.length - 1]!.end) {
      continue
    }

    spans.push(span)
  }

  return spans
}

/**
 * The spans as offsets into the stripped text, carrying the label they now
 * cover. `offsets` is null when nothing was cut and the two texts are the same.
 */
function toLinks(text: string, spans: LinkSpan[], offsets: Int32Array | null): MarkdownLink[] {
  if (spans.length === 0) {
    return NO_LINKS
  }

  const links: MarkdownLink[] = []

  for (const span of spans) {
    const start = offsets === null ? span.start : offsets[span.start]!
    const end = offsets === null ? span.end : offsets[span.end]!

    // A label that was nothing but markup -- `[**](x)` -- has nothing left to
    // press.
    if (end <= start) {
      continue
    }

    links.push({
      start,
      length: end - start,
      uri: span.uri,
      label: text.slice(start, end),
      title: span.title,
    })
  }

  return links
}

/**
 * Widens the cuts already marked on a line to cover the whitespace that only
 * existed to separate a marker from what it marked.
 *
 * A line opens with a run of block markers and the blanks between them. Walking
 * that run, a blank goes only if the marker in front of it went: `# Title` and
 * `> - item` lose their spacing, `- item` keeps the one its bullet needs.
 *
 * A line that turns out to be nothing but removed markers takes its own line
 * break with it, so a setext underline or a thematic break does not leave a
 * blank line behind.
 */
function absorbMarkerSpacing(text: string, cut: Uint8Array, marker: Uint8Array) {
  let lineStart = 0

  while (lineStart <= text.length) {
    let lineEnd = lineStart

    while (lineEnd < text.length) {
      const code = text.charCodeAt(lineEnd)

      if (code === LINE_FEED || code === CARRIAGE_RETURN) {
        break
      }

      lineEnd++
    }

    let cursor = lineStart
    let cutSomething = false
    let keptMarker = false
    let afterCut = false

    while (cursor < lineEnd) {
      const blank = isBlank(text.charCodeAt(cursor))

      if (cut[cursor] === 1) {
        cutSomething = true
        afterCut = true
      } else if (blank) {
        if (afterCut) {
          cut[cursor] = 1
        }
      } else if (marker[cursor] === 1) {
        keptMarker = true
        afterCut = false
      } else {
        break
      }

      cursor++
    }

    // Nothing readable left on the line, and no marker worth keeping either.
    if (cursor >= lineEnd && cutSomething && !keptMarker) {
      for (let i = lineStart; i < lineEnd; i++) {
        cut[i] = 1
      }

      // The break in front, for any line but the first, which has none and
      // takes the one behind instead.
      if (lineStart > 0) {
        let index = lineStart - 1

        if (text.charCodeAt(index) === LINE_FEED) {
          cut[index] = 1
          index--
        }
        if (index >= 0 && text.charCodeAt(index) === CARRIAGE_RETURN) {
          cut[index] = 1
        }
      } else {
        let index = lineEnd

        if (text.charCodeAt(index) === CARRIAGE_RETURN) {
          cut[index] = 1
          index++
        }
        if (text.charCodeAt(index) === LINE_FEED) {
          cut[index] = 1
        }
      }
    }

    if (lineEnd >= text.length) {
      break
    }

    lineStart = lineEnd

    if (text.charCodeAt(lineStart) === CARRIAGE_RETURN) {
      lineStart++
    }
    if (text.charCodeAt(lineStart) === LINE_FEED) {
      lineStart++
    }
  }
}

/**
 * What a type means once the markup around it is gone.
 *
 * A link's label is the one type that changes. While it is being edited it is
 * text between two brackets and is left alone; once the brackets have been
 * removed it is the only thing left standing for the link, so it takes the
 * link's styling -- the destination it was pointing at having been removed too.
 */
function displayType(type: MarkdownRange["type"]): MarkdownRange["type"] {
  return type === "label" ? "link" : type
}

/**
 * Removes the markdown syntax from `text` and rewrites `ranges` to index what
 * is left.
 *
 * Ranges are only ever dropped or shortened, never reordered, so the emission
 * order the native formatters depend on survives -- a `block-prefix` still
 * arrives immediately before its container, and a container that lost its
 * marker entirely arrives with none, which is exactly the gutter-without-marker
 * case the block layout already handles.
 */
function stripSyntax(
  text: string,
  ranges: MarkdownRange[],
  options: StripOptions = {},
): StrippedMarkdown {
  if (text.length === 0 || ranges.length === 0) {
    return { text, ranges, embeds: NO_EMBEDS, links: NO_LINKS }
  }

  const markers = listMarkers(ranges)
  const cut = new Uint8Array(text.length)
  const kept = new Uint8Array(text.length)
  let cutSomething = false

  for (const range of ranges) {
    // A fenced block's language is metadata about the block, not part of it, so
    // it goes the same way the fence itself does.
    if (range.type !== "syntax" && range.type !== "codeblock-language") {
      continue
    }

    const start = range.start
    const end = Math.min(start + range.length, text.length)
    const inListMarker =
      range.type === "syntax" &&
      markers.some((marker) => start >= marker.start && end <= marker.end) &&
      !isQuoteMarker(text, start, end)

    for (let i = start; i < end; i++) {
      if (inListMarker) {
        kept[i] = 1
      } else {
        cut[i] = 1
        cutSomething = true
      }
    }
  }

  const resources = resourceSpans(text, ranges)
  const links = options.links ? linkSpans(text, ranges, resources) : NO_LINK_SPANS

  cutSomething = cutResources(resources, cut) || cutSomething

  // An image goes whole -- markup, alt text and destination alike -- and leaves
  // one character behind. Keeping one of its own characters rather than
  // splicing a new one in is what lets the offsets below stay as they are: a
  // range is still only ever shortened, never moved.
  // After the cuts above and before the images are cut themselves, which is the
  // one moment `cut` describes the markup inside a label without describing the
  // label's own removal -- exactly what flattening the alt text needs.
  const images = options.embeds ? imageSpans(text, ranges, cut) : NO_IMAGES
  const placeholder = images.length > 0 ? new Uint8Array(text.length) : null

  for (const image of images) {
    for (let i = image.start; i < image.end; i++) {
      cut[i] = 1
      // 1 for a character the image swallowed, 2 for the one it left behind.
      placeholder![i] = 1
    }

    cut[image.start] = 0
    placeholder![image.start] = 2
    cutSomething = true
  }

  if (!cutSomething) {
    // Nothing moved, so the spans already index the text as it stands. A bare
    // URL gets here: it is a link written with no syntax at all.
    return { text, ranges, embeds: NO_EMBEDS, links: toLinks(text, links, null) }
  }

  absorbMarkerSpacing(text, cut, kept)

  // Kept characters before each offset, which is where that offset lands once
  // the cuts are gone. One extra entry so a range's end can be mapped the same
  // way as its start.
  const offsets = new Int32Array(text.length + 1)
  let stripped = ""
  let segmentStart = 0
  let survivors = 0

  for (let i = 0; i < text.length; i++) {
    offsets[i] = survivors

    if (placeholder !== null && placeholder[i] === 2) {
      if (segmentStart < i) {
        stripped += text.slice(segmentStart, i)
      }
      stripped += OBJECT_REPLACEMENT
      segmentStart = i + 1
      survivors++
    } else if (cut[i] === 1) {
      if (segmentStart < i) {
        stripped += text.slice(segmentStart, i)
      }
      segmentStart = i + 1
    } else {
      survivors++
    }
  }

  offsets[text.length] = survivors

  if (segmentStart < text.length) {
    stripped += text.slice(segmentStart)
  }

  const remapped: MarkdownRange[] = []
  // The image being walked past, if any: everything it swallowed goes with it,
  // save its own range, which shrinks onto the character left behind. Without
  // this the `syntax` over the `!` -- the very character kept as the
  // placeholder -- would survive to style an embed as markup.
  //
  // Swallowed means emitted after the image opened and ending inside it, which
  // is what tells the alt text apart from the two kinds of range that reach
  // over an image and have to survive: the label of a link written around one,
  // which is emitted before it, and the container of the line it sits on, which
  // is emitted after and runs past its end.
  let image = 0
  let insideStart = -1
  let insideEnd = -1

  for (const range of ranges) {
    // One span per `inline-image`, in the order they were emitted, so the two
    // walks stay in step.
    if (range.type === "inline-image" && image < images.length) {
      insideStart = images[image]!.start
      insideEnd = images[image]!.end
      image++
    } else if (range.start >= insideStart && range.start + range.length <= insideEnd) {
      continue
    }

    let start = offsets[Math.min(range.start, text.length)]!
    const end = offsets[Math.min(range.start + range.length, text.length)]!

    // A fenced block opens with a line of its own, and cutting that line leaves
    // the break that ended it at the front of the block. What is left then
    // starts on the line above the code, which is a blank first line in
    // whatever draws the block as a box.
    if (range.type === "codeblock") {
      while (start < end && isLineBreak(stripped.charCodeAt(start))) {
        start++
      }
    }

    if (end <= start) {
      continue
    }

    const next: MarkdownRange = { type: displayType(range.type), start, length: end - start }

    if (range.depth !== undefined) {
      next.depth = range.depth
    }
    if (range.syntaxType !== undefined) {
      next.syntaxType = range.syntaxType
    }

    remapped.push(next)
  }

  const prefixes = images.length > 0 ? remapped.filter((range) => range.type === "block-prefix") : []
  const embeds =
    images.length > 0
      ? images.map((image) => {
          const index = offsets[image.start]!

          return {
            index,
            uri: image.uri,
            alt: image.alt,
            title: image.title,
            inline: sharesItsLine(stripped, prefixes, index),
          }
        })
      : NO_EMBEDS

  return { text: stripped, ranges: remapped, embeds, links: toLinks(stripped, links, offsets) }
}

export type { MarkdownEmbed, MarkdownLink, StrippedMarkdown, StripOptions }

export { OBJECT_REPLACEMENT, stripSyntax }
