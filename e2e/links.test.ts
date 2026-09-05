import { expect } from "@jest/globals"
import { by, element, waitFor } from "detox"

import { open, textOf, waitForReady } from "./helpers"

/**
 * Pressing a link in `MarkdownText`, on the device.
 *
 * A link's label is wrapped in a nested `Text`, which costs no characters and
 * so leaves the ranges the decorator applies where they were. Nothing below the
 * device can show that the platform still routes a touch to it once the
 * paragraph is being laid out by our own layout manager -- which is the one
 * thing about this that could stop working.
 *
 * Tapped by coordinate rather than by id: a nested `Text` is not a view on
 * either platform, so there is nothing for a matcher to find.
 */

describe("links", () => {
  it("reports the destination the text no longer carries", async () => {
    // A label long enough to fill several lines, so the tap cannot land beside
    // it: the point is in the element's own coordinates, and where a word ends
    // is a question about the font the device happens to render in.
    const label = Array.from({ length: 60 }, () => "link").join(" ")
    const markdown = `[${label}](https://example.com)`

    await open(`harness?display=1&links=1&text=${encodeURIComponent(markdown)}`)
    await waitForReady()

    await element(by.id("harness-display")).tapAtPoint({ x: 200, y: 60 })

    // Waited for rather than read: the press crosses into JavaScript and back,
    // and the tap returns as soon as the touch has been delivered.
    await waitFor(element(by.id("harness-link")))
      .toHaveText(`#1 https://example.com | ${label}`)
      .withTimeout(5000)
  })

  it("keeps answering however many times it is pressed", async () => {
    const label = Array.from({ length: 60 }, () => "link").join(" ")
    const markdown = `[${label}](https://example.com)`

    await open(`harness?display=1&links=1&text=${encodeURIComponent(markdown)}`)
    await waitForReady()

    for (let press = 1; press <= 12; press++) {
      await element(by.id("harness-display")).tapAtPoint({ x: 200, y: 60 })
    }

    await waitFor(element(by.id("harness-link")))
      .toHaveText(`#12 https://example.com | ${label}`)
      .withTimeout(5000)
  })

  it("lands where the link is drawn", async () => {
    // React Native reads a text touch straight off the layout without taking
    // the view's padding off it first, so a `Text` with padding hit-tests the
    // character that many points down and to the right of the one under the
    // finger -- the bottom of every line pressing the line below it. Both
    // platforms are corrected, and this is the corner that proves it: the
    // bottom right of the `link` in the quote, which is inside the drawn word
    // and outside the box the uncorrected touch would have looked in.
    //
    // Coordinates measured on a Pixel 9a and an iPhone 17 Pro at the harness's
    // 16pt text and 8pt padding. A different font or density moves the word,
    // and this moves with it.
    await open("harness?case=kitchen-sink&display=1&links=1")
    await waitForReady()

    await element(by.id("harness-display")).tapAtPoint({ x: 152, y: 127 })

    await waitFor(element(by.id("harness-link")))
      .toHaveText("#1 https://example.com | link")
      .withTimeout(5000)
  })

  it("leaves the prose around it alone", async () => {
    await open("harness?case=link-inline&display=1&links=1")
    await waitForReady()

    // Well past the end of the word, on the same line.
    await element(by.id("harness-display")).tapAtPoint({ x: 300, y: 16 })

    expect(await textOf("harness-link")).toBe("none")
  })
})
