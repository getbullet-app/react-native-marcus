import UIKit

/// Applies markdown ranges to an attributed string as text attributes.
///
/// Stateless by design: style and ranges are parameters rather than stored
/// properties. That is what lets the Fabric measure path call it concurrently
/// without a lock -- the previous design stored the style and parser id on a
/// shared object, so a setter on one thread could race a read on another.
@objc public final class MarkdownFormatter: NSObject {

  /// Font resolution is injected rather than reached for, so this file carries
  /// no React dependency and can be compiled on its own. The Objective-C entry
  /// point in `MarkdownFormatter+React.swift` supplies the production one.
  /// `resetAttributes` distinguishes the two callers. A text input formats the
  /// same live storage over and over, so it starts from a clean slate each
  /// time. A paragraph is handed a string that was just built from the shadow
  /// tree, already carrying the per-fragment attributes of every nested `Text`
  /// -- and, where a `View` was passed as a child, an attachment that a reset
  /// would throw away.
  ///
  /// `display` says which of the two is being formatted, which only the list
  /// markers care about: a display draws them -- a bullet for an unordered item,
  /// the number at its own scale for an ordered one -- where an input shows the
  /// marker you typed, in the base font, because there it is text being edited
  /// rather than a rendering of it.
  public static func format(
    _ attributedString: NSMutableAttributedString,
    defaultTextAttributes: [NSAttributedString.Key: Any],
    ranges: [MarcusRange],
    style: RCTMarcusStyle,
    fonts: MarkdownFontProviding,
    resetAttributes: Bool = true,
    display: Bool = false
  ) {
    let fullRange = NSRange(location: 0, length: attributedString.length)

    attributedString.beginEditing()

    if resetAttributes {
      attributedString.setAttributes(defaultTextAttributes, range: fullRange)

      // Forces the swizzled `_textOf:equals:` into string-only comparison.
      attributedString.addAttribute(.marcusText, value: true, range: fullRange)
    }

    // Containers arrive per line, outermost first, each preceded by the run of
    // text its own marker takes up on that line. Laying a line out is a walk
    // left to right: reserve a container's gutter, step over its marker, repeat.
    var line = BlockLayout(
      style: style,
      display: display,
      baseFontSize: (defaultTextAttributes[.font] as? UIFont)?.pointSize ?? 0
    )
    var pendingPrefix: NSRange?
    // Boxed once the walk is over: a block's own indent is whatever its lines
    // ended up with, and the containers around it are still being placed here.
    var codeBlocks: [NSRange] = []

    for markdownRange in ranges {
      if markdownRange.type == "block-prefix" {
        pendingPrefix = markdownRange.range
        continue
      }

      if markdownRange.type == "codeblock" {
        codeBlocks.append(markdownRange.range)
        continue
      }

      if let gutter = gutter(
        for: markdownRange.type,
        depth: Int(markdownRange.depth),
        style: style
      ) {
        line.add(
          markdownRange.type,
          gutter: gutter,
          depth: Int(markdownRange.depth),
          prefix: pendingPrefix,
          to: attributedString,
          range: markdownRange.range,
          defaultTextAttributes: defaultTextAttributes
        )
        pendingPrefix = nil
        continue
      }

      apply(
        markdownRange.type,
        to: attributedString,
        range: markdownRange.range,
        depth: Int(markdownRange.depth),
        style: style,
        fonts: fonts
      )
    }

    for codeBlock in codeBlocks {
      box(
        codeBlock,
        in: attributedString,
        style: style,
        defaultTextAttributes: defaultTextAttributes
      )
    }

    (attributedString.string as NSString).enumerateSubstrings(
      in: fullRange,
      options: [.byLines, .substringNotRequired]
    ) { _, _, enclosingRange, _ in
      applyBaselineOffset(to: attributedString, range: enclosingRange)
    }

    attributedString.fixAttributes(in: fullRange)

    attributedString.endEditing()
  }

  // MARK: - Per-range attributes

  private static func apply(
    _ type: String,
    to attributedString: NSMutableAttributedString,
    range: NSRange,
    depth: Int,
    style: RCTMarcusStyle,
    fonts: MarkdownFontProviding
  ) {
    switch type {
    case "bold", "italic", "code", "pre", "heading", "emoji":
      var font =
        attributedString.attribute(
          .font,
          at: range.location,
          effectiveRange: nil
        ) as? UIFont
      switch type {
      case "bold":
        font = fonts.update(font, weight: "bold")
      case "italic":
        font = fonts.update(font, style: "italic")
      case "code":
        font = fonts.update(
          font,
          family: style.codeFontFamily,
          size: style.codeFontSize,
          weight: nil
        )
      case "pre":
        font = fonts.update(
          font,
          family: style.preFontFamily,
          size: style.preFontSize,
          weight: nil
        )
      case "heading":
        // Level N is the base size scaled N-1 times, so a single pair of style
        // values covers all six.
        var size = style.headingFontSize
        for _ in 1..<max(depth, 1) {
          size *= style.headingScale
        }
        font = fonts.update(font, family: nil, size: size, weight: "bold")
      case "emoji":
        font = fonts.update(
          font,
          family: style.emojiFontFamily,
          size: style.emojiFontSize,
          weight: nil
        )
      default:
        break
      }
      attributedString.addAttribute(.font, value: font as Any, range: range)
    default:
      break
    }

    switch type {
    // A fenced block's language is its own type so that something can read it,
    // but in an input it is part of the fence you are typing and reads as
    // markup, so it is coloured like the rest of it.
    case "syntax", "codeblock-language":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.syntaxColor,
        range: range
      )

    case "strikethrough":
      attributedString.addAttribute(
        .strikethroughStyle,
        value: NSUnderlineStyle.single.rawValue,
        range: range
      )

    case "code":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.codeColor,
        range: range
      )
      chip(
        range,
        in: attributedString,
        color: style.codeBackgroundColor,
        borderRadius: style.codeBorderRadius,
        padding: style.codePadding,
        margin: style.codeMargin
      )

    case "mention":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.mentionColor,
        range: range
      )
      chip(
        range,
        in: attributedString,
        color: style.mentionBackgroundColor,
        borderRadius: style.mentionBorderRadius,
        padding: style.mentionPadding,
        margin: style.mentionMargin
      )

    case "link":
      attributedString.addAttribute(
        .underlineStyle,
        value: NSUnderlineStyle.single.rawValue,
        range: range
      )
      attributedString.addAttribute(
        .foregroundColor,
        value: style.linkColor,
        range: range
      )

    // Only the colour: what a block is drawn on is a box behind the whole of it,
    // applied from the `codeblock` range in box(_:in:style:) rather than from
    // the code it holds.
    case "pre":
      attributedString.addAttribute(
        .foregroundColor,
        value: style.preColor,
        range: range
      )

    default:
      break
    }
  }

  // MARK: - Inline boxes

  /// Boxes one run of text -- a mention, or an inline run of code: the room its
  /// background takes up, and the background itself.
  ///
  /// The room is kerning, which is the one way a line can be made to leave space
  /// around a run of itself: a paragraph's indent would move the whole line, and
  /// a background colour would simply sit under whatever is next to it. The
  /// character before the run holds the space in front of it and the run's own
  /// last character the space behind, so both sides come out of an advance
  /// rather than out of a glyph.
  ///
  /// Nothing is kerned in front of a run that opens a line -- there is no
  /// character there to widen -- and its box grows into the margin instead.
  private static func chip(
    _ range: NSRange,
    in attributedString: NSMutableAttributedString,
    color: UIColor,
    borderRadius: CGFloat,
    padding: CGFloat,
    margin: CGFloat
  ) {
    let background = MarkdownTextBackground()
    background.color = color
    background.borderRadius = borderRadius
    background.padding = padding
    background.margin = margin
    attributedString.addAttribute(
      .marcusTextBackground,
      value: background,
      range: range
    )

    let gap = padding + margin
    guard gap > 0, range.length > 0 else { return }

    let text = attributedString.string as NSString
    widen(NSMaxRange(range) - 1, by: gap, in: attributedString)

    let before = range.location - 1
    if before >= 0, !isLineBreak(text.character(at: before)) {
      widen(before, by: gap, in: attributedString)
    }
  }

  /// Adds to whatever the character at `index` was already kerned by, so a run
  /// that opens right after a container's marker keeps the gutter that marker
  /// was holding open.
  private static func widen(
    _ index: Int,
    by gap: CGFloat,
    in attributedString: NSMutableAttributedString
  ) {
    guard index >= 0, index < attributedString.length else { return }

    let existing =
      (attributedString.attribute(.kern, at: index, effectiveRange: nil)
        as? NSNumber)?.doubleValue ?? 0

    attributedString.addAttribute(
      .kern,
      value: CGFloat(existing) + gap,
      range: NSRange(location: index, length: 1)
    )
  }

  // MARK: - Code blocks

  /// Boxes one fenced or indented block: the room its background takes up, and
  /// the background itself.
  ///
  /// Run after the container walk rather than during it, because a block is not
  /// a container -- its range covers every line at once, where a container
  /// arrives one line at a time -- and because what it indents by is whatever
  /// the containers around it left its lines at.
  ///
  /// The padding and the margin are held open the same way on all four sides:
  /// as indent on the left, and as paragraph spacing above the first line and
  /// below the last. Nothing is reserved on the right; the box runs to the edge
  /// of the text there, so a line long enough to wrap reaches the padding. A
  /// paragraph cannot be given a trailing indent on Android at all, and a box
  /// that stopped short on one platform only would be worse than one that
  /// stops short on neither.
  private static func box(
    _ range: NSRange,
    in attributedString: NSMutableAttributedString,
    style: RCTMarcusStyle,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) {
    let text = attributedString.string as NSString
    guard let body = body(of: range, in: text) else { return }

    let inset = style.prePadding + style.preMargin
    var paragraphs: [NSRange] = []
    var location = body.location

    while location < NSMaxRange(body) {
      let paragraph = text.paragraphRange(
        for: NSRange(location: location, length: 0)
      )
      // A paragraph range always contains the location it was asked about, so
      // this cannot loop; the guard is for a string that changed underneath.
      guard paragraph.length > 0 else { break }
      paragraphs.append(paragraph)
      location = NSMaxRange(paragraph)
    }

    // Where the box's left edge goes: the leftmost the block's own lines start,
    // taken before they are moved right to make room for the padding. A line
    // that opens with a marker starts at its marker, so the box covers that --
    // the `>` of a quoted block is inside the block being quoted.
    var left = CGFloat.greatestFiniteMagnitude

    for (index, paragraph) in paragraphs.enumerated() {
      let indents = paragraphStyle(
        of: attributedString,
        at: paragraph.location,
        defaultTextAttributes: defaultTextAttributes
      )

      left = min(left, indents.firstLineHeadIndent)
      indents.firstLineHeadIndent += inset
      indents.headIndent += inset

      if index == 0 {
        indents.paragraphSpacingBefore += inset
      }
      if index == paragraphs.count - 1 {
        indents.paragraphSpacing += inset
      }

      attributedString.addAttribute(
        .paragraphStyle,
        value: indents,
        range: paragraph
      )
    }

    guard left < .greatestFiniteMagnitude else { return }

    let block = MarkdownCodeBlock()
    block.color = style.preBackgroundColor
    block.borderRadius = style.preBorderRadius
    block.margin = style.preMargin
    block.leftInset = left + style.preMargin

    attributedString.addAttribute(.marcusCodeBlock, value: block, range: body)
  }

  /// The lines a block actually occupies: its range with the line breaks it
  /// opens and closes with taken off.
  ///
  /// A display renderer removes the opening fence and leaves the break that
  /// ended it, so a block's range there begins on the line above its first line
  /// of code. Boxing that break would paint a box around the line above.
  private static func body(of range: NSRange, in text: NSString) -> NSRange? {
    var start = range.location
    var end = NSMaxRange(range)

    while start < end, isLineBreak(text.character(at: start)) {
      start += 1
    }
    while end > start, isLineBreak(text.character(at: end - 1)) {
      end -= 1
    }

    return end > start
      ? NSRange(location: start, length: end - start)
      : nil
  }

  private static func isLineBreak(_ character: unichar) -> Bool {
    character == unichar(10) || character == unichar(13)
  }

  // MARK: - List markers

  /// Room held open either side of a list's marker, or nothing at all for a
  /// container whose marker is shown rather than rendered.
  private static func markerPadding(
    for type: String,
    style: RCTMarcusStyle,
    display: Bool
  ) -> CGFloat {
    guard display else { return 0 }

    switch type {
    case "list-ordered":
      return style.orderedListMarkerPadding
    case "list-unordered":
      return style.unorderedListMarkerPadding
    default:
      return 0
    }
  }

  /// The width a prefix's glyphs take up, drawing whatever a display draws its
  /// marker as on the way past.
  ///
  /// A display renders the marker rather than showing it: an unordered item's
  /// `-` becomes a circle, an ordered item's `1.` stays the number it means but
  /// at its own scale. Both change how wide the prefix comes out, and the
  /// containers nested inside it start after that width, so the two are worked
  /// out in one place.
  private static func placeMarker(
    _ prefix: NSRange,
    type: String,
    decorate: Bool,
    in attributedString: NSMutableAttributedString,
    style: RCTMarcusStyle,
    display: Bool,
    baseFontSize: CGFloat
  ) -> CGFloat {
    let text = attributedString.string as NSString

    guard display, baseFontSize > 0, let marker = markerRun(prefix, in: text) else {
      return measure(prefix, in: attributedString)
    }

    switch type {
    case "list-unordered":
      let diameter = baseFontSize * style.unorderedListMarkerScale

      if decorate {
        bullet(
          marker,
          diameter: diameter,
          color: style.syntaxColor,
          in: attributedString
        )
      }

      // The marker's own glyph is not drawn, so the circle's width stands in
      // for it and the rest of the prefix -- an indent in front, the space
      // behind -- measures as it always did.
      return
        (width(prefix, in: attributedString) - width(marker, in: attributedString)
          + diameter).rounded(.up)

    case "list-ordered":
      if decorate {
        scale(
          marker,
          to: baseFontSize * style.orderedListMarkerScale,
          in: attributedString
        )
      }

      // Measured after the scaling, which is on the string by now, so this is
      // the width the number will actually be drawn at.
      return measure(prefix, in: attributedString)

    default:
      return measure(prefix, in: attributedString)
    }
  }

  /// The marker at the end of a prefix: the `-` of a bullet or the `1.` of a
  /// numbered item, without the indent in front of it or the space after it.
  ///
  /// Read off the text rather than taken from the `syntax` range covering it,
  /// because a prefix runs from wherever the previous container's marker ended
  /// and so can carry another container's marker with it -- the ordered list in
  /// `- > 1. ` is handed `> 1. `. The last run of non-blanks is this
  /// container's own.
  private static func markerRun(_ prefix: NSRange, in text: NSString) -> NSRange? {
    var end = NSMaxRange(prefix)

    while end > prefix.location, isBlank(text.character(at: end - 1)) {
      end -= 1
    }

    var start = end

    while start > prefix.location, !isBlank(text.character(at: start - 1)) {
      start -= 1
    }

    return end > start ? NSRange(location: start, length: end - start) : nil
  }

  /// Leaves the marker's glyph undrawn and puts a circle in the advance it had.
  ///
  /// The character stays in the string -- it is what a reader copies and what
  /// VoiceOver announces -- so hiding the glyph is a matter of colour, and the
  /// kerning is what makes its advance the circle's width whatever glyph the
  /// item happened to be written with.
  private static func bullet(
    _ marker: NSRange,
    diameter: CGFloat,
    color: UIColor,
    in attributedString: NSMutableAttributedString
  ) {
    let shape = MarkdownListBullet()
    shape.color = color
    shape.diameter = diameter

    attributedString.addAttribute(.marcusListBullet, value: shape, range: marker)
    attributedString.addAttribute(
      .foregroundColor,
      value: UIColor.clear,
      range: marker
    )

    widen(
      NSMaxRange(marker) - 1,
      by: diameter - width(marker, in: attributedString),
      in: attributedString
    )
  }

  /// Draws the marker at `size`, keeping the face it inherited.
  private static func scale(
    _ marker: NSRange,
    to size: CGFloat,
    in attributedString: NSMutableAttributedString
  ) {
    guard
      let font = attributedString.attribute(
        .font,
        at: marker.location,
        effectiveRange: nil
      ) as? UIFont
    else { return }

    attributedString.addAttribute(
      .font,
      value: font.withSize(size),
      range: marker
    )
  }

  private static func isBlank(_ character: unichar) -> Bool {
    character == unichar(32) || character == unichar(9)
  }

  // MARK: - Block layout

  /// The gutter a container reserves for itself, or nil if the type is not one.
  private static func gutter(
    for type: String,
    depth: Int,
    style: RCTMarcusStyle
  ) -> CGFloat? {
    switch type {
    case "blockquote":
      return (style.blockquoteMarginLeft + style.blockquoteBorderWidth
        + style.blockquotePaddingLeft) * CGFloat(depth)
    case "list-ordered":
      return (style.orderedListMarginLeft + style.orderedListPaddingLeft)
        * CGFloat(depth)
    case "list-unordered":
      return (style.unorderedListMarginLeft + style.unorderedListPaddingLeft)
        * CGFloat(depth)
    default:
      return nil
    }
  }

  /// Places the containers of one line, left to right.
  ///
  /// Each container reserves a gutter and is then followed by its own marker,
  /// which is text and so has to be stepped over rather than reserved: the
  /// container nested inside it starts after the marker, not in front of it.
  /// That is what puts a quote's ribbons after a list bullet, and a list's
  /// indent after a quote's `>`.
  ///
  /// A line continuing a block carries no marker of its own, and reuses the one
  /// that opened it -- otherwise its text, and any ribbon beside it, would sit
  /// at a different offset than the line above and break the block in two.
  private struct BlockLayout {
    let style: RCTMarcusStyle
    /// Whether the markers are being rendered or shown; see `format`.
    let display: Bool
    /// The size the wrapped `Text` draws at, which is what a marker is drawn in
    /// proportion to. Zero when the string carries no font at all, which leaves
    /// the markers as they were typed.
    let baseFontSize: CGFloat

    /// Last marker seen for each container type, for the lines that continue it.
    private var markers: [String: NSRange] = [:]

    // Spelled out because a private type's memberwise initialiser is private to
    // the type itself.
    init(style: RCTMarcusStyle, display: Bool, baseFontSize: CGFloat) {
      self.style = style
      self.display = display
      self.baseFontSize = baseFontSize
    }

    private var lineStart = NSNotFound
    /// Offset reached so far, from the paragraph's own left edge.
    private var offset: CGFloat = 0
    /// Where the line's first marker begins, if it has one. The text starts
    /// there; everything past it is held open with padding instead.
    private var textStart: CGFloat?
    /// Marker of the container placed most recently, if it is on this line and
    /// so has something to pad.
    private var padded: NSRange?

    mutating func add(
      _ type: String,
      gutter: CGFloat,
      depth: Int,
      prefix: NSRange?,
      to attributedString: NSMutableAttributedString,
      range: NSRange,
      defaultTextAttributes: [NSAttributedString.Key: Any]
    ) {
      if range.location != lineStart {
        lineStart = range.location
        offset = MarkdownFormatter.baseIndent(
          of: attributedString,
          at: range.location,
          defaultTextAttributes: defaultTextAttributes
        )
        textStart = nil
        padded = nil
      }

      if let padded {
        MarkdownFormatter.pad(padded, by: gutter, in: attributedString)
      }

      if type == "blockquote" {
        attributedString.addAttribute(
          .marcusBlockquoteDepth,
          value: depth,
          range: range
        )
        attributedString.addAttribute(
          .marcusBlockquoteIndent,
          value: offset,
          range: range
        )
      }

      offset += gutter

      // The room either side of a list marker is indent on the way in -- the
      // marker moves right with the text -- and held open with kerning on the
      // way out, which is the only thing that opens space after a character.
      let marker = prefix ?? markers[type]
      let padding =
        marker == nil
        ? 0 : MarkdownFormatter.markerPadding(for: type, style: style, display: display)

      offset += padding

      if let prefix {
        markers[type] = prefix
        if textStart == nil {
          textStart = offset
        }
      }

      if let marker {
        offset += MarkdownFormatter.placeMarker(
          marker,
          type: type,
          // Only on the line the marker is written on: a line continuing the
          // block reuses the one above, which has been drawn already.
          decorate: prefix != nil,
          in: attributedString,
          style: style,
          display: display,
          baseFontSize: baseFontSize
        )
        offset += padding

        if prefix != nil {
          MarkdownFormatter.pad(marker, by: padding, in: attributedString)
        }
      }

      padded = prefix
      MarkdownFormatter.setIndent(
        firstLine: textStart ?? offset,
        rest: offset,
        of: attributedString,
        range: range,
        defaultTextAttributes: defaultTextAttributes
      )
    }
  }

  // MARK: - Indents

  private static func baseIndent(
    of attributedString: NSAttributedString,
    at location: Int,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) -> CGFloat {
    paragraphStyle(
      of: attributedString,
      at: location,
      defaultTextAttributes: defaultTextAttributes
    ).headIndent
  }

  private static func setIndent(
    firstLine: CGFloat,
    rest: CGFloat,
    of attributedString: NSMutableAttributedString,
    range: NSRange,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) {
    let style = paragraphStyle(
      of: attributedString,
      at: range.location,
      defaultTextAttributes: defaultTextAttributes
    )
    style.firstLineHeadIndent = firstLine
    style.headIndent = rest

    attributedString.addAttribute(.paragraphStyle, value: style, range: range)
  }

  private static func paragraphStyle(
    of attributedString: NSAttributedString,
    at location: Int,
    defaultTextAttributes: [NSAttributedString.Key: Any]
  ) -> NSMutableParagraphStyle {
    let existing =
      attributedString.attribute(
        .paragraphStyle,
        at: location,
        effectiveRange: nil
      ) as? NSParagraphStyle
      ?? defaultTextAttributes[.paragraphStyle] as? NSParagraphStyle

    return (existing?.mutableCopy() as? NSMutableParagraphStyle)
      ?? NSMutableParagraphStyle()
  }

  // MARK: - Measurement

  /// Opens `width` of space after `range` without touching its glyphs, so a
  /// nested container's gutter can sit between one marker and the next.
  ///
  /// Added to whatever that character already holds: a marker padded in a
  /// display is the same character a nested container then pads again, and the
  /// second must not replace the first.
  private static func pad(
    _ range: NSRange,
    by width: CGFloat,
    in attributedString: NSMutableAttributedString
  ) {
    guard width > 0, range.length > 0 else { return }

    widen(NSMaxRange(range) - 1, by: width, in: attributedString)
  }

  /// Width `range` takes up mid-line, rounded up to a whole point.
  ///
  /// Rounding is what keeps a quote's ribbon in one piece. TextKit snaps every
  /// line's origin to the device pixel grid, so a line indented past a marker
  /// and a line indented past nothing land on different sides of a fractional
  /// width, and the bar drawn beside them breaks by a pixel. A whole point is a
  /// whole number of pixels at every screen scale, so there is nothing left to
  /// snap. Rounding up rather than down also keeps the gap from eating into the
  /// marker it was measured from.
  private static func measure(
    _ range: NSRange,
    in attributedString: NSAttributedString
  ) -> CGFloat {
    width(range, in: attributedString).rounded(.up)
  }

  /// The same width before it is rounded, for a caller adding to it: a marker
  /// that is part glyphs and part drawn shape rounds once, at the end, rather
  /// than once per part.
  ///
  /// A sentinel is appended and its width taken back off again because `size()`
  /// measures the range as a line of its own and drops trailing whitespace --
  /// which a list-item prefix always ends in.
  private static func width(
    _ range: NSRange,
    in attributedString: NSAttributedString
  ) -> CGFloat {
    let text = NSMutableAttributedString(
      attributedString: attributedString.attributedSubstring(from: range)
    )

    guard text.length > 0 else { return 0 }

    let full = NSRange(location: 0, length: text.length)
    // Indents belong to the paragraph, not to the run being measured, and the
    // padding opened after the marker is the next container's gutter rather
    // than part of the marker itself.
    text.removeAttribute(.paragraphStyle, range: full)
    text.removeAttribute(.kern, range: full)

    let sentinel = NSAttributedString(
      string: "|",
      attributes: text.attributes(at: text.length - 1, effectiveRange: nil)
    )
    text.append(sentinel)

    return text.size().width - sentinel.size().width
  }

  // MARK: - Baseline

  /// Re-centres text vertically within an explicit `lineHeight` after the fonts
  /// above have changed the natural line height.
  private static func applyBaselineOffset(
    to attributedText: NSMutableAttributedString,
    range: NSRange
  ) {
    var maximumLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(
      .paragraphStyle,
      in: range,
      options: .longestEffectiveRangeNotRequired
    ) { value, _, _ in
      guard let paragraphStyle = value as? NSParagraphStyle else { return }
      maximumLineHeight = max(
        paragraphStyle.maximumLineHeight,
        maximumLineHeight
      )
    }

    // `lineHeight` was not specified, nothing to do.
    guard maximumLineHeight != 0 else { return }

    var maximumFontLineHeight: CGFloat = 0
    attributedText.enumerateAttribute(
      .font,
      in: range,
      options: .longestEffectiveRangeNotRequired
    ) { value, _, _ in
      guard let font = value as? UIFont else { return }
      maximumFontLineHeight = max(font.lineHeight, maximumFontLineHeight)
    }

    guard maximumLineHeight >= maximumFontLineHeight else { return }

    let baselineOffset = (maximumLineHeight - maximumFontLineHeight) / 2.0
    attributedText.addAttribute(
      .baselineOffset,
      value: baselineOffset,
      range: range
    )
  }
}
