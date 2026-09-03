/**
 * The shared test corpus.
 *
 * Inputs only -- deliberately no expected output. Every layer on every platform
 * consumes this one list and keeps its own baseline: parser range snapshots
 * here in Jest, DOM snapshots in Playwright, span/attribute dumps in the
 * Android and iOS test targets, and the whole corpus again on device through
 * the Detox `/checks` route. Adding a case is a one-line edit that propagates
 * everywhere.
 *
 * `npm run fixtures` mirrors this file to `cases.json` for the native suites,
 * which cannot import TypeScript.
 */

type Tag =
  | "emphasis"
  | "heading"
  | "blockquote"
  | "list"
  | "nesting"
  | "code"
  | "link"
  | "mention"
  | "emoji"
  | "unicode"
  | "cjk"
  | "rtl"
  | "edge"

interface Case {
  /** Stable identifier. Used as the harness deep-link/query parameter and as
   *  the baseline filename, so treat renames as baseline churn. */
  id: string
  markdown: string
  tags: Tag[]
  /** Curated subset worth checking by eye: one case per thing that has to be
   *  drawn rather than merely styled -- gutters, list markers, backgrounds,
   *  glyph sizes. No suite reads this. Screenshot baselines cannot be portable
   *  between a dev machine and a CI runner, so there is no automated visual
   *  regression to feed and this stays a reading list. Keep it small. */
  visual?: boolean
  /** Why this case exists, when that is not obvious from the markdown. */
  note?: string
}

const CASES: Case[] = [
  // --- emphasis ---------------------------------------------------------
  { id: "bold", markdown: "**bold**", tags: ["emphasis"], visual: true },
  { id: "italic-star", markdown: "*italic*", tags: ["emphasis"] },
  { id: "italic-underscore", markdown: "_italic_", tags: ["emphasis"] },
  { id: "bold-underscore", markdown: "__bold__", tags: ["emphasis"] },
  {
    id: "bold-italic-underscore",
    markdown: "___both___",
    tags: ["emphasis", "nesting"],
    note: "Three underscores nest italic around bold rather than emitting one range.",
  },
  { id: "bold-underscore-mixed", markdown: "__bold__ and **bold**", tags: ["emphasis"] },
  {
    id: "bold-underscore-intraword",
    markdown: "snake__case__word",
    tags: ["emphasis", "edge"],
    note: "Underscores do not open emphasis inside a word; asterisks would.",
  },
  { id: "strikethrough", markdown: "~~struck~~", tags: ["emphasis"] },
  {
    id: "emphasis-nested",
    markdown: "**bold *and italic* here**",
    tags: ["emphasis", "nesting"],
    visual: true,
  },
  {
    id: "emphasis-adjacent-syntax",
    markdown: "~a~`code`",
    tags: ["emphasis", "code", "edge"],
    note: "Adjacent syntax in different enclosures must not merge into one range.",
  },
  { id: "emphasis-unterminated", markdown: "**not closed", tags: ["emphasis", "edge"] },
  { id: "emphasis-intraword", markdown: "snake_case_word", tags: ["emphasis", "edge"] },

  // --- headings ---------------------------------------------------------
  { id: "heading-h1", markdown: "# One", tags: ["heading"], visual: true },
  { id: "heading-h3", markdown: "### Three", tags: ["heading"] },
  { id: "heading-h6", markdown: "###### Six", tags: ["heading"] },
  { id: "heading-closed", markdown: "## Two ##", tags: ["heading", "edge"] },
  { id: "heading-setext", markdown: "Title\n=====\n", tags: ["heading", "edge"] },
  { id: "heading-with-emphasis", markdown: "# A **bold** title", tags: ["heading", "nesting"] },

  // --- blockquotes ------------------------------------------------------
  { id: "blockquote", markdown: "> quoted", tags: ["blockquote"], visual: true },
  { id: "blockquote-multiline", markdown: "> one\n> two", tags: ["blockquote"] },
  { id: "blockquote-lazy", markdown: "> one\ntwo", tags: ["blockquote", "edge"] },
  {
    id: "blockquote-nested",
    markdown: ">> deep",
    tags: ["blockquote", "nesting"],
    visual: true,
    note: "Two markers back to back on one line -- prefixes must stay separate ranges.",
  },
  { id: "blockquote-triple", markdown: ">>> deeper", tags: ["blockquote", "nesting"] },

  // --- lists ------------------------------------------------------------
  { id: "list-dash", markdown: "- one\n- two", tags: ["list"], visual: true },
  { id: "list-star", markdown: "* one\n* two", tags: ["list"] },
  { id: "list-plus", markdown: "+ one\n+ two", tags: ["list"] },
  { id: "list-ordered", markdown: "1. one\n2. two", tags: ["list"], visual: true },
  { id: "list-ordered-paren", markdown: "1) one\n2) two", tags: ["list"] },
  { id: "list-ordered-offset", markdown: "3. three\n4. four", tags: ["list", "edge"] },
  {
    id: "list-item-multiline",
    markdown: "- first line\n  second line",
    tags: ["list", "edge"],
    visual: true,
    note: "Continuation lines indent to the marker width, not to zero.",
  },
  { id: "list-nested", markdown: "- one\n  - two\n    - three", tags: ["list", "nesting"], visual: true },
  { id: "list-nested-mixed", markdown: "1. one\n   - two\n   - three", tags: ["list", "nesting"] },

  // --- container nesting ------------------------------------------------
  {
    id: "blockquote-in-list",
    markdown: "- > quoted in a list",
    tags: ["nesting", "list", "blockquote"],
    visual: true,
    note: "Regression: fixed in 3e83849.",
  },
  {
    id: "list-in-blockquote",
    markdown: "> - item in a quote",
    tags: ["nesting", "list", "blockquote"],
    visual: true,
    note: "Regression: fixed in 3e83849.",
  },
  {
    id: "nesting-deep-mixed",
    markdown: "> - > 1. deep\n",
    tags: ["nesting", "edge"],
    note: "Indents accumulate across container types.",
  },
  {
    id: "nesting-repeat-split",
    markdown: "> - > x",
    tags: ["nesting", "edge"],
    note:
      "Regression: blockquote opens twice with the list's marker between. Keying " +
      "marker ends by type took the last one, stretching the quote's prefix over " +
      "the `-` and leaving the list with no prefix at all.",
  },
  {
    id: "nesting-repeat-split-mirrored",
    markdown: "- > - x",
    tags: ["nesting", "edge"],
    note: "The same split, with the list as the type that opens twice.",
  },
  {
    id: "nesting-repeat-adjacent",
    markdown: ">> - x",
    tags: ["nesting", "edge"],
    note:
      "The contiguous counterpart, which must keep folding into one prefix. `>>` " +
      "is two markers but a single step over on the way to the content.",
  },

  // --- code -------------------------------------------------------------
  { id: "code-inline", markdown: "some `code` here", tags: ["code"], visual: true },
  { id: "code-inline-double", markdown: "a ``co`de`` b", tags: ["code", "edge"] },
  { id: "code-fenced", markdown: "```\nfenced\n```", tags: ["code"], visual: true },
  { id: "code-fenced-lang", markdown: "```ts\nconst a = 1\n```", tags: ["code"] },
  { id: "code-fenced-unterminated", markdown: "```\nno end", tags: ["code", "edge"] },
  { id: "code-indented", markdown: "    indented\n", tags: ["code", "edge"] },
  { id: "code-in-blockquote", markdown: "> ```\n> fenced\n> ```", tags: ["code", "nesting"] },

  // --- links and images -------------------------------------------------
  { id: "link-inline", markdown: "[text](https://example.com)", tags: ["link"], visual: true },
  { id: "link-title", markdown: '[text](https://example.com "Title")', tags: ["link"] },
  { id: "link-reference", markdown: "[text][ref]\n\n[ref]: https://example.com", tags: ["link"] },
  { id: "autolink-http", markdown: "https://example.com", tags: ["link"] },
  { id: "autolink-www", markdown: "www.example.com", tags: ["link"] },
  { id: "autolink-email", markdown: "user@example.com", tags: ["link", "mention", "edge"] },
  { id: "autolink-angle", markdown: "<https://example.com>", tags: ["link"] },
  { id: "image-inline", markdown: "![alt](https://example.com/a.png)", tags: ["link"] },

  // --- mentions ---------------------------------------------------------
  { id: "mention", markdown: "hey @someone", tags: ["mention"], visual: true },
  { id: "mention-hyphen", markdown: "@some-one here", tags: ["mention"] },
  { id: "mention-trailing-hyphen", markdown: "@someone- here", tags: ["mention", "edge"] },
  { id: "mention-in-bold", markdown: "**@someone**", tags: ["mention", "nesting"] },

  // --- emoji ------------------------------------------------------------
  { id: "emoji", markdown: "hello 😀 world", tags: ["emoji"], visual: true },
  {
    id: "emoji-in-bold",
    markdown: "**bold 😀 text**",
    tags: ["emoji", "emphasis"],
    note: "excludeEmoji() must split the bold range around the emoji.",
  },
  { id: "emoji-zwj-family", markdown: "👨‍👩‍👧‍👦 family", tags: ["emoji", "unicode"] },
  { id: "emoji-flag", markdown: "flag 🇱🇹 here", tags: ["emoji", "unicode"] },
  { id: "emoji-skin-tone", markdown: "wave 👋🏽 there", tags: ["emoji", "unicode"] },
  { id: "emoji-only", markdown: "😀", tags: ["emoji", "edge"] },

  // --- unicode ----------------------------------------------------------
  {
    id: "unicode-astral",
    markdown: "**𝕳𝖊𝖑𝖑𝖔**",
    tags: ["unicode", "emphasis"],
    note: "Surrogate pairs: UTF-16 offsets must survive the trip to Swift and Kotlin.",
  },
  { id: "unicode-astral-minimal", markdown: "**𝕳**", tags: ["unicode", "emphasis"] },
  {
    id: "unicode-astral-in-list",
    markdown: "- 𝕳𝖊𝖑𝖑𝖔",
    tags: ["unicode", "list"],
  },
  { id: "unicode-combining", markdown: "éclair *test*", tags: ["unicode"] },
  {
    id: "unicode-nfd",
    markdown: "cafe\u0301 and caf\u00e9",
    tags: ["unicode"],
    note: "Decomposed vs precomposed: same grapheme, different UTF-16 lengths.",
  },
  { id: "unicode-variation-selector", markdown: "❤\ufe0f **red**", tags: ["unicode", "emoji"] },
  { id: "unicode-keycap", markdown: "1\ufe0f\u20e3 keycap", tags: ["unicode", "emoji"] },
  {
    id: "unicode-tag-sequence",
    markdown: "🏴\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f flag",
    tags: ["unicode", "emoji"],
    note: "Tag sequence: seven code points, fourteen UTF-16 units, one grapheme.",
  },
  { id: "unicode-zwnj", markdown: "a\u200cb *test*", tags: ["unicode", "edge"] },
  { id: "unicode-nbsp", markdown: "a\u00a0b **bold**", tags: ["unicode", "edge"] },
  {
    id: "unicode-bom",
    markdown: "\ufeff# heading",
    tags: ["unicode", "edge"],
    note:
      "Regression: micromark's preprocessor strips a leading BOM, so every " +
      "offset it reported was one short of the caller's string.",
  },
  {
    id: "unicode-line-separator",
    markdown: "a\u2028b",
    tags: ["unicode", "edge"],
    note: "U+2028 is not a CommonMark line ending; it must not split the line.",
  },
  { id: "unicode-soft-hyphen", markdown: "soft\u00adhyphen **bold**", tags: ["unicode", "edge"] },

  // --- CJK --------------------------------------------------------------
  {
    id: "unicode-cjk",
    markdown: "**日本語のテキスト**",
    tags: ["cjk", "unicode", "emphasis"],
  },
  { id: "cjk-chinese", markdown: "**中文粗体**测试", tags: ["cjk", "emphasis"], visual: true },
  {
    id: "cjk-punctuation-after",
    markdown: "**粗体**。后面",
    tags: ["cjk", "emphasis", "edge"],
    note: "CJK full stop is Unicode punctuation, which changes delimiter flanking.",
  },
  { id: "cjk-punctuation-before", markdown: "。**粗体**", tags: ["cjk", "emphasis", "edge"] },
  { id: "cjk-korean", markdown: "**한국어 굵게** 텍스트", tags: ["cjk", "emphasis"] },
  { id: "cjk-kana", markdown: "*ひらがな* と **カタカナ**", tags: ["cjk", "emphasis"] },
  {
    id: "cjk-fullwidth-asterisk",
    markdown: "＊全角＊",
    tags: ["cjk", "edge"],
    note: "Fullwidth U+FF0A is not an emphasis delimiter.",
  },
  {
    id: "cjk-ideographic-space",
    markdown: "#　見出し",
    tags: ["cjk", "heading", "edge"],
    note: "U+3000 is not CommonMark whitespace, so this is not a heading.",
  },
  { id: "cjk-heading", markdown: "# 見出し", tags: ["cjk", "heading"] },
  { id: "cjk-list", markdown: "- 項目一\n- 項目二", tags: ["cjk", "list"], visual: true },
  { id: "cjk-blockquote", markdown: "> 引用文", tags: ["cjk", "blockquote"] },
  { id: "cjk-code", markdown: "`中文代码` here", tags: ["cjk", "code"] },
  { id: "cjk-link", markdown: "[中文链接](https://example.com/中文)", tags: ["cjk", "link"] },
  {
    id: "cjk-mention",
    markdown: "hey @用户名 there",
    tags: ["cjk", "mention"],
    note: "The mention extension matches \\p{L}, which includes Han.",
  },
  {
    id: "cjk-combining-dakuten",
    markdown: "か\u3099 vs が",
    tags: ["cjk", "unicode", "edge"],
    note: "Combining dakuten vs the precomposed character.",
  },

  // --- RTL --------------------------------------------------------------
  {
    id: "unicode-rtl",
    markdown: "**مرحبا** world",
    tags: ["rtl", "unicode", "emphasis"],
    visual: true,
  },
  {
    id: "rtl-arabic",
    markdown: "**مرحبا بالعالم**",
    tags: ["rtl", "emphasis"],
    visual: true,
    note: "Bidi puts the closing ** on the visual left; layout follows logical offsets.",
  },
  { id: "rtl-hebrew", markdown: "**שלום עולם**", tags: ["rtl", "emphasis"] },
  { id: "rtl-hebrew-niqqud", markdown: "שָׁלוֹם *test*", tags: ["rtl", "unicode"] },
  {
    id: "rtl-mixed",
    markdown: "مرحبا **hello** عالم",
    tags: ["rtl", "emphasis"],
    visual: true,
  },
  {
    id: "rtl-list",
    markdown: "- عنصر أول\n- عنصر ثاني",
    tags: ["rtl", "list"],
    visual: true,
  },
  { id: "rtl-blockquote", markdown: "> اقتباس", tags: ["rtl", "blockquote"], visual: true },
  { id: "rtl-heading", markdown: "# عنوان", tags: ["rtl", "heading"] },
  { id: "rtl-link", markdown: "[نص عربي](https://example.com)", tags: ["rtl", "link"] },
  { id: "rtl-code", markdown: "`عربي` code", tags: ["rtl", "code"] },
  {
    id: "rtl-arabic-indic-digits",
    markdown: "١. عنصر",
    tags: ["rtl", "list", "edge"],
    note: "Arabic-Indic digits do not start an ordered list; only ASCII digits do.",
  },
  {
    id: "rtl-marks",
    markdown: "\u200fمرحبا\u200e **bold**",
    tags: ["rtl", "edge"],
    note: "RLM/LRM are zero-width but still occupy offsets.",
  },
  {
    id: "rtl-isolates",
    markdown: "\u2066LTR\u2069 عربي **bold**",
    tags: ["rtl", "edge"],
    note: "LRI/PDI isolates around an embedded LTR run.",
  },
  { id: "rtl-lam-alef", markdown: "لا **bold** نص", tags: ["rtl", "unicode"] },
  { id: "rtl-punctuation", markdown: "**عربي**، نص", tags: ["rtl", "emphasis", "edge"] },
  { id: "rtl-mention", markdown: "@مستخدم نص", tags: ["rtl", "mention"] },

  // --- edge cases -------------------------------------------------------
  { id: "empty", markdown: "", tags: ["edge"] },
  { id: "whitespace-only", markdown: "   \n  \n", tags: ["edge"] },
  { id: "plain-text", markdown: "no markdown here", tags: ["edge"] },
  { id: "crlf", markdown: "# One\r\n\r\n> two\r\n", tags: ["edge"], note: "CRLF line endings." },
  { id: "tabs", markdown: "-\tone\n-\ttwo", tags: ["edge", "list"] },
  { id: "escaped-emphasis", markdown: "\\*not bold\\*", tags: ["edge", "emphasis"] },
  { id: "hard-break", markdown: "one  \ntwo", tags: ["edge"] },
  { id: "thematic-break", markdown: "one\n\n---\n\ntwo", tags: ["edge"] },
  { id: "character-reference", markdown: "&amp; and &#38;", tags: ["edge"] },
  {
    id: "kitchen-sink",
    markdown:
      "# Heading\n\nSome **bold**, *italic* and ~~struck~~ text with `code`.\n\n" +
      "> A quote with a [link](https://example.com)\n\n" +
      "- item one\n- item two\n  1. nested\n\n" +
      "```ts\nconst a = 1\n```\n\nHey @someone 😀\n",
    tags: ["edge", "nesting"],
    visual: true,
  },
]

export type { Case, Tag }
export { CASES }
