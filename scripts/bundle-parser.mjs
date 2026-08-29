#!/usr/bin/env node
/**
 * Bundles the micromark based parser into a single-file workletized bundle.
 * The alternative used by live-markdown is to use patch-package to patch
 * dependencies through postinstall script.
 * That is not viable since micromark is modular and pulls in 100+ dependencies.
 * Also with the npm 12 install scripts are disabled by default.
 */
import {build} from 'esbuild';
import kleur from 'kleur';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = 'parser/index';

for (const [format, dir, declaration] of [
  ['cjs', 'lib/commonjs', 'export function parse'],
  ['esm', 'lib/module', 'module.exports.parse = function parse'],
]) {
  const outfile = join(root, dir, `${entry}.js`);

  try {
    await build({
      entryPoints: [join(root, 'src', `${entry}.ts`)],
      outfile,
      format,
      target: 'es2020',
      platform: 'neutral',
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
    });

    console.log(`${kleur.green(kleur.bold('✔'))}  ${kleur.blue(format === 'esm' ? 'module' : 'commonjs')} Wrote parser bundle to ${kleur.blue(dir)}`);
  } catch (err) {
    console.error(`${kleur.red(kleur.bold('✖'))}  ${kleur.blue(format === 'esm' ? 'module' : 'commonjs')} Bundling failed with: ${kleur.blue(err.message)}`);
  }
}
