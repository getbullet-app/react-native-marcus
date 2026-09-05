import type { HTMLMarkdownElement, MarkdownTextInputElement } from "../../MarkdownTextInput.web"
import { addNodeToTree, createRootTreeNode } from "./treeUtils"
import type { NodeType, TreeNode } from "./treeUtils"
import type { PartialMarkdownStyle } from "../../styleUtils"
import { getCurrentCursorPosition, moveCursorToEnd, setCursorPosition } from "./cursorUtils"
import {
  addBlockPrefixGap,
  addLineLayout,
  addStyleToBlock,
  isMultilineMarkdownType,
} from "./blockUtils"
import { layoutBlocks, SHOWN_MARKERS } from "./blockLayout"
import type { LineLayout, MarkerRendering } from "./blockLayout"
import { createTextMeasurer } from "./measureUtils"
import type { TextMeasurer } from "./measureUtils"
import type { MarkdownRange, MarkdownType } from "../../commonTypes"
import { sortRanges, ungroupRanges } from "../../rangeUtils"

type Paragraph = {
  text: string
  start: number
  length: number
  markdownRanges: MarkdownRange[]
  /** Where the containers this line sits in put its text, once they are all placed. */
  layout?: LineLayout
}

function splitTextIntoLines(text: string): Paragraph[] {
  let lineStartIndex = 0
  const lines: Paragraph[] = text.split("\n").map((line) => {
    const lineObject: Paragraph = {
      text: line,
      start: lineStartIndex,
      length: line.length,
      markdownRanges: [],
    }
    lineStartIndex += line.length + 1 // Adding 1 for the newline character
    return lineObject
  })

  return lines
}

/**
 * Merges lines with multiline markdown tags (like `pre`) into a single line.
 * The main line will contain the text and all markdown ranges from the other lines.
 */
function mergeLinesWithMultilineTags(
  lines: Paragraph[],
  currentLine: Paragraph,
  range: MarkdownRange,
  correspondingLineIndexes: number[],
) {
  const mainLine = currentLine
  currentLine.markdownRanges.push(range)

  correspondingLineIndexes.forEach((lineIndex) => {
    const otherLine = lines[lineIndex] as Paragraph
    mainLine.text += `\n${otherLine.text}`
    mainLine.length += otherLine.length + 1
    mainLine.markdownRanges.push(...otherLine.markdownRanges)
  })

  if (correspondingLineIndexes.length > 0 && correspondingLineIndexes[0] !== undefined) {
    lines.splice(correspondingLineIndexes[0], correspondingLineIndexes.length)
  }
}

/**
 * Splits a markdown range that spans multiple lines into separate lines.
 */
function splitRangeIntoSeparateLines(
  lines: Paragraph[],
  currentLine: Paragraph,
  range: MarkdownRange,
  correspondingLineIndexes: number[],
) {
  const mainLineRangeLength = currentLine.start + currentLine.length - range.start
  // A range starting exactly at the newline has nothing on this line. Pushing the empty portion
  // anyway made the builder render an empty span, and an empty span is given a `<br>` to keep the
  // line height -- a line break in the text that the user never typed.
  if (mainLineRangeLength > 0) {
    currentLine.markdownRanges.push({
      ...range,
      length: mainLineRangeLength,
    })
  }

  let rangeLength = range.length - mainLineRangeLength
  correspondingLineIndexes.forEach((lineIndex) => {
    const otherLine = lines[lineIndex] as Paragraph
    let currentLength = otherLine.length
    if (rangeLength <= currentLength) {
      currentLength = rangeLength - 1
    }

    if (currentLength > 0) {
      lines[lineIndex]?.markdownRanges.push({
        ...range,
        start: otherLine.start,
        length: currentLength,
      })
    }

    rangeLength -= currentLength
  })
}

/**
 * For singleline markdown types, the function splits markdown ranges that spread beyond the line length into separate lines.
 * For multiline markdown types (like `pre`), it merges them and corresponding text into one line.
 */
function normalizeLines(lines: Paragraph[], ranges: MarkdownRange[]) {
  const mergedLines = [...lines]
  const lineIndexes = mergedLines.map((_line, index) => index)

  ranges.forEach((range) => {
    const beginLineIndex = mergedLines.findLastIndex((line) => line.start <= range.start)
    const endLineIndex = mergedLines.findIndex(
      (line) => line.start + line.length >= range.start + range.length,
    )
    const correspondingLineIndexes = lineIndexes.slice(beginLineIndex, endLineIndex + 1)

    if (correspondingLineIndexes.length > 0) {
      const mainLineIndex = correspondingLineIndexes[0] as number
      const mainLine = mergedLines[mainLineIndex] as Paragraph
      const otherLineIndexes = correspondingLineIndexes.slice(1)

      if (isMultilineMarkdownType(range.type)) {
        mergeLinesWithMultilineTags(mergedLines, mainLine, range, otherLineIndexes)
      } else if (otherLineIndexes.length > 0) {
        splitRangeIntoSeparateLines(mergedLines, mainLine, range, otherLineIndexes)
      } else {
        mainLine.markdownRanges.push(range)
      }
    }
  })

  return mergedLines
}

/** Adds a value prop to the element and appends the value to the parent node element */
function appendValueToElement(
  element: HTMLMarkdownElement,
  parentTreeNode: TreeNode,
  value: string,
) {
  const targetElement = element
  const parentNode = parentTreeNode
  targetElement.value = value
  parentNode.element.value = (parentNode.element.value || "") + value
}

function appendNode(
  element: HTMLMarkdownElement,
  parentTreeNode: TreeNode,
  type: NodeType,
  length: number,
  start: number | null = null,
) {
  const node = addNodeToTree(element, parentTreeNode, type, length, start)
  parentTreeNode.element.appendChild(element)
  return node
}

function addBrElement(node: TreeNode) {
  const span = document.createElement("span") as HTMLMarkdownElement
  span.setAttribute("data-type", "br")
  appendValueToElement(span, node, "\n")
  const spanNode = appendNode(span, node, "br", 1)
  appendNode(document.createElement("br") as unknown as HTMLMarkdownElement, spanNode, "br", 1)
  return spanNode
}

function addTextToElement(node: TreeNode, text: string, isMultiline = true) {
  const lines = text.split("\n")
  lines.forEach((line, index) => {
    if (line !== "") {
      const span = document.createElement("span") as HTMLMarkdownElement
      appendValueToElement(span, node, line)
      span.setAttribute("data-type", "text")
      span.appendChild(document.createTextNode(line))
      appendNode(span, node, "text", line.length)

      const parentType = span.parentElement?.dataset.type
      if (
        !isMultiline &&
        parentType &&
        ["pre", "code", "mention"].includes(parentType)
      ) {
        // this is a fix to background colors being shifted downwards in a singleline input
        addStyleToBlock(span, "text", {}, false)
      }
    }

    // Only add BR elements for multiline inputs or when there are actual line breaks
    if (isMultiline && (index < lines.length - 1 || (index === 0 && line === ""))) {
      addBrElement(node)
    }
  })
}

function addParagraph(
  node: TreeNode,
  text: string | null,
  length: number,
  layout: LineLayout | undefined,
  markdownStyle: PartialMarkdownStyle,
  disableInlineStyles = false,
) {
  const p = document.createElement("p")
  p.setAttribute("data-type", "line")
  if (!disableInlineStyles) {
    addLineLayout(p, layout, markdownStyle)
  }

  const pNode = appendNode(p as unknown as HTMLMarkdownElement, node, "line", length)

  if (text === "") {
    // If the line is empty, we still need to add a br element to keep the line height
    addBrElement(pNode)
  } else if (text) {
    addTextToElement(pNode, text)
  }

  return pNode
}

/**
 * `syntax`, `block-prefix` and `emoji` decorate whatever they sit in, so where ranges cover exactly
 * the same text those three have to come last: the container, then the `block-prefix` holding its
 * marker, then the `syntax` of the marker itself. Typing a bare `>` produces all three over one
 * character, and the parser emits them in precisely the wrong order -- `flushLine` hands the marker
 * over before the container it belongs to, because that is the pairing the native formatters read.
 * Inverting that is the whole job of `getTagPriority`.
 *
 * Every other tie is already right. A range is emitted when its construct opens, so emission order
 * is containment order, and a stable sort leaves it alone. That is also the only thing that *can*
 * order two containers of the same size: `> - a` and `- > a` are the same pair of containers over
 * the same line, nested opposite ways, and no table of types can say which.
 *
 * So the one thing worth checking is a decoration that sorted ahead of something it belongs to --
 * which is what a container type missing from `getTagPriority` produces. The builder then renders
 * that text once per range, silently, multiplying with every keystroke. Nothing about that failure
 * points at the missing table entry, so say it out loud instead.
 */
const INNERMOST_TYPES = new Set<MarkdownType>(["block-prefix", "syntax", "emoji"])

function reportAmbiguousNesting(ranges: MarkdownRange[]) {
  for (let i = 1; i < ranges.length; i++) {
    const previous = ranges[i - 1] as MarkdownRange
    const current = ranges[i] as MarkdownRange

    if (
      previous.start === current.start &&
      previous.length === current.length &&
      INNERMOST_TYPES.has(previous.type) &&
      !INNERMOST_TYPES.has(current.type)
    ) {
      // eslint-disable-next-line no-console
      console.error(
        `[react-native-marcus] \`${previous.type}\` sorts ahead of \`${current.type}\` over the same text, so the marker ends up outside what it belongs to and renders once per range. Give \`${current.type}\` a higher priority in src/rangeUtils.ts.`,
      )
    }
  }
}

/**
 * Builds one `<p data-type="line">` under `rootNode`.
 *
 * Lines are independent: nothing carries across from the previous one, which is what lets an update
 * rebuild a single line and leave the rest of the document alone.
 */
function addLine(
  rootNode: TreeNode,
  line: Paragraph,
  textLength: number,
  hasRanges: boolean,
  isMultiline: boolean,
  markdownStyle: PartialMarkdownStyle,
  disableInlineStyles: boolean,
  rendering: MarkerRendering,
) {
  if (!hasRanges) {
    return addParagraph(
      rootNode,
      line.text,
      line.length,
      line.layout,
      markdownStyle,
      disableInlineStyles,
    )
  }

  const lineNode = addParagraph(
    rootNode,
    null,
    line.length,
    line.layout,
    markdownStyle,
    disableInlineStyles,
  )
  let currentParentNode: TreeNode = lineNode

  if (line.markdownRanges.length === 0) {
    addTextToElement(currentParentNode, line.text, isMultiline)
  }

  let lastRangeEndIndex = line.start
  const lineMarkdownRanges = [...line.markdownRanges]
  // go through all markdown ranges in the line
  while (lineMarkdownRanges.length > 0) {
    const range = lineMarkdownRanges.shift()
    if (!range) {
      break
    }

    const endOfCurrentRange = range.start + range.length
    const nextRangeStartIndex =
      lineMarkdownRanges.length > 0 && !!lineMarkdownRanges[0]
        ? lineMarkdownRanges[0].start || 0
        : textLength

    // add text before the markdown range. Ranges that start behind the cursor are already
    // rendered; without the guard `substring` would swap its arguments and emit that text again.
    const textBeforeRange =
      range.start > lastRangeEndIndex
        ? line.text.substring(lastRangeEndIndex - line.start, range.start - line.start)
        : ""
    if (textBeforeRange) {
      addTextToElement(currentParentNode, textBeforeRange, isMultiline)
    }

    // create markdown span element
    const span = document.createElement("span") as HTMLMarkdownElement
    span.setAttribute("data-type", range.type)

    const spanNode = appendNode(span, currentParentNode, range.type, range.length, range.start)

    // Styled once it is in the tree, not before: a heading's size depends on how many heading
    // levels enclose it, and an element with no parent looks like the outermost one.
    if (!disableInlineStyles) {
      addStyleToBlock(span, range.type, markdownStyle, isMultiline, rendering)
      if (range.type === "block-prefix") {
        addBlockPrefixGap(span, line.layout?.gaps.get(range.start))
      }
    }

    if (
      lineMarkdownRanges.length > 0 &&
      nextRangeStartIndex < endOfCurrentRange &&
      range.type !== "syntax"
    ) {
      // tag nesting
      currentParentNode = spanNode
      lastRangeEndIndex = range.start
    } else {
      // adding markdown tag
      addTextToElement(spanNode, line.text.substring(range.start - line.start, endOfCurrentRange - line.start), isMultiline)
      currentParentNode.element.value =
        (currentParentNode.element.value || "") + (spanNode.element.value || "")
      lastRangeEndIndex = endOfCurrentRange
      // tag unnesting and adding text after the tag
      while (
        currentParentNode.parentNode !== null &&
        nextRangeStartIndex >= currentParentNode.start + currentParentNode.length
      ) {
        const parentEndIndex = currentParentNode.start + currentParentNode.length
        const textAfterRange =
          parentEndIndex > lastRangeEndIndex
            ? line.text.substring(lastRangeEndIndex - line.start, parentEndIndex - line.start)
            : ""
        if (textAfterRange) {
          addTextToElement(currentParentNode, textAfterRange, isMultiline)
        }
        // Never backwards: an enclosing range can end before the text already consumed inside it
        // -- a list whose item holds a code block runs to the end of its marker line while the
        // block inside it runs on for several more. Letting it rewind made the paragraph re-emit
        // everything from there, so the line rendered twice.
        lastRangeEndIndex = parentEndIndex > lastRangeEndIndex ? parentEndIndex : lastRangeEndIndex
        // A line's content never escapes its own paragraph. Without this the walk could reach the
        // root, and every later range on the line was appended there instead -- a stray top-level
        // element between the paragraphs, which shifts every `data-id` after it and leaves the
        // line it belonged to rendered in two places.
        if (currentParentNode === lineNode) {
          break
        }
        if (currentParentNode.parentNode.type !== "root") {
          currentParentNode.parentNode.element.value = currentParentNode.element.value || ""
        }
        currentParentNode = currentParentNode.parentNode || rootNode
      }
    }
  }

  return lineNode
}

/** Splits the text into lines and hands each the markdown ranges that fall inside it. */
function prepareLines(
  text: string,
  ranges: MarkdownRange[],
  markdownStyle: PartialMarkdownStyle,
  measure: TextMeasurer,
  rendering: MarkerRendering = SHOWN_MARKERS,
) {
  const lines = splitTextIntoLines(text)

  if (ranges.length === 0) {
    return lines
  }

  // Before anything reorders them: the block walk reads the ranges in the order the parser emits
  // them -- each marker immediately before the container it belongs to -- and `sortRanges` sorts
  // that order away in place.
  const layouts = layoutBlocks(text, ranges, markdownStyle, measure, rendering)

  // Sort all ranges by start position, length, and by tag hierarchy so the styles and text are applied in correct order
  const sortedRanges = sortRanges(ranges)
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    reportAmbiguousNesting(sortedRanges)
  }

  const normalized = normalizeLines(lines, ungroupRanges(sortedRanges))

  // Ranges reach a line in document order, but a range spanning several lines hands its tail to
  // those lines as it is processed -- ahead of ranges that start later on the same line and should
  // have come first. `1. *l\nd**` puts an italic that opened on line 1 in front of the list its
  // second half sits inside, and the builder then nests the list *within* the italic and renders
  // the overlap twice. Restoring the order per line costs nothing on lines that were already
  // sorted, which is nearly all of them.
  normalized.forEach((paragraph) => {
    const line = paragraph
    sortRanges(line.markdownRanges)
    line.layout = layouts.get(line.start)
  })

  return normalized
}

/** Builds HTML DOM structure based on passed text and markdown ranges */
function parseRangesToHTMLNodes(
  text: string,
  ranges: MarkdownRange[],
  isMultiline = true,
  markdownStyle: PartialMarkdownStyle = {},
  disableInlineStyles = false,
  measure: TextMeasurer = createTextMeasurer(null),
  rendering: MarkerRendering = SHOWN_MARKERS,
) {
  const rootElement: HTMLMarkdownElement = document.createElement("span") as HTMLMarkdownElement
  const textLength = text.length
  const rootNode: TreeNode = createRootTreeNode(rootElement, textLength)

  // Built line by line, exactly as an update builds the lines it has to replace, so the two agree
  // by construction and each line sits at the offset the text gives it rather than at wherever the
  // line before it happened to end.
  prepareLines(text, ranges, markdownStyle, measure, rendering).forEach((line, index) => {
    const node = buildLine(
      line,
      index,
      textLength,
      ranges.length > 0,
      isMultiline,
      markdownStyle,
      disableInlineStyles,
      rendering,
    )
    node.parentNode = rootNode
    rootNode.childNodes.push(node)
    rootElement.appendChild(node.element)
  })

  return { dom: rootElement, tree: rootNode }
}

/**
 * A line as it was last rendered: what it was built from, the markup it produced, and its subtree.
 */
type CachedLine = {
  signature: string
  html: string
  node: TreeNode
}

type LineCache = {
  markdownStyle: PartialMarkdownStyle
  isMultiline: boolean
  lines: CachedLine[]
}

/**
 * Everything a line's markup depends on, as a string.
 *
 * A line is rendered from its own text and the ranges falling inside it, and nothing else -- so two
 * lines with equal signatures render identically and the second one need not be built at all. Range
 * offsets go in relative to the line, so a line that only moved still matches.
 */
function signatureOf(line: Paragraph, hasRanges: boolean) {
  let signature = hasRanges ? "r" : "-"
  signature += line.text

  line.markdownRanges.forEach((range) => {
    signature += `\u0000${range.start - line.start},${range.length},${range.type},${range.depth ?? ""}`
  })

  // The layout is not derived from this line alone -- a continuation line indents past a marker
  // that belongs to the line that opened the block, and every width comes out of the font the
  // input happens to be rendering in. Both reach the line only through these numbers, so they are
  // what the signature has to compare.
  const layout = line.layout
  if (layout) {
    signature += `\u0000${layout.firstLineIndent},${layout.indent},${layout.ribbons.join(":")}`
    layout.gaps.forEach((gap, start) => {
      signature += `,${start - line.start}:${gap}`
    })
  }

  return signature
}

/** Moves a subtree along the text by `delta`, for a line that shifted without changing. */
function shiftSubtree(node: TreeNode, delta: number) {
  const target = node
  target.start += delta
  target.childNodes.forEach((child) => shiftSubtree(child, delta))
}

/** Renumbers a subtree, for a line whose index changed because lines were added or removed above. */
function restampSubtree(node: TreeNode, orderIndex: string) {
  const target = node
  target.orderIndex = orderIndex
  target.element.setAttribute("data-id", orderIndex)
  target.childNodes.forEach((child, index) => restampSubtree(child, `${orderIndex},${index}`))
}

/**
 * Grows every node to at least cover its children.
 *
 * A container range can be shorter than what the builder puts inside it -- a list item's own range
 * stops at the end of its marker line, while a fenced code block opened there runs on for several
 * more. The tree is what maps a text offset onto a node, so a parent that does not reach the end of
 * its own children leaves that overhang mapping to nothing and the caret cannot be placed in it.
 *
 * It runs once the line is built, never during: a node's length decides where its next sibling
 * starts and how far the builder thinks it has got, so growing one mid-build changes the markup.
 */
function coverChildren(node: TreeNode) {
  const target = node
  let end = target.start + target.length

  target.childNodes.forEach((child) => {
    coverChildren(child)
    const childEnd = child.start + child.length
    if (childEnd > end) {
      end = childEnd
    }
  })

  target.length = end - target.start
}

/** Builds one line on its own, then places it at the offset and index it occupies in the document. */
function buildLine(
  line: Paragraph,
  index: number,
  textLength: number,
  hasRanges: boolean,
  isMultiline: boolean,
  markdownStyle: PartialMarkdownStyle,
  disableInlineStyles = false,
  rendering: MarkerRendering = SHOWN_MARKERS,
) {
  // The scratch root carries the line's offset, so the subtree comes out with the absolute `start`
  // values the builder compares against range offsets -- the same ones it would get if the whole
  // document had been built in one pass.
  const scratch = createRootTreeNode(
    document.createElement("span") as HTMLMarkdownElement,
    line.length,
    line.start,
  )
  const node = addLine(
    scratch,
    line,
    textLength,
    hasRanges,
    isMultiline,
    markdownStyle,
    disableInlineStyles,
    rendering,
  )

  coverChildren(node)
  restampSubtree(node, `${index}`)

  return node
}

/**
 * A cached line can be reused only if it would be rebuilt identically *and* the live element is
 * still exactly what was put there.
 *
 * The identity check matters as much as the signature: the browser edits the input directly as the
 * user types, and it is free to merge, split or wrap the top-level elements. Requiring the live
 * node to be the very one this entry rendered means anything the browser introduced falls outside
 * the reusable prefix and suffix, and so lands in the run that gets replaced.
 */
function canReuseLine(
  cached: CachedLine | undefined,
  signature: string | undefined,
  liveNode: ChildNode | undefined,
) {
  return (
    !!cached &&
    cached.signature === signature &&
    liveNode === cached.node.element &&
    (liveNode as HTMLElement).outerHTML === cached.html
  )
}

/**
 * Renders `lines` into the input, building only the ones that changed.
 *
 * Rebuilding every line and then diffing meant the expensive half of an update happened whatever
 * the edit was -- construction is the dominant cost, not applying the result. Matching lines are
 * skipped from both ends by signature, so a keystroke builds one line and the rest of the document
 * keeps the elements and the subtrees it already had. Lines after the edit are shifted along the
 * text, and renumbered if lines were added or removed above them; both are cheap walks that touch
 * no element beyond a `data-id`.
 */
function reconcileLines(
  targetElement: MarkdownTextInputElement,
  lines: Paragraph[],
  textLength: number,
  hasRanges: boolean,
  isMultiline: boolean,
  markdownStyle: PartialMarkdownStyle,
  shouldForceDOMUpdate: boolean,
) {
  const signatures = lines.map((line) => signatureOf(line, hasRanges))
  const cache = targetElement.lineCache
  const previous =
    !shouldForceDOMUpdate &&
    cache &&
    cache.markdownStyle === markdownStyle &&
    cache.isMultiline === isMultiline
      ? cache.lines
      : []
  const live = Array.from(targetElement.childNodes)

  let head = 0
  while (
    head < lines.length &&
    head < previous.length &&
    canReuseLine(previous[head], signatures[head], live[head])
  ) {
    head += 1
  }

  let tail = lines.length
  let previousTail = previous.length
  let liveTail = live.length
  while (
    tail > head &&
    previousTail > head &&
    liveTail > head &&
    canReuseLine(previous[previousTail - 1], signatures[tail - 1], live[liveTail - 1])
  ) {
    tail -= 1
    previousTail -= 1
    liveTail -= 1
  }

  const fresh: TreeNode[] = []
  for (let i = head; i < tail; i += 1) {
    fresh.push(
      buildLine(
        lines[i] as Paragraph,
        i,
        textLength,
        hasRanges,
        isMultiline,
        markdownStyle,
      ),
    )
  }

  // Read before removing anything: this is the first live node of the matching tail, which stays.
  const anchor = live[liveTail] ?? null
  for (let i = head; i < liveTail; i += 1) {
    live[i]?.remove()
  }

  if (fresh.length > 0) {
    const fragment = document.createDocumentFragment()
    fresh.forEach((node) => fragment.appendChild(node.element))
    targetElement.insertBefore(fragment, anchor)
  }

  const rootNode = createRootTreeNode(targetElement, textLength)
  const nextCache: CachedLine[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as Paragraph
    let node: TreeNode
    let html: string

    if (i < head) {
      const cached = previous[i] as CachedLine
      node = cached.node
      html = cached.html
    } else if (i < tail) {
      node = fresh[i - head] as TreeNode
      html = (node.element as HTMLElement).outerHTML
    } else {
      const cached = previous[previousTail + (i - tail)] as CachedLine
      node = cached.node
      const delta = line.start - node.start
      if (delta !== 0) {
        shiftSubtree(node, delta)
      }
      if (node.orderIndex !== `${i}`) {
        restampSubtree(node, `${i}`)
        html = (node.element as HTMLElement).outerHTML
      } else {
        html = cached.html
      }
    }

    node.parentNode = rootNode
    rootNode.childNodes.push(node)
    nextCache.push({ signature: signatures[i] as string, html, node })
  }

  targetElement.lineCache = { markdownStyle, isMultiline, lines: nextCache }

  return rootNode
}

function moveCursor(
  isFocused: boolean,
  alwaysMoveCursorToTheEnd: boolean,
  cursorPosition: number | null,
  target: MarkdownTextInputElement,
  shouldScrollIntoView = false,
) {
  if (!isFocused) {
    return
  }

  if (alwaysMoveCursorToTheEnd || cursorPosition === null) {
    moveCursorToEnd(target)
  } else if (cursorPosition !== null) {
    setCursorPosition(target, cursorPosition, null, shouldScrollIntoView)
  }
}

function updateInputStructure(
  parserFunction: (input: string) => MarkdownRange[],
  target: MarkdownTextInputElement,
  text: string,
  cursorPositionIndex: number | null,
  isMultiline = true,
  markdownStyle: PartialMarkdownStyle = {},
  alwaysMoveCursorToTheEnd = false,
  shouldForceDOMUpdate = false,
  shouldScrollIntoView = false,
) {
  const targetElement = target

  // in case the cursorPositionIndex is larger than text length, cursorPosition will be null, i.e: move the caret to the end
  let cursorPosition: number | null =
    cursorPositionIndex !== null && cursorPositionIndex <= text.length
      ? cursorPositionIndex
      : null
  const isFocused = document.activeElement === target
  if (isFocused && cursorPositionIndex === null) {
    const selection = getCurrentCursorPosition(target)
    cursorPosition = selection ? selection.start : null
  }
  const markdownRanges = parserFunction(text)
  if (
    !text ||
    targetElement.innerHTML === "<br>" ||
    (targetElement && targetElement.innerHTML === "\n")
  ) {
    targetElement.innerHTML = ""
    targetElement.innerText = ""
  }

  // We don't want to parse text with single '\n', because contentEditable represents it as invisible <br />
  if (text) {
    targetElement.tree = reconcileLines(
      targetElement,
      prepareLines(text, markdownRanges, markdownStyle, createTextMeasurer(targetElement)),
      text.length,
      markdownRanges.length > 0,
      isMultiline,
      markdownStyle,
      shouldForceDOMUpdate,
    )

    moveCursor(
      isFocused,
      alwaysMoveCursorToTheEnd,
      cursorPosition,
      targetElement,
      shouldScrollIntoView,
    )
  } else {
    targetElement.tree = createRootTreeNode(targetElement)
    targetElement.lineCache = undefined
  }

  return { text, cursorPosition: cursorPosition || 0 }
}

export { updateInputStructure, parseRangesToHTMLNodes, normalizeLines }
export type { Paragraph, LineCache }
