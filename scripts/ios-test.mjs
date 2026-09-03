#!/usr/bin/env node
/**
 * Runs the iOS formatter tests against whichever iPhone simulator is available.
 *
 * The destination cannot be hard-coded: the runtimes installed on a CI runner
 * are not the ones on any given developer's machine, and `xcodebuild test`
 * needs a concrete device rather than a generic platform. Set
 * `MARCUS_IOS_DESTINATION` to override the choice entirely.
 */
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..", "ios-tests")

function pickDestination() {
  if (process.env.MARCUS_IOS_DESTINATION) {
    return process.env.MARCUS_IOS_DESTINATION
  }

  const listed = execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    encoding: "utf8",
  })

  const devices = Object.entries(JSON.parse(listed).devices)
    // Newest runtime first, so the simulator matches the newest SDK the runner has.
    .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
    .flatMap(([, entries]) => entries)
    .filter((device) => device.isAvailable && device.name.startsWith("iPhone"))

  const device = devices[0]

  if (!device) {
    console.error("✖  No available iPhone simulator. Install one via Xcode > Settings > Platforms.")
    process.exit(1)
  }

  console.log(`▸  Using ${device.name} (${device.udid})`)

  return `platform=iOS Simulator,id=${device.udid}`
}

const args = [
  "test",
  "-scheme",
  "MarcusFormatter-Package",
  "-destination",
  pickDestination(),
  ...process.argv.slice(2),
]

try {
  execFileSync("xcodebuild", args, { cwd: packageDir, stdio: "inherit" })
} catch {
  process.exit(1)
}
