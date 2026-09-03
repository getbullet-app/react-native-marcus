import { expect } from "@jest/globals"

import { open, verdict } from "./helpers"

/**
 * The whole corpus, on the device, in one launch each. Deep-linking 117 cases
 * one at a time would take longer than the rest of the suite combined, so the
 * harness walks the corpus itself and reports a single verdict.
 */

describe("the corpus on device", () => {
  it("parses identically in the worklet runtime", async () => {
    await open("checks?mode=parser")

    expect(await verdict()).toBe("ok")
  })

  it("renders every fixture without taking the app down", async () => {
    await open("checks?mode=sweep")

    expect(await verdict()).toBe("ok")
  })
})
