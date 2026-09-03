import { defineConfig, devices } from "@playwright/test"

/**
 * Web specs run against the static export, not the dev server.
 *
 * `output: "static"` prerenders every route in Node, and that path is where the
 * web build breaks in ways the dev server hides. Testing what `expo export`
 * produces means the export itself is under test on every run.
 */
export default defineConfig({
  testDir: "./web",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  // The render model is DOM structure and inline styles, which do not vary by
  // operating system, so baselines drop the default `-chromium-darwin` suffix
  // and stay portable to the Linux CI runner. Screenshots, when they arrive,
  // must NOT share this template -- those genuinely differ per platform.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFileName}/{arg}{ext}",

  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Pinned so measured widths, and later screenshots, are reproducible.
        viewport: { width: 900, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],

  webServer: {
    command: "npm run web:serve",
    url: "http://localhost:8080/harness",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
