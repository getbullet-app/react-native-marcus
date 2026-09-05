import { expect, test } from "@playwright/test"

import CASES from "../src/__fixtures__/cases.json"
import { DISPLAY, failOnPageErrors, openDisplayCase, renderModel } from "./helpers"

/**
 * The same render model as `render.spec.ts`, for `MarkdownText` rather than the input.
 *
 * The two baselines are meant to be read side by side: the display's markup is the input's with
 * the syntax spans gone, and anything else that differs between them is worth a second look.
 */
test.describe("display render model", () => {
  for (const { id } of CASES) {
    test(id, async ({ page }) => {
      const errors: string[] = []
      failOnPageErrors(page, errors)

      await openDisplayCase(page, id)

      expect(await renderModel(page, DISPLAY)).toMatchSnapshot(`${id}.txt`)
      expect(errors).toEqual([])
    })
  }
})
