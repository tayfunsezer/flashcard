// Dev-only: runs the browser test files under node and checks index.html script order.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console, TextDecoder, TextEncoder, Intl, setTimeout };
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

function load(rel) {
  const file = path.join(root, rel);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

load('tests/runner.js');
load('tests/manifest.js');
const m = ctx.LG_MANIFEST;
[...m.lib, ...m.src, ...m.tests].forEach(load);

const result = vm.runInContext('T.run()', ctx);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const found = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((x) => x[1]);
const expected = [...m.lib, ...m.src];
const pos = expected.map((p) => found.indexOf(p));
const inOrder = pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1]));
if (inOrder) result.passed++;
else {
  result.failed++;
  result.failures.push({ name: 'index.html script order', error: new Error('expected ' + JSON.stringify(expected) + ' in order, found ' + JSON.stringify(found)) });
}

for (const f of result.failures) console.log('FAIL ' + f.name + '\n  ' + (f.error && f.error.message));
console.log(result.passed + ' passed, ' + result.failed + ' failed');
process.exit(result.failed ? 1 : 0);
