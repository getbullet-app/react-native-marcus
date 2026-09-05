import { expect, test } from "@playwright/test"

import { DISPLAY, INPUT, openCase, openDisplayText, openText } from "./helpers"

/**
 * The measured half of the layout, asserted by how the numbers relate rather
 * than by their values.
 *
 * The exact arithmetic is pinned in `blockLayout.test.ts`, which injects a stub
 * measurer and so can name every number. What that cannot check is whether the
 * browser puts the result where it belongs, and those widths depend on the
 * font the runner happens to resolve -- so nothing here compares an absolute.
 */

type LineLayout = { paddingLeft: number; textIndent: number; ribbons: number[] }

async function lineLayouts(page: import("@playwright/test").Page): Promise<LineLayout[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)

    if (!root) {
      return []
    }

    return Array.from(root.querySelectorAll('[data-type="line"]')).map((node) => {
      const style = (node as HTMLElement).style
      const positions = style.backgroundPositionX

      return {
        paddingLeft: parseFloat(style.paddingLeft) || 0,
        textIndent: parseFloat(style.textIndent) || 0,
        ribbons: positions
          ? positions
              .split(",")
              .map((value) => parseFloat(value))
              .filter((value) => Number.isFinite(value))
          : [],
      }
    })
  }, INPUT)
}

test("a quote reserves a gutter and draws one ribbon", async ({ page }) => {
  await openCase(page, "blockquote")
  const [line] = await lineLayouts(page)

  expect(line!.ribbons).toHaveLength(1)
  expect(line!.paddingLeft).toBeGreaterThan(0)
})

test("each quote level adds a ribbon further right", async ({ page }) => {
  await openCase(page, "blockquote-nested")
  const [line] = await lineLayouts(page)

  expect(line!.ribbons).toHaveLength(2)
  expect(line!.ribbons[1]).toBeGreaterThan(line!.ribbons[0]!)
})

test("a list reserves a gutter without a ribbon", async ({ page }) => {
  await openCase(page, "list-dash")
  const [line] = await lineLayouts(page)

  expect(line!.ribbons).toEqual([])
  expect(line!.paddingLeft).toBeGreaterThan(0)
})

test("each nesting level indents further than the one outside it", async ({ page }) => {
  await openCase(page, "list-nested")
  const lines = await lineLayouts(page)

  expect(lines).toHaveLength(3)
  expect(lines[1]!.paddingLeft).toBeGreaterThan(lines[0]!.paddingLeft)
  expect(lines[2]!.paddingLeft).toBeGreaterThan(lines[1]!.paddingLeft)
})

test("a continuation line keeps the indent of the line that opened it", async ({ page }) => {
  // Without this the wrapped line sits a marker's width to the left and the
  // block visibly splits in two.
  await openCase(page, "list-item-multiline")
  const lines = await lineLayouts(page)

  expect(lines.length).toBeGreaterThan(1)
  expect(lines[1]!.paddingLeft).toBeCloseTo(lines[0]!.paddingLeft, 1)
})

test("a quote inside a list sits to the right of a bare quote", async ({ page }) => {
  await openCase(page, "blockquote")
  const [bare] = await lineLayouts(page)

  await openCase(page, "blockquote-in-list")
  const [nested] = await lineLayouts(page)

  // The list reserves its gutter and its bullet is stepped over before the
  // quote gets anywhere to put its bar.
  expect(nested!.ribbons[0]).toBeGreaterThan(bare!.ribbons[0]!)
})

test("the marker hangs into the gutter", async ({ page }) => {
  // firstLineIndent lands where the marker starts; the negative text-indent is
  // what pulls it back out of the padding the wrapped lines sit behind.
  await openCase(page, "list-dash")
  const [line] = await lineLayouts(page)

  expect(line!.textIndent).toBeLessThan(0)
  expect(Math.abs(line!.textIndent)).toBeLessThan(line!.paddingLeft)
})

test("a code block is a box across the line, with the code inside its padding", async ({
  page,
}) => {
  // The shape both native formatters draw: one fill from the first line to the
  // last, the width of the text rather than of the longest line, and the code
  // held off its edges. Here it is one element, so the box is the element.
  await openText(page, "```\ncode\n```")

  const box = await page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement
    const block = root.querySelector('[data-type="codeblock"]') as HTMLElement
    const code = root.querySelector('[data-type="pre"]') as HTMLElement
    const line = block.closest("p") as HTMLElement

    return {
      block: block.getBoundingClientRect(),
      code: code.getBoundingClientRect(),
      line: line.getBoundingClientRect(),
      padding: parseFloat(getComputedStyle(block).paddingTop),
      margin: parseFloat(getComputedStyle(block).marginTop),
    }
  }, INPUT)

  expect(box.padding).toBeGreaterThan(0)
  expect(box.margin).toBeGreaterThan(0)

  // Across the line, less the margin on either side.
  expect(box.block.width).toBeCloseTo(box.line.width - 2 * box.margin, 0)
  // And the code sits inside it, not against it.
  expect(box.code.left - box.block.left).toBeGreaterThanOrEqual(box.padding)
  expect(box.code.top - box.block.top).toBeGreaterThanOrEqual(box.padding)
})

test("a code block opens on its first line of code", async ({ page }) => {
  // Stripping the fence leaves the break that ended it, and a box drawn around
  // that starts one blank line above the code.
  await openDisplayText(page, "before\n\n```\ncode\n```")

  const height = await page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement
    const block = root.querySelector('[data-type="codeblock"]') as HTMLElement
    const code = root.querySelector('[data-type="pre"]') as HTMLElement

    return {
      block: block.getBoundingClientRect().height,
      code: code.getBoundingClientRect().height,
      padding: parseFloat(getComputedStyle(block).paddingTop),
      font: parseFloat(getComputedStyle(code).fontSize),
    }
  }, DISPLAY)

  // Room for the code and the padding, and not for a line more.
  expect(height.block - height.code - 2 * height.padding).toBeLessThan(height.font)
})

test("an inline run of code is a box with room around it", async ({ page }) => {
  // The chip both platforms draw by hand: the padding sits between the glyphs
  // and the box, the margin between the box and the words either side of it,
  // and the corners are rounded.
  await openText(page, "before `code` after")

  const chip = await page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement
    const code = root.querySelector('[data-type="code"]') as HTMLElement
    const text = code.querySelector('[data-type="text"]') as HTMLElement
    const style = getComputedStyle(code)

    return {
      box: code.getBoundingClientRect(),
      text: text.getBoundingClientRect(),
      padding: parseFloat(style.paddingLeft),
      margin: parseFloat(style.marginLeft),
      radius: parseFloat(style.borderTopLeftRadius),
    }
  }, INPUT)

  expect(chip.padding).toBeGreaterThan(0)
  expect(chip.margin).toBeGreaterThan(0)
  expect(chip.radius).toBeGreaterThan(0)

  // The box is the text plus its padding, on both sides.
  expect(chip.box.width).toBeCloseTo(chip.text.width + 2 * chip.padding, 0)
  expect(chip.text.left - chip.box.left).toBeCloseTo(chip.padding, 0)
})

/** The marker of the first list item, as it was drawn. */
async function marker(page: import("@playwright/test").Page, root: string) {
  return page.evaluate((selector) => {
    const host = document.querySelector(selector) as HTMLElement
    const line = host.querySelector('[data-type="line"]') as HTMLElement
    const element = host.querySelector(
      '[data-type="block-prefix"] [data-type="syntax"]',
    ) as HTMLElement

    if (!element) {
      return null
    }

    const style = getComputedStyle(element)

    return {
      box: element.getBoundingClientRect(),
      line: line.getBoundingClientRect(),
      background: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      fontSize: parseFloat(style.fontSize),
      baseFontSize: parseFloat(getComputedStyle(host).fontSize),
    }
  }, root)
}

test("a display draws a bullet where an unordered marker was written", async ({ page }) => {
  await openDisplayText(page, "- one")

  const bullet = (await marker(page, DISPLAY))!
  // Sized from the base font rather than from the glyph it replaced.
  const diameter = bullet.baseFontSize * 0.3

  expect(bullet.background).toContain("radial-gradient")
  expect(bullet.backgroundSize).toBe(`${diameter}px ${diameter}px`)
  expect(bullet.box.width).toBeCloseTo(diameter, 1)

  // Centred on the line rather than sat on its baseline, which is where both native platforms
  // draw it: the box is the line's own height, so the circle painted in the middle of it is in
  // the middle of the line.
  expect(bullet.box.top).toBeCloseTo(bullet.line.top, 0)
  expect(bullet.box.height).toBeCloseTo(bullet.line.height, 0)
})

test("a display draws an ordered marker smaller than the text it numbers", async ({ page }) => {
  await openDisplayText(page, "1. one")

  const number = (await marker(page, DISPLAY))!

  expect(number.fontSize).toBeCloseTo(number.baseFontSize * 0.8, 1)
  // Still a number rather than a shape.
  expect(number.background).toBe("none")
})

test("an input shows the marker it was typed with", async ({ page }) => {
  await openText(page, "- one")

  const dash = (await marker(page, INPUT))!

  expect(dash.background).toBe("none")
  expect(dash.fontSize).toBeCloseTo(dash.baseFontSize, 1)
})
