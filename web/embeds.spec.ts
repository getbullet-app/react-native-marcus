import { expect, test } from "@playwright/test"

import { DISPLAY, failOnPageErrors, openDisplayCase, renderModel } from "./helpers"

/**
 * `MarkdownText` with a `renderEmbed`, where an image becomes a view rather than its alt text.
 *
 * The web gets there differently from the platforms: everything under the host is raw DOM the
 * component built, so the embed cannot simply be a child -- it is portalled into a slot that
 * replaced the placeholder character. What these assert is that the slot lands in the right
 * place in the built markup, which is the half that could drift.
 */
const CASES = [
  "image-inline",
  "image-in-text",
  "image-in-blockquote",
  "image-title",
  "image-alt-markup",
]

test.describe("embeds", () => {
  for (const id of CASES) {
    test(id, async ({ page }) => {
      const errors: string[] = []
      failOnPageErrors(page, errors)

      await openDisplayCase(page, id, { embeds: true })
      await page.waitForSelector('[data-testid="harness-embed"]')

      expect(await renderModel(page, DISPLAY)).toMatchSnapshot(`${id}.txt`)
      expect(errors).toEqual([])
    })
  }

  test("the alt text is gone once something renders in its place", async ({ page }) => {
    await openDisplayCase(page, "image-in-text", { embeds: true })
    await page.waitForSelector('[data-testid="harness-embed"]')

    // The placeholder character goes with it: it only ever meant "an embed stood here".
    // `textContent` rather than `innerText`, which would report the line breaks the browser
    // puts around a block-level embed.
    expect(await page.locator(DISPLAY).textContent()).toBe("an  inline")
  })

  test("tells the renderer whether the image shares its line", async ({ page }) => {
    // The harness writes what it was handed into the embed's label, since none
    // of it is otherwise visible in the markup the component builds.
    const embed = page.locator('[data-testid="harness-embed"]')

    await openDisplayCase(page, "image-in-text", { embeds: true })
    await expect(embed).toHaveAttribute("aria-label", "icon inline")

    await openDisplayCase(page, "image-in-blockquote", { embeds: true })
    await expect(embed).toHaveAttribute("aria-label", "alt block")
  })

  test("without a renderer the alt text is the prose", async ({ page }) => {
    await openDisplayCase(page, "image-in-text")

    expect(await page.locator(DISPLAY).textContent()).toBe("an icon inline")
    expect(await page.locator('[data-testid="harness-embed"]').count()).toBe(0)
  })
})
