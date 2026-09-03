import { expect } from "@jest/globals"

import { open, textOf, waitForReady } from "./helpers"

/**
 * The build wired together.
 *
 * Everything else in the suite tests a layer in isolation: the parser in Node,
 * the formatters against recorded ranges, the DOM after a web export. Nothing
 * proves that autolinking found the module, that codegen produced a component
 * the app can mount, or that the C++ bridge hands the worklet parser's output
 * to the native formatter without crashing. That is what launching the real app
 * on a real device proves, and it is most of the value here.
 */

describe("the harness", () => {
  it("mounts an input and holds the fixture text", async () => {
    await open("harness?case=bold")
    await waitForReady()

    expect(await textOf("harness-value")).toBe("**bold**")
  })
})
