"worklet"

import type { MarkdownRange } from "./commonTypes"

// A range is emitted when the construct it belongs to opens, so the parser's order is already
// containment order: whatever encloses something opened before it. `sortRanges` keeps that order
// for ranges it cannot separate, which is just as well, because for two containers of the same size
// the answer is not a property of their types at all -- `> - a` and `- > a` are the same pair over
// the same line, nested opposite ways.
//
// One pairing breaks the rule, deliberately. `flushLine` emits a container's `block-prefix` before
// the container itself, because the native formatters lay a line out in one left-to-right walk and
// hand each marker to the container that follows it; the `syntax` inside that marker is emitted
// earlier still, when the marker's own token opens. Typing a bare `>` therefore produces three
// ranges over one character, in exactly the wrong order for a tree.
//
// This table exists to invert that one pairing, and nothing else: a block container outranks the
// `block-prefix` holding its marker, which outranks the `syntax` of the marker itself. `heading`
// sits above the default so it encloses what a heading line contains, and `emoji` below everything
// because it is always innermost. A container type left out of the table sorts level with the
// marker it should contain, and the marker then renders once per range -- see
// `reportAmbiguousNesting`, which is the check for exactly that.
function getTagPriority(tag: string) {
  switch (tag) {
    case "blockquote":
    case "list-ordered":
    case "list-unordered":
      return 3
    case "block-prefix":
      return 2
    case "heading":
      return 1
    case "emoji":
      return -1
    default:
      return 0
  }
}

// Sorts into the containment order the web builder nests by: outermost first, and for anything the
// three keys below cannot separate, the order the parser emitted them in. That last step is load
// bearing rather than incidental -- `Array.prototype.sort` is required to be stable, and emission
// order is what decides which of two equally sized containers encloses the other.
function sortRanges(ranges: MarkdownRange[]) {
  // sort ranges by start position, then by length, then by tag hierarchy
  return ranges.sort(
    (a, b) =>
      a.start - b.start ||
      b.length - a.length ||
      getTagPriority(b.type) - getTagPriority(a.type) ||
      0,
  )
}

function ungroupRanges(ranges: MarkdownRange[]): MarkdownRange[] {
  const ungroupedRanges: MarkdownRange[] = []
  ranges.forEach((range) => {
    if (!range.depth) {
      ungroupedRanges.push(range)
    }
    const { depth, ...rangeWithoutDepth } = range
    Array.from({ length: depth! }).forEach(() => {
      ungroupedRanges.push(rangeWithoutDepth)
    })
  })
  return ungroupedRanges
}
export { getTagPriority, sortRanges, ungroupRanges }
