import { by, device, element, expect as expectDetox, waitFor } from "detox"

const SCHEME = "marcusexample://"

async function exists(testID: string) {
  try {
    await expectDetox(element(by.id(testID))).toExist()
    return true
  } catch {
    return false
  }
}

/**
 * Launches a fresh app and navigates to a harness route.
 *
 * A URL handed to `launchApp` arrives before expo-router has attached its
 * linking listener, and is dropped -- how long a cold launch takes to get
 * there varies, so sleeping first only trades one flake for another. Delivering
 * the URL until the route mounts is what actually holds. Checking before each
 * delivery means a retry can never push a second copy of the screen.
 */
export async function open(path: string) {
  await device.launchApp({ newInstance: true })

  const url = `${SCHEME}/${path}`

  for (let attempt = 0; attempt < 8; attempt++) {
    if (await exists("harness-root")) {
      return
    }

    await device.openURL({ url })
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error(`the harness never navigated to ${path}`)
}

/** The text of an element, whichever platform's attribute shape it arrives in. */
export async function textOf(testID: string) {
  const attributes = await element(by.id(testID)).getAttributes()

  return "elements" in attributes ? attributes.elements[0]?.text : attributes.text
}

export async function waitForReady() {
  await waitFor(element(by.id("harness-ready"))).toExist().withTimeout(60000)
}

/**
 * Polls the verdict element until the check reports.
 *
 * Waiting on `toHaveText("ok")` would work, but a failing check would surface
 * as a timeout rather than as the mismatch the harness carefully described. So
 * the wait ends as soon as the verdict is anything final, and the caller
 * asserts on it with Jest.
 */
export async function verdict(timeout = 180000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const text = await textOf("harness-check")

    if (text !== undefined && text !== "running") {
      return text
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return "still running when the wait expired"
}
