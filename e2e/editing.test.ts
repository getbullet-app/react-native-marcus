import { expect } from "@jest/globals"
import { by, element } from "detox"

import { open, textOf, waitForReady } from "./helpers"

/**
 * Typing, one keystroke at a time, through the real native input.
 *
 * The formatter reformats on every change, and the buffer it reformats is the
 * one the user is editing. Nothing below the device can show that a keystroke
 * leaves the text intact -- the web specs cover the same ground for the DOM
 * implementation, which shares no code with either native path.
 */

describe("editing", () => {
  it("keeps syntax characters in the buffer as they are typed", async () => {
    await open("harness?text=")
    await waitForReady()

    await element(by.id("harness-input")).typeText("**bold**")

    expect(await textOf("harness-value")).toBe("**bold**")
  })

  it("appends to a fixture without disturbing what was there", async () => {
    await open("harness?case=bold")
    await waitForReady()

    await element(by.id("harness-input")).tapAtPoint({ x: 200, y: 10 })
    await element(by.id("harness-input")).typeText("! and more")

    expect(await textOf("harness-value")).toBe("**bold**! and more")
  })

  it("announces the syntax it renders", async () => {
    // The editing model puts syntax characters in the buffer and styles them
    // rather than hiding them. If a formatter ever removed them from the
    // accessible text, the markup would become invisible to a screen reader
    // while still being what the user is editing.
    await open("harness?case=bold")
    await waitForReady()

    expect(await textOf("harness-input")).toContain("**")
  })
})
