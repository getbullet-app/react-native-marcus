/** @type {import('jest').Config} */
module.exports = {
  preset: "react-native",

  // Most suites are pure Node. Web util suites opt into a DOM with a
  // `@jest-environment jsdom` docblock rather than paying for one everywhere.
  testEnvironment: "node",

  // Helpers live alongside suites under __tests__, so match on the suffix
  // rather than the directory.
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],

  modulePathIgnorePatterns: ["<rootDir>/example/node_modules", "<rootDir>/lib/"],

  // Playwright and Detox bring their own runners; keep Jest out of their specs.
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/e2e/", "<rootDir>/web/"],

  // The micromark ecosystem is ESM-only -- no `require` condition in its
  // exports map -- so Jest has to run it through babel. Everything else the
  // parser pulls in ships CJS (emoji-regex, and fast-check via its `require`
  // condition) and stays untransformed.
  transformIgnorePatterns: [
    "node_modules/(?!(?:(?:jest-)?react-native|@react-native(?:-community)?" +
      "|micromark[^/]*|mdast-util-[^/]*|unist-util-[^/]*" +
      "|character-entities|decode-named-character-reference|devlop)/)",
  ],
}
