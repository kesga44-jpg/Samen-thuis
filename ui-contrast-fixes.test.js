// Targeted regression checks for the screenshot-driven contrast fixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const css = read('css/ui-contrast-fixes.css');
const html = read('index.html');
const sw = read('sw.js');

test('contrast stylesheet is loaded after user-theme styles and included in offline cache', () => {
  assert.match(html, /css\/ui-contrast-fixes\.css\?v=1/);
  assert.match(sw, /samen-thuis-v44-ui-contrast/);
  assert.match(sw, /\.\/css\/ui-contrast-fixes\.css\?v=1/);
});

test('grocery deal badges have an explicit readable foreground and background', () => {
  assert.match(css, /\.tag\.green[\s\S]*?color:\s*#fff\s*!important/);
  assert.match(css, /\.tag\.green[\s\S]*?background-color:\s*#216b4a\s*!important/);
  assert.match(css, /\[data-v15-price-card\]/);
});

test('Auto tab labels have explicit normal and selected contrast, and touch targets', () => {
  assert.match(css, /\.auto-tabs24 button[\s\S]*?min-height:\s*48px/);
  assert.match(css, /\.auto-tabs24 button[\s\S]*?color:\s*var\(--user-primary-text, var\(--ink\)\) !important/);
  assert.match(css, /\.auto-tabs24 button\.active[\s\S]*?color:\s*#fff !important/);
  assert.match(css, /\.auto-tabs24 button:focus-visible/);
});

test('fixes are scoped to grocery price references and Auto, not global text colors', () => {
  assert.doesNotMatch(css, /^\s*\*\s*\{/m);
  assert.doesNotMatch(css, /^\s*body\.st-glass20\s*\{/m);
  assert.match(css, /\[data-v15-price-card\]/);
  assert.match(css, /\.auto24/);
});
