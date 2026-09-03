/** @type {import('jest').Config} */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e/**/*.test.ts"],

  // Detox supplies the environment, the lifecycle and the reporter; the runner
  // is Jest only in the sense that Jest walks the files.
  testEnvironment: "detox/runners/jest/testEnvironment",
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],

  // One device, one worker. Detox can shard across devices but a second
  // simulator on a CI runner costs more than the suite takes to run.
  maxWorkers: 1,
  testTimeout: 180000,
  verbose: true,

  // No react-native preset here: it would replace the Detox environment. The
  // repo's babel config already handles TypeScript.
  transform: { "\\.[jt]sx?$": "babel-jest" },
}
