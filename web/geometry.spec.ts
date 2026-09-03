import { expect, test } from "@playwright/test"

import { INPUT, openCase } from "./helpers"

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
