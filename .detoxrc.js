const { execFileSync } = require("node:child_process")
const { join } = require("node:path")

/**
 * Detox drives the example app on a real simulator and a real emulator.
 *
 * Release builds, not debug: a debug build fetches its bundle from Metro, which
 * means a second process to babysit and a JS bundle that is not the one a user
 * would run. A release build embeds the bundle, so the app under test is
 * self-contained and the run is reproducible on a cold CI machine.
 *
 * Devices are discovered rather than named. The runtimes installed on a CI
 * runner are not the ones on any given developer's machine, and Detox needs a
 * concrete device. `MARCUS_IOS_SIMULATOR` and `MARCUS_ANDROID_AVD` override.
 */

/**
 * The configuration this process was asked for, if it was asked for one.
 *
 * Detox composes the entire config before it runs anything, reading every entry
 * under `devices` on the way past -- a getter defers a lookup but not far
 * enough. Discovering unconditionally means an iOS run on a Mac goes looking
 * for an AVD and an Android run on a Linux box shells out to `xcrun`, and on a
 * CI runner both of those are fatal. Only the selected configuration is worth
 * answering for.
 */
function selection() {
  // `detox test` resolves the config a second time inside the runner child,
  // where the choice arrives as an environment variable rather than on argv.
  if (process.env.DETOX_CONFIGURATION) {
    return process.env.DETOX_CONFIGURATION
  }

  const index = process.argv.findIndex((arg) => arg === "-c" || arg === "--configuration")

  if (index !== -1) {
    return process.argv[index + 1]
  }

  return process.argv.find((arg) => arg.startsWith("--configuration="))?.split("=")[1]
}

const SELECTED = selection()

function newestIphone() {
  if (process.env.MARCUS_IOS_SIMULATOR) {
    return { type: process.env.MARCUS_IOS_SIMULATOR }
  }

  const listed = execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    encoding: "utf8",
  })

  const device = Object.entries(JSON.parse(listed).devices)
    // Newest runtime first, so the simulator matches the newest SDK available.
    .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
    .flatMap(([, entries]) => entries)
    .find((entry) => entry.isAvailable && entry.name.startsWith("iPhone"))

  if (!device) {
    throw new Error(
      "No available iPhone simulator. Install one via Xcode > Settings > Platforms.",
    )
  }

  return { id: device.udid }
}

function firstAvd() {
  if (process.env.MARCUS_ANDROID_AVD) {
    return { avdName: process.env.MARCUS_ANDROID_AVD }
  }

  const sdk =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    join(process.env.HOME, "Library/Android/sdk")

  const [avd] = execFileSync(join(sdk, "emulator/emulator"), ["-list-avds"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)

  if (!avd) {
    throw new Error("No Android AVD found. Create one in Android Studio's Device Manager.")
  }

  return { avdName: avd }
}

module.exports = {
  testRunner: {
    args: { $0: "jest", config: "e2e/jest.config.js" },
    jest: { setupTimeout: 180000 },
  },

  // Kept for CI: a failing device test says very little without the device log
  // and a picture of what was on screen.
  artifacts: {
    rootDir: "artifacts",
    plugins: {
      log: { enabled: true },
      screenshot: { shouldTakeAutomaticSnapshots: true, keepOnlyFailedTestsArtifacts: true },
    },
  },

  apps: {
    ios: {
      type: "ios.app",
      binaryPath: "example/ios/build/Build/Products/Release-iphonesimulator/marcusexample.app",
      build:
        "xcodebuild -workspace example/ios/marcusexample.xcworkspace -scheme marcusexample " +
        "-configuration Release -sdk iphonesimulator -derivedDataPath example/ios/build -quiet",
    },
    android: {
      type: "android.apk",
      binaryPath: "example/android/app/build/outputs/apk/release/app-release.apk",
      testBinaryPath:
        "example/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk",
      build:
        "cd example/android && ./gradlew :app:assembleRelease :app:assembleAndroidTest " +
        "-DtestBuildType=release",
    },
  },

  devices: {
    // The placeholders are never launched. They exist so that the entry Detox
    // reads on its way to the one you asked for still satisfies its schema.
    simulator: {
      type: "ios.simulator",
      get device() {
        return SELECTED === "ios" ? newestIphone() : { type: "iPhone" }
      },
    },
    emulator: {
      type: "android.emulator",
      get device() {
        return SELECTED === "android" ? firstAvd() : { avdName: "unselected" }
      },
    },
  },

  configurations: {
    ios: { device: "simulator", app: "ios" },
    android: { device: "emulator", app: "android" },
  },
}
