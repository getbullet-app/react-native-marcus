import { expect, test } from "@playwright/test"

import { DISPLAY, failOnPageErrors, openDisplayCase, openDisplayText } from "./helpers"

/**
 * `MarkdownText` with an `onLinkPress`, where the destination is gone from the text but pressing
 * what is left of the link still reports it.
 *
 * The web gets there differently from the platforms, which wrap a link's label in a nested `Text`:
 * everything under the host is raw DOM the component built, so the press is caught on the host and
 * walked back up to the nearest element the builder marked. What these assert is that the mark
 * lands on the right elements and that the walk finds it -- through emphasis, through a portalled
 * embed, and not at all on a link nothing can resolve.
 */

/** What the harness records of the last press, as `#count uri | label | title`. */
const PRESSED = '[data-testid="harness-link"]'

test.describe("links", () => {
  test("reports the destination the text no longer carries", async ({ page }) => {
    const errors: string[] = []
    failOnPageErrors(page, errors)

    await openDisplayCase(page, "link-inline", { links: true })

    expect(await page.locator(DISPLAY).textContent()).toBe("text")

    await page.locator(`${DISPLAY} [data-link]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe("#1 https://example.com | text")
    expect(errors).toEqual([])
  })

  test("passes the title along with it", async ({ page }) => {
    await openDisplayCase(page, "link-title", { links: true })
    await page.locator(`${DISPLAY} [data-link]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe(
      "#1 https://example.com | text | Title",
    )
  })

  test("is reachable by keyboard", async ({ page }) => {
    await openDisplayCase(page, "link-inline", { links: true })

    const link = page.locator(`${DISPLAY} [data-link]`)

    // An anchor is in the tab order on its own, without a role or a tabindex.
    await expect(link).toHaveJSProperty("tagName", "A")

    await link.focus()
    await page.keyboard.press("Enter")

    expect(await page.locator(PRESSED).textContent()).toBe("#1 https://example.com | text")
  })

  test("finds the link from whatever inside it was pressed", async ({ page }) => {
    // The label is `**bold** link`, so the press lands on the emphasis nested in the link.
    await openDisplayCase(page, "link-markup", { links: true })
    await page.locator(`${DISPLAY} [data-type="bold"]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe("#1 https://example.com | bold link")
  })

  test("draws the label and presses the destination", async ({ page }) => {
    // The label is a URL of its own, which is a link the reader can see and a
    // destination they cannot. Both have to survive: one is drawn, the other is
    // reported.
    await openDisplayCase(page, "link-label-url", { links: true })

    expect(await page.locator(DISPLAY).textContent()).toBe("http://google.com")

    await page.locator(`${DISPLAY} [data-link]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe(
      "#1 http://example.com | http://google.com",
    )
  })

  test("an autolink written in a label is part of the label", async ({ page }) => {
    await openDisplayCase(page, "link-label-autolink", { links: true })

    // One link, not two: the markers are gone and what they held is prose.
    await expect(page.locator(`${DISPLAY} [data-type="link"]`)).toHaveCount(1)

    await page.locator(`${DISPLAY} [data-link]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe(
      "#1 https://example.com | https://x.com",
    )
  })

  test("presses a link whose label is an image", async ({ page }) => {
    await openDisplayCase(page, "link-image", { embeds: true, links: true })
    await page.waitForSelector('[data-testid="harness-embed"]')

    // The embed is portalled into a slot that replaced the placeholder character, and the
    // placeholder is all that is left of the label -- so the slot is inside the link.
    await page.locator('[data-testid="harness-embed"]').click()

    expect(await page.locator(PRESSED).textContent()).toBe("#1 https://example.com | ￼")
  })

  test("leaves a reference link inert", async ({ page }) => {
    await openDisplayCase(page, "link-reference", { links: true })

    // Two things are styled as links: the label, which has no destination here to press it to,
    // and the definition's own URL, which is shown as written.
    expect(await page.locator(`${DISPLAY} [data-type="link"]`).count()).toBe(2)

    const pressable = page.locator(`${DISPLAY} [data-link]`)

    await expect(pressable).toHaveCount(1)
    await expect(pressable).toHaveText("https://example.com")
  })

  test("marks nothing without a handler", async ({ page }) => {
    await openDisplayCase(page, "link-inline")

    await expect(page.locator(`${DISPLAY} [data-type="link"]`)).toHaveCount(1)
    await expect(page.locator(`${DISPLAY} [data-link]`)).toHaveCount(0)

    await page.locator(`${DISPLAY} [data-type="link"]`).click()

    expect(await page.locator(PRESSED).textContent()).toBe("none")
  })

  test("is an anchor, so the browser can show and offer the destination", async ({ page }) => {
    // What a marked span could not do: the status bar on hover, the context
    // menu, "open in a new tab", and a screen reader calling it a link.
    await openDisplayCase(page, "link-title", { links: true })

    const link = page.locator(`${DISPLAY} [data-link]`)

    await expect(link).toHaveJSProperty("tagName", "A")
    await expect(link).toHaveAttribute("href", "https://example.com")
    await expect(link).toHaveAttribute("rel", "noopener noreferrer")
    // CommonMark renders a title as the tooltip, and so does this.
    await expect(link).toHaveAttribute("title", "Title")
  })

  test("refuses a destination the browser must not follow", async ({ page }) => {
    // `javascript:` in a document from a stranger is the reason this is not
    // simply written into the href. It stays pressable -- the handler is given
    // the destination as written and can decide -- but nothing can follow it.
    await openDisplayText(page, "[click me](javascript:alert(1))", { links: true })

    const link = page.locator(`${DISPLAY} [data-link]`)

    await expect(link).toHaveJSProperty("tagName", "SPAN")
    await expect(link).toHaveAttribute("role", "link")

    await link.click()

    expect(await page.locator(PRESSED).textContent()).toBe("#1 javascript:alert(1) | click me")
  })

  test("counts every press", async ({ page }) => {
    // The one thing a link has to keep doing.
    await openDisplayCase(page, "link-inline", { links: true })

    const link = page.locator(`${DISPLAY} [data-link]`)

    for (let press = 0; press < 5; press++) {
      await link.click()
    }

    expect(await page.locator(PRESSED).textContent()).toBe("#5 https://example.com | text")
  })
})
