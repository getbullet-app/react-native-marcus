import { expect, test } from "@playwright/test"

import CASES from "../src/__fixtures__/cases.json"
import { failOnPageErrors, openCase, renderModel } from "./helpers"

/**
 * The web render model, one baseline per fixture, driven by the same corpus the
 * parser suite uses.
 *
 * This runs against `expo export -p web` output rather than the dev server, so
 * the Node prerender is exercised on every run too.
 */
test.describe("render model", () => {
  for (const { id } of CASES) {
    test(id, async ({ page }) => {
      const errors: string[] = []
      failOnPageErrors(page, errors)

      await openCase(page, id)

      expect(await renderModel(page)).toMatchSnapshot(`${id}.txt`)
      expect(errors).toEqual([])
    })
  }
})
