import { stripSyntax } from "../stripUtils"
import { CASES } from "../__fixtures__/cases"
import { formatRanges, parse } from "./helpers/parse"

function strip(markdown: string) {
  return stripSyntax(markdown, parse(markdown))
}

describe("stripSyntax", () => {
  it("removes inline markers", () => {
    expect(strip("**bold** and _italic_").text).toBe("bold and italic")
    expect(strip("~~gone~~").text).toBe("gone")
    expect(strip("a `snippet` here").text).toBe("a snippet here")
  })

  it("removes a heading marker and the space after it", () => {
    expect(strip("# Title").text).toBe("Title")
    expect(strip("### Deeper").text).toBe("Deeper")
  })

  it("removes a setext underline and the break in front of it", () => {
    expect(strip("Title\n=====").text).toBe("Title")
    expect(strip("Title\n-----\n\nBody").text).toBe("Title\n\nBody")
  })

  it("removes a blockquote marker but keeps list markers", () => {
    expect(strip("> quoted").text).toBe("quoted")
    expect(strip("- item").text).toBe("- item")
    expect(strip("1. item").text).toBe("1. item")
    expect(strip("> - item").text).toBe("- item")
  })

  it("starts a code block at the code, not at the break the fence left behind", () => {
    // The fence is a line of its own, so cutting it leaves the break that ended
    // it in front of the block. Whatever draws the block as a box would open
    // that box on the line above the first line of code.
    const stripped = strip("before\n\n```js\nconst a = 1\n```\n\nafter")
    const block = stripped.ranges.find((range) => range.type === "codeblock")

    expect(block).toBeDefined()
    expect(stripped.text.slice(block!.start, block!.start + block!.length)).toBe("const a = 1")
  })

  it("leaves text with no syntax untouched", () => {
    const markdown = "just some words"
    const stripped = strip(markdown)

    expect(stripped.text).toBe(markdown)
    expect(stripped.ranges).toEqual(parse(markdown))
  })

  it("keeps ranges pointing at the same text they covered", () => {
    const markdown = "a **bold _nested_** tail"
    const { text, ranges } = strip(markdown)

    const bold = ranges.find((range) => range.type === "bold")!
    const italic = ranges.find((range) => range.type === "italic")!

    expect(text.slice(bold.start, bold.start + bold.length)).toBe("bold nested")
    expect(text.slice(italic.start, italic.start + italic.length)).toBe("nested")
  })

  it("drops ranges that covered nothing but syntax", () => {
    const { ranges } = strip("**bold**")

    expect(ranges.some((range) => range.type === "syntax")).toBe(false)
  })

  it("keeps a block-prefix immediately before its container", () => {
    // The pairing the native formatters walk. Stripping may empty a prefix --
    // a quote loses its `>` entirely -- but must never separate a surviving
    // one from the container that follows it.
    const { ranges } = strip("> - item\n> - other")

    ranges.forEach((range, index) => {
      if (range.type !== "block-prefix") {
        return
      }

      const container = ranges[index + 1]
      expect(container).toBeDefined()
      expect(["blockquote", "list-ordered", "list-unordered"]).toContain(container!.type)
    })
  })

  it("keeps every range inside the stripped text", () => {
    CASES.forEach(({ markdown }) => {
      const { text, ranges } = strip(markdown)

      ranges.forEach((range) => {
        expect(range.start).toBeGreaterThanOrEqual(0)
        expect(range.length).toBeGreaterThan(0)
        expect(range.start + range.length).toBeLessThanOrEqual(text.length)
      })
    })
  })

  it("never grows the text", () => {
    CASES.forEach(({ markdown }) => {
      expect(strip(markdown).text.length).toBeLessThanOrEqual(markdown.length)
    })
  })

  it("is idempotent over the corpus", () => {
    // Stripping twice should be stripping once: the second pass parses prose
    // that no longer has syntax in it, so anything it still finds is something
    // the first pass created by removing the characters around it. That is what
    // caught a quote marker surviving inside `- > 1. `, which reads as a list
    // again on the way back through.
    //
    // Escapes are the one place where it genuinely cannot hold -- removing the
    // backslash from `\*not bold\*` leaves emphasis behind by definition -- so
    // they are the exception rather than a relaxed assertion.
    CASES.forEach(({ markdown }) => {
      if (markdown.includes("\\")) {
        return
      }

      const once = strip(markdown)
      expect(stripSyntax(once.text, parse(once.text)).text).toBe(once.text)
    })
  })
})

describe("embeds", () => {
  function stripEmbeds(markdown: string) {
    return stripSyntax(markdown, parse(markdown), { embeds: true })
  }

  it("is off by default, and an image is its alt text", () => {
    expect(strip("![alt](https://example.com/a.png)").text).toBe("alt")
    expect(strip("![alt](https://example.com/a.png)").embeds).toEqual([])
  })

  it("replaces an image with one character", () => {
    const stripped = stripEmbeds("![alt](https://example.com/a.png)")

    expect(stripped.text).toBe("￼")
    expect(stripped.embeds).toEqual([
      { index: 0, uri: "https://example.com/a.png", alt: "alt", title: "", inline: false },
    ])
  })

  it("reports the title when there is one", () => {
    expect(stripEmbeds('![alt](https://example.com/a.png "Title")').embeds).toEqual([
      { index: 0, uri: "https://example.com/a.png", alt: "alt", title: "Title", inline: false },
    ])
  })

  it("keeps the prose around an inline image", () => {
    const stripped = stripEmbeds("an ![icon](i.png) inline")

    expect(stripped.text).toBe("an ￼ inline")
    expect(stripped.embeds).toEqual([
      { index: 3, uri: "i.png", alt: "icon", title: "", inline: true },
    ])
  })

  it("indexes each image in the stripped text, not the original", () => {
    const stripped = stripEmbeds("**bold** ![a](1.png) and ![b](2.png)")

    expect(stripped.text).toBe("bold ￼ and ￼")
    expect(stripped.embeds.map((embed) => embed.index)).toEqual([5, 11])
    expect(stripped.embeds.map((embed) => embed.uri)).toEqual(["1.png", "2.png"])
  })

  it("leaves the ranges around an embed indexing the right characters", () => {
    const stripped = stripEmbeds("_before_ ![a](1.png) **after**")

    expect(stripped.text).toBe("before ￼ after")

    const italic = stripped.ranges.find((range) => range.type === "italic")
    const bold = stripped.ranges.find((range) => range.type === "bold")

    expect(stripped.text.slice(italic!.start, italic!.start + italic!.length)).toBe("before")
    expect(stripped.text.slice(bold!.start, bold!.start + bold!.length)).toBe("after")
  })

  it("keeps a block container covering the placeholder", () => {
    const stripped = stripEmbeds("> ![a](1.png)")

    expect(stripped.text).toBe("￼")

    const quote = stripped.ranges.find((range) => range.type === "blockquote")

    expect(quote).toMatchObject({ start: 0, length: 1, depth: 1 })
  })

  it("collapses the image's own range onto the placeholder", () => {
    const image = stripEmbeds("![alt](1.png)").ranges.filter(
      (range) => range.type === "inline-image",
    )

    expect(image).toEqual([{ type: "inline-image", start: 0, length: 1 }])
  })

  it("does not report an image nested inside another one", () => {
    // The parser does not emit one: inside a label an image is just the
    // characters it is written with.
    const stripped = stripEmbeds("![a ![b](inner.png)](outer.png)")

    expect(stripped.text).toBe("￼")
    expect(stripped.embeds).toEqual([
      { index: 0, uri: "outer.png", alt: "a b", title: "", inline: false },
    ])
  })

  it("takes its own destination rather than a nested link's", () => {
    // micromark reports the nested link and its destination; the parser drops
    // both, so the only `link` range left in the span is the image's own.
    expect(stripEmbeds("![a [b](nested.png) c](image.png)").embeds).toEqual([
      { index: 0, uri: "image.png", alt: "a b c", title: "", inline: false },
    ])
  })

  it("keeps an emoji in alt text drawable when nothing renders the image", () => {
    // Without a renderer the alt text is the prose, and an emoji in it has to
    // keep the range that gives it the emoji font.
    const { text, ranges } = strip("![party 🎉 time](a.png)")

    expect(text).toBe("party 🎉 time")

    const emoji = ranges.find((range) => range.type === "emoji")!

    expect(text.slice(emoji.start, emoji.start + emoji.length)).toBe("🎉")
  })

  it("flattens the markup in a label the way CommonMark's alt attribute does", () => {
    expect(stripEmbeds("![**bold** and _italic_](x.png)").embeds[0]!.alt).toBe(
      "bold and italic",
    )
    expect(stripEmbeds("![`code` alt](x.png)").embeds[0]!.alt).toBe("code alt")
    expect(stripEmbeds("![~~gone~~](x.png)").embeds[0]!.alt).toBe("gone")
  })

  it("is not inline when the image has its line to itself", () => {
    const alone = (markdown: string) => stripEmbeds(markdown).embeds[0]!.inline

    expect(alone("![a](x.png)")).toBe(false)
    expect(alone("text\n\n![a](x.png)")).toBe(false)
    // A marker is not company: the image is still the only thing on the line,
    // whether or not the marker was kept to be laid out.
    expect(alone("> ![a](x.png)")).toBe(false)
    expect(alone("- ![a](x.png)")).toBe(false)
    expect(alone("[![a](x.png)](https://example.com)")).toBe(false)
  })

  it("is inline when anything else shares the line", () => {
    const inline = (markdown: string) => stripEmbeds(markdown).embeds.map((e) => e.inline)

    expect(inline("an ![a](x.png) here")).toEqual([true])
    expect(inline("- ![a](x.png) in a list item")).toEqual([true])
    // Another image counts, so a row of them is a row of badges.
    expect(inline("![a](x.png) ![b](y.png)")).toEqual([true, true])
    // Two lines of one image each are two figures.
    expect(inline("![a](x.png)\n![b](y.png)")).toEqual([false, false])
  })

  it("leaves a link's own label and destination alone", () => {
    const stripped = stripEmbeds("[text](https://example.com)")

    expect(stripped.text).toBe("text")
    expect(stripped.embeds).toEqual([])
  })
})

describe("links", () => {
  function stripLinks(markdown: string) {
    return stripSyntax(markdown, parse(markdown), { links: true })
  }

  it("is off by default", () => {
    expect(strip("[text](https://example.com)").links).toEqual([])
  })

  it("reports where a link ended up and where it points", () => {
    const stripped = stripLinks("an [example](https://example.com) link")

    expect(stripped.text).toBe("an example link")
    expect(stripped.links).toEqual([
      { start: 3, length: 7, uri: "https://example.com", label: "example", title: "" },
    ])
  })

  it("reports the title when there is one", () => {
    expect(stripLinks('[text](https://example.com "Title")').links).toEqual([
      { start: 0, length: 4, uri: "https://example.com", label: "text", title: "Title" },
    ])
  })

  it("indexes the label as it stands after stripping", () => {
    const stripped = stripLinks("> a [**bold** link](u) and [two](v)")

    expect(stripped.text).toBe("a bold link and two")
    stripped.links.forEach((link) => {
      expect(stripped.text.slice(link.start, link.start + link.length)).toBe(link.label)
    })
    expect(stripped.links.map((link) => link.label)).toEqual(["bold link", "two"])
  })

  it("treats an autolink as its own label", () => {
    // Nothing is cut from a bare URL -- it is a link with no syntax at all --
    // so this is also the one that goes through the untouched-text path.
    expect(stripLinks("https://example.com").links).toEqual([
      {
        start: 0,
        length: 19,
        uri: "https://example.com",
        label: "https://example.com",
        title: "",
      },
    ])
    expect(stripLinks("<https://example.com>").links).toEqual([
      {
        start: 0,
        length: 19,
        uri: "https://example.com",
        label: "https://example.com",
        title: "",
      },
    ])
    expect(stripLinks("user@example.com").links).toEqual([
      { start: 0, length: 16, uri: "user@example.com", label: "user@example.com", title: "" },
    ])
  })

  it("leaves a reference link inert and takes the definition at face value", () => {
    // The label of `[text][ref]` is styled as a link but has no destination
    // here to press it to. The definition's own URL is written plainly, shown
    // as written, and treated as what it looks like.
    const stripped = stripLinks("[text][ref]\n\n[ref]: https://example.com")

    expect(stripped.links).toEqual([
      {
        start: 13,
        length: 19,
        uri: "https://example.com",
        label: "https://example.com",
        title: "",
      },
    ])
  })

  it("reports one link where a label holds another", () => {
    // A link cannot hold another, but micromark reports what it finds in a
    // label anyway. Only the label survives the strip, and reporting both would
    // have the caller splice the same run of text in twice.
    const stripped = stripLinks("[see <https://x.com>](y)")

    expect(stripped.text).toBe("see https://x.com")
    expect(stripped.links).toEqual([
      { start: 0, length: 17, uri: "y", label: "see https://x.com", title: "" },
    ])
  })

  it("takes a URL written as a label at face value", () => {
    // The label is prose -- an autolink does not fire inside one -- so all this
    // has to do is not mistake it for a destination.
    const stripped = stripLinks("[http://google.com](http://example.com)")

    expect(stripped.text).toBe("http://google.com")
    expect(stripped.ranges).toEqual([{ type: "link", start: 0, length: 17 }])
    expect(stripped.links).toEqual([
      {
        start: 0,
        length: 17,
        uri: "http://example.com",
        label: "http://google.com",
        title: "",
      },
    ])
  })

  it("makes an autolink in a label part of the label", () => {
    // Written this way micromark does report the autolink, and the parser drops
    // it: a link inside a link is text. What is left is one link over the URL,
    // pointing somewhere else entirely.
    const stripped = stripLinks("[<https://x.com>](https://example.com)")

    expect(stripped.text).toBe("https://x.com")
    expect(stripped.ranges).toEqual([{ type: "link", start: 0, length: 13 }])
    expect(stripped.links).toEqual([
      { start: 0, length: 13, uri: "https://example.com", label: "https://x.com", title: "" },
    ])
  })

  it("keeps the markup a label is written with", () => {
    const { ranges } = stripLinks("[**b** `c` @user](https://example.com)")

    expect(ranges.map((range) => range.type)).toEqual(["link", "bold", "code", "mention"])
  })

  it("renders an image inside a label and still presses the link", () => {
    const markdown = "[a ![alt](i.png) b](https://example.com)"
    const stripped = stripSyntax(markdown, parse(markdown), { links: true, embeds: true })

    expect(stripped.text).toBe("a \uFFFC b")
    expect(stripped.embeds).toEqual([
      { index: 2, uri: "i.png", alt: "alt", title: "", inline: true },
    ])
    expect(stripped.links).toEqual([
      { start: 0, length: 5, uri: "https://example.com", label: "a \uFFFC b", title: "" },
    ])
  })

  it("does not report an image, which has no label to press", () => {
    expect(stripLinks("![alt](a.png)").links).toEqual([])
  })

  it("takes the outer destination for an image inside a link", () => {
    const stripped = stripSyntax(
      "[![alt](i.png)](https://example.com)",
      parse("[![alt](i.png)](https://example.com)"),
      { links: true, embeds: true },
    )

    // The whole link is the embed, so the label is the placeholder character.
    expect(stripped.text).toBe("\uFFFC")
    expect(stripped.links).toEqual([
      { start: 0, length: 1, uri: "https://example.com", label: "\uFFFC", title: "" },
    ])
    expect(stripped.embeds).toEqual([
      { index: 0, uri: "i.png", alt: "alt", title: "", inline: false },
    ])

    // The label reaches over the image rather than sitting inside it, so it
    // survives the image being swallowed and comes out over the placeholder --
    // which is what leaves the web something to catch a press on.
    expect(stripped.ranges).toEqual([
      { type: "link", start: 0, length: 1 },
      { type: "inline-image", start: 0, length: 1 },
    ])
  })

  it("keeps a link's label out of the ranges it reports", () => {
    // A link that lost its brackets is styled through the ranges the way one
    // nobody can press is; nothing about being pressable is in there.
    const stripped = stripLinks("[text](https://example.com)")

    expect(stripped.ranges).toEqual([{ type: "link", start: 0, length: 4 }])
  })
})

describe("stripped corpus", () => {
  CASES.forEach(({ id, markdown }) => {
    it(id, () => {
      const { text, ranges } = strip(markdown)

      expect(`${JSON.stringify(text)}\n\n${formatRanges(text, ranges)}`).toMatchSnapshot()
    })
  })
})
