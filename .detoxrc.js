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

function newestIphone() {
  // The android configuration is the only one a Linux runner can use, and
  // Detox may touch every device entry while composing its config -- so this
  // has to be answerable without `xcrun` rather than throw on the way past.
  if (process.platform !== "darwin") {
    return { type: "iPhone" }
  }

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
    throw new Error("No available iPhone simulator. Install one via Xcode > Settings > Platforms.")
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

  const [avd] = execFileSync(join(sdk, "emulator/emulator"), ["-list-avds"], { encoding: "utf8" })
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
    simulator: { type: "ios.simulator", get device() { return newestIphone() } },
    emulator: { type: "android.emulator", get device() { return firstAvd() } },
  },

  configurations: {
    ios: { device: "simulator", app: "ios" },
    android: { device: "emulator", app: "android" },
  },
}
