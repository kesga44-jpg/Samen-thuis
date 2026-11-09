// Targeted regression checks for the screenshot-driven contrast fixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const css = read('css/ui-contrast-fixes.css');
const html = read('index.html');
const sw = read('sw.js');
const app = read('app.js');

test('contrast stylesheet is loaded after user-theme styles and included in offline cache', () => {
  assert.ok(html.indexOf('css/personalization.css') < html.indexOf('css/ui-contrast-fixes.css'));
  assert.match(html, /css\/ui-contrast-fixes\.css\?v=1/);
  assert.match(sw, /samen-thuis-v44-ui-contrast/);
  assert.match(sw, /\.\/css\/ui-contrast-fixes\.css\?v=1/);
});

test('grocery badge overrides are restricted to the existing price-reference markup', () => {
  assert.match(app, /data-v15-price-card/);
  assert.match(css, /body\.st-glass20 \[data-v15-price-card\] \.tag\.green/);
  assert.match(css, /body\.st-glass20 \[data-v15-price-card\] \.v13-card \.tag:not\(\.green\)/);
  assert.doesNotMatch(css, /body\.st-glass20\s+\.tag\.green\s*[,\{]/);
  assert.doesNotMatch(css, /\.price-reference-card/);
});

test('Auto tab overrides use existing Auto module and tab markup only', () => {
  assert.match(app, /auto-tabs24/);
  assert.match(css, /\.auto24 \.auto-tabs24 button\[data-auto24-tab\][\s\S]*?min-height:\s*48px/);
  assert.match(css, /\.auto24 \.auto-tabs24 button\[data-auto24-tab\]\.active/);
  assert.match(css, /\.auto24 \.auto-tabs24 button\[data-auto24-tab\]:focus-visible/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?min-height:\s*52px/);
});

test('fixes do not introduce global color, button, or tag overrides', () => {
  assert.doesNotMatch(css, /^\s*\*\s*\{/m);
  assert.doesNotMatch(css, /^\s*body\.st-glass20\s*\{/m);
  assert.doesNotMatch(css, /^\s*body\.st-glass20\s+\.tag(?:\s|\{|\.)/m);
  assert.doesNotMatch(css, /^\s*body\.st-glass20\s+button(?:\s|\{|\.)/m);
});
