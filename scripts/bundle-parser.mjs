#!/usr/bin/env node
/**
 * Bundles the micromark based parser into a single-file workletized bundle.
 * The alternative used by live-markdown is to use patch-package to patch
 * dependencies through postinstall script.
 * That is not viable since micromark is modular and pulls in 100+ dependencies.
 * Also with the npm 12 install scripts are disabled by default.
 */
import { build } from "esbuild"
import kleur from "kleur"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

/** The two shipped formats, and how each opens its synthesized `parse` export. */
const FORMATS = [
  { format: "cjs", dir: "lib/commonjs", declaration: "module.exports.parse = function parse" },
  { format: "esm", dir: "lib/module", declaration: "export function parse" },
]

/**
 * The whole bundle is wrapped in the exported function body, so the module runs
 * on every call and nothing escapes to module scope. `TextDecoder` is shadowed
 * with a thrower: it is absent from the worklet runtime, and a dependency
 * reaching for it should fail loudly rather than at a keystroke on device.
 */
function buildOptions({ format, declaration, outfile }) {
  return {
    entryPoints: [join(root, "src/parser/index.ts")],
    outfile,
    format,
    target: "es2020",
    platform: "neutral",
    bundle: true,
    sourcemap: true,
    banner: {
      js: `${declaration}(markdown) {
"worklet";
function TextDecoder() {
  throw new Error('TextDecoder is not available in the worklet runtime');
}`,
    },
    footer: {
      js: `return globalThis.__parse__micromark(markdown);\n}`,
    },
  }
}

for (const { format, dir, declaration } of FORMATS) {
  const label = kleur.blue(format === "esm" ? "module" : "commonjs")
  const outfile = join(root, dir, "parser/index.js")

  try {
    await build(buildOptions({ format, declaration, outfile }))

    console.log(
      `${kleur.green(kleur.bold("✔"))}  ${label} Wrote parser bundle to ${kleur.blue(dir)}`,
    )
  } catch (err) {
    console.error(
      `${kleur.red(kleur.bold("✖"))}  ${label} Bundling failed with: ${kleur.blue(
        err.message,
      )}`,
    )
  }
}
