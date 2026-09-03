import type { Page } from "@playwright/test"

/** The contenteditable the component renders into. It carries no testID. */
const INPUT = ".react-native-marcus-input-multiline"

/**
 * Serializes the input's DOM into the same kind of render model the Android and
 * iOS suites will dump: one indented line per node, carrying the markdown type,
 * the tag it was rendered as, and every inline style the component set.
 *
 * A failure then reads as `span[bold] font-weight:bold` moving, rather than as
 * a wall of minified HTML or a pixel count.
 */
async function renderModel(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)

    if (!root) {
      return "(no input)"
    }

    const lines: string[] = []

    const walk = (node: Node, depth: number) => {
      const indent = "  ".repeat(depth)

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ""
        if (text.length > 0) {
          lines.push(`${indent}#text ${JSON.stringify(text)}`)
        }
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return
      }

      const element = node as HTMLElement
      const tag = element.tagName.toLowerCase()
      const type = element.getAttribute("data-type")

      // These three are derived from measuring a marker in the input's font, so
      // they differ between a macOS dev machine and a Linux CI runner. The
      // exact arithmetic is already pinned deterministically in
      // `blockLayout.test.ts` with a stub measurer; here only their presence
      // matters, and `geometry.spec.ts` covers how they relate.
      const MEASURED = ["padding-left", "text-indent", "background-position-x"]

      const style = Array.from(element.style)
        .map((property) => {
          const value = element.style.getPropertyValue(property).trim()
          return `${property}:${MEASURED.includes(property) ? "<measured>" : value}`
        })
        .sort()
        .join(" ")

      lines.push(`${indent}${tag}${type ? `[${type}]` : ""}${style ? ` ${style}` : ""}`.trimEnd())

      for (const child of Array.from(element.childNodes)) {
        walk(child, depth + 1)
      }
    }

    for (const child of Array.from(root.childNodes)) {
      walk(child, 0)
    }

    return lines.join("\n")
  }, INPUT)
}

/** Opens a fixture by id and waits for the component to have rendered it. */
async function openCase(page: Page, id: string) {
  await page.goto(`/harness?case=${encodeURIComponent(id)}`)
  await page.waitForSelector('[data-testid="harness-ready"]', { state: "attached" })
  await page.waitForSelector(INPUT)
}

/** Opens the harness on arbitrary text rather than a fixture. */
async function openText(page: Page, text: string) {
  await page.goto(`/harness?text=${encodeURIComponent(text)}`)
  await page.waitForSelector('[data-testid="harness-ready"]', { state: "attached" })
  await page.waitForSelector(INPUT)
}

/** The buffer as the component currently holds it. */
async function currentValue(page: Page): Promise<string> {
  return page.locator('[data-testid="harness-value"]').innerText()
}

/** Collects uncaught page errors so a spec can assert none happened. */
function failOnPageErrors(page: Page, sink: string[]) {
  page.on("pageerror", (error) => sink.push(`pageerror: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") {
      sink.push(`console: ${message.text()}`)
    }
  })
}

export { INPUT, currentValue, failOnPageErrors, openCase, openText, renderModel }
