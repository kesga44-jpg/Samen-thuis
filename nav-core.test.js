const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs');
const N = require('./nav-core.js');
const OLD = ['today','planning','tasks','groceries','stock','offers','budget19','meals','chores','challenges','weather','programs','ideas','home','trips','auto24','extra19','imports243','settings'];
test('vijf hoofdsecties', () => assert.equal(N.SECTIONS.length, 5));
test('elke bestaande pagina is in precies één sectie bereikbaar', () => {
  const all = N.allPages();
  assert.equal(new Set(all).size, all.length, 'dubbele menu-items');
  for (const p of OLD) assert.ok(N.sectionOf(p), p + ' onbereikbaar');
  assert.equal(all.length, OLD.length + 1);
  assert.equal(N.sectionOf('sportcoach').key, 'meer');
  assert.equal(N.pageLabel('sportcoach'), 'Sport & Training');
});
test('standaardpagina en terugweg', () => {
  assert.equal(N.defaultPage('huishouden'), 'meals');
  assert.equal(N.defaultPage('huishouden', 'stock'), 'stock');
  assert.equal(N.defaultPage('huishouden', 'nope'), 'meals');
  assert.equal(N.breadcrumb('stock').parent, 'meals');
  assert.equal(N.breadcrumb('meals').isDefault, true);
  assert.equal(N.breadcrumb('zzz'), null);
});
test('index.html laadt nav-scripts', () => {
  const h = fs.readFileSync(__dirname + '/index.html', 'utf8');
  assert.match(h, /nav-core\.js/); assert.match(h, /nav-groups\.js/);
});
test('verborgen oude menu-items zijn niet focusseerbaar (display:none) en nieuwe scripts staan in index.html en sw.js', () => {
  const css = fs.readFileSync(__dirname + '/css/layout.css', 'utf8');
  assert.match(css, /body\.nav5 #nav > :not\(\[data-nav5\]\)[^{]*\{ display: none !important/);
  const h = fs.readFileSync(__dirname + '/index.html', 'utf8'), sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
  for (const f of ['household-sync-core.js', 'account-sync.js', 'inbox-core.js', 'inbox.js', 'weather-advice-core.js', 'weather-extras.js', 'sportcoach-core.js', 'sportcoach.js', 'sportcoach.css']) {
    assert.match(h, new RegExp(f.replace('.', '\\.'))); assert.match(sw, new RegExp(f.replace('.', '\\.')));
  }
});
