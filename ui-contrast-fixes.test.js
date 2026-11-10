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
const layout = read('css/layout.css');

const luminance = hex => [1, 3, 5].map(i => {
  const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);

const contrast = (foreground, background) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

test('contrast stylesheet is loaded after user-theme styles and included in offline cache', () => {
  assert.ok(html.indexOf('css/personalization.css') < html.indexOf('css/ui-contrast-fixes.css'));
  assert.match(html, /css\/ui-contrast-fixes\.css\?v=3/);
  assert.match(sw, /samen-thuis-v46-app-contrast/);
  assert.match(sw, /\.\/css\/ui-contrast-fixes\.css\?v=3/);
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

test('theme contrast overrides are scoped to affected controls and modules', () => {
  assert.match(css, /body\.st-glass20 \.calendar-filter\.active/);
  assert.match(css, /body\.st-glass20 \.st-nav a\.active/);
  assert.match(css, /body\.st-glass20 \.fin-remainder th/);
  assert.match(css, /html\[data-theme20\] body\.st-glass20 \.card:not\(\.welcome\):not\(\.hero-card\):not\(\.dark-card\) \.sport-health p\.sport-privacy/);
  assert.match(css, /html\[data-theme20\] body\.st-glass20 \.nut-pre/);
  assert.match(css, /html:root\[data-theme20\] body\.st-glass20 \.st26-page button:disabled/);
  assert.match(css, /html\[data-theme20\] body\.st-glass20 \.weather18/);
  assert.match(css, /html\[data-theme20\] body\.st-glass20 \.offer-chip25\.is-selected/);
  assert.match(app, /--st-success-text/);
  assert.match(app, /--st-warning-text/);
  assert.match(app, /--st-tag-text/);
  assert.match(app, /--st-secondary-bg/);
  assert.match(app, /--st-secondary-text/);
  assert.match(css, /body\.st-glass20 \.check:not\(\.done\)/);
  assert.match(css, /\.st26-page :is\(\.st26-balance/);
});

test('fixed weather-gradient and inbox-badge text pairs meet AA contrast', () => {
  assert.match(css, /linear-gradient\(135deg, #315f86, #426f95\)/);
  assert.match(layout, /background: #c62828; color: #fff; -webkit-text-fill-color: #fff/);
  for (const background of ['#315f86', '#426f95', '#c62828']) {
    assert.ok(contrast('#ffffff', background) >= 4.5, `${background} needs 4.5:1 contrast`);
  }
});

test('dark dashboard text remains readable on its fixed light surfaces', () => {
  assert.match(css, /\.today18 \.ct18 > span/);
  assert.match(css, /\.today18 \.stats18 small/);
  assert.match(css, /\.today18 \.meal18/);
  assert.match(css, /:is\(\.today18, \.agenda18, \.outfit18\) \.text-btn/);
  for (const [foreground, background] of [
    ['#475363', '#eef1f4'],
    ['#475363', '#f8fafb'],
    ['#17243a', '#fff7ed'],
    ['#9b5d36', '#fff7ed'],
  ]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} needs 4.5:1 contrast`);
  }
});

test('dark challenge forms use a light field surface and visible keyboard focus', () => {
  assert.match(css, /\.st26-page \.st26-form :is\(input, select, textarea\)/);
  assert.match(css, /\.st26-page \.st26-form :is\(input, select, textarea\)::placeholder/);
  assert.match(css, /\.st26-page :is\(button, input, select, textarea\):focus-visible/);
  assert.match(css, /box-shadow: 0 0 0 5px #c7d9ff/);
  assert.match(css, /\.st26-page \.st26-empty/);
  assert.ok(contrast('#172b42', '#ffffff') >= 4.5);
  assert.ok(contrast('#6b7785', '#ffffff') >= 3);
  assert.ok(contrast('#17243a', '#c7d9ff') >= 3);
  assert.ok(contrast('#c7d9ff', '#101a28') >= 3);
  assert.ok(contrast('#d2dbe8', '#101a28') >= 4.5);
});

test('dark nutrition disclaimer and section eyebrow retain AA text contrast', () => {
  assert.match(css, /\.nut-disclaimer/);
  assert.match(css, /\.nut-pane \.eyebrow/);
  assert.match(css, /html:root\[data-theme20="dark"\] body\.st-glass20 :is\(input, select, textarea\)[\s\S]*?border-color: #8492a2/);
  assert.ok(contrast('#17243a', '#fff0e8') >= 4.5);
  assert.ok(contrast('#b8a7ff', '#17263a') >= 4.5);
  assert.ok(contrast('#8492a2', '#112f4a') >= 3);
});

test('dark budget goal cards keep text and actions readable and wrap on mobile', () => {
  assert.match(css, /budget23 \.goal-card23/);
  assert.match(css, /budget23 :is\(\.goal-card23, \.fixed-row23\) button:not\(\.danger23\)/);
  assert.match(css, /budget23 :is\(\.goal-card23, \.fixed-row23\) button\.danger23/);
  assert.match(css, /budget23 \.calc23 > span[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  for (const foreground of ['#17243a', '#21643c', '#8b2732', '#a43d47']) {
    assert.ok(contrast(foreground, '#ffffff') >= 4.5, `${foreground} on white needs 4.5:1 contrast`);
  }
  assert.ok(contrast('#17243a', '#edf2f7') >= 4.5);
  assert.ok(contrast('#6b7785', '#edf2f7') >= 3);
});
