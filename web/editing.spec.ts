import { expect, test } from "@playwright/test"

import { INPUT, currentValue, failOnPageErrors, openText, renderModel } from "./helpers"

/**
 * The web builder patches only the lines that changed, so a rendering reached by
 * typing is produced by a different code path than the same text rendered from
 * scratch. Every spec that only ever loads finished text is blind to that path.
 *
 * The invariant here is that the two agree: whatever a sequence of keystrokes
 * leaves behind must be indistinguishable from loading the result directly.
 */

async function focusEnd(page: import("@playwright/test").Page) {
  await page.locator(INPUT).click()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ArrowRight")
}

/** The caret's offset in the input's text, or -1 if it is not inside it. */
async function caretOffset(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)
    const selection = window.getSelection()

    if (!root || !selection || selection.rangeCount === 0) {
      return -1
    }

    const range = selection.getRangeAt(0).cloneRange()
    range.selectNodeContents(root)
    range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset)

    return range.toString().length
  }, INPUT)
}

const SEQUENCES: { name: string; typed: string }[] = [
  { name: "emphasis", typed: "**bold**" },
  { name: "nested emphasis", typed: "**bold *and italic* here**" },
  { name: "inline code", typed: "some `code` here" },
  { name: "blockquote", typed: "> quoted" },
  { name: "list", typed: "- one" },
  { name: "mention", typed: "hey @someone" },
  { name: "link", typed: "[text](https://example.com)" },
]

test.describe("typing matches a fresh render", () => {
  for (const { name, typed } of SEQUENCES) {
    test(name, async ({ page }) => {
      const errors: string[] = []
      failOnPageErrors(page, errors)

      await openText(page, "")
      await page.locator(INPUT).click()
      await page.keyboard.type(typed)
      await expect(page.locator('[data-testid="harness-value"]')).toHaveText(typed)

      const afterTyping = await renderModel(page)

      await openText(page, typed)
      const fromScratch = await renderModel(page)

      expect(afterTyping).toBe(fromScratch)
      expect(errors).toEqual([])
    })
  }
})

test.describe("editing matches a fresh render", () => {
  test("deleting back into a construct", async ({ page }) => {
    // `**bold**` losing its closing pair has to give the whole span back as
    // plain text, which is a patch of a line that already had markup on it.
    await openText(page, "**bold**")
    await focusEnd(page)
    await page.keyboard.press("Backspace")
    await page.keyboard.press("Backspace")
    await expect(page.locator('[data-testid="harness-value"]')).toHaveText("**bold")

    const afterDeleting = await renderModel(page)

    await openText(page, "**bold")
    expect(afterDeleting).toBe(await renderModel(page))
  })

  test("completing a construct with one keystroke", async ({ page }) => {
    // The line goes from plain text to fully marked up on a single input event.
    await openText(page, "*italic")
    await focusEnd(page)
    await page.keyboard.type("*")
    await expect(page.locator('[data-testid="harness-value"]')).toHaveText("*italic*")

    const afterTyping = await renderModel(page)

    await openText(page, "*italic*")
    expect(afterTyping).toBe(await renderModel(page))
  })

  test("adding a line to a list", async ({ page }) => {
    await openText(page, "- one")
    await focusEnd(page)
    await page.keyboard.press("Enter")
    await page.keyboard.type("- two")
    await expect(page.locator('[data-testid="harness-value"]')).toHaveText("- one\n- two")

    const afterTyping = await renderModel(page)

    await openText(page, "- one\n- two")
    expect(afterTyping).toBe(await renderModel(page))
  })
})

test.describe("caret", () => {
  test("stays after the character just typed", async ({ page }) => {
    await openText(page, "")
    await page.locator(INPUT).click()
    await page.keyboard.type("**bold**")

    expect(await caretOffset(page)).toBe("**bold**".length)
  })

  test("stays put when typing in the middle of a line", async ({ page }) => {
    await openText(page, "ac")
    await page.locator(INPUT).click()
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.type("b")

    expect(await currentValue(page)).toBe("abc")
    expect(await caretOffset(page)).toBe(2)
  })
})
