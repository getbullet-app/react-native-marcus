// This module is imported during server-side rendering (e.g. Expo Router's static
// web output), where `window`/`navigator` do not exist. All checks are therefore
// evaluated lazily on first access instead of at module scope.
const canUseDOM = typeof window !== "undefined" && typeof navigator !== "undefined"

function memoize(compute: () => boolean): () => boolean {
  let value: boolean | undefined
  return () => {
    if (value === undefined) {
      value = canUseDOM && compute()
    }
    return value
  }
}

const isFirefox = memoize(() => navigator.userAgent.toLowerCase().includes("firefox"))
const isChromium = memoize(() => "chrome" in window)

/**
 * Whether the platform is a mobile browser.
 * Copied from Expensify App https://github.com/Expensify/App/blob/90dee7accae79c49debf30354c160cab6c52c423/src/libs/Browser/index.website.ts#L41
 */
const isMobile = memoize(() =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Silk|Opera Mini/i.test(
    navigator.userAgent,
  ),
)

const BrowserUtils = {
  get isFirefox() {
    return isFirefox()
  },
  get isChromium() {
    return isChromium()
  },
  get isMobile() {
    return isMobile()
  },
}

export default BrowserUtils
