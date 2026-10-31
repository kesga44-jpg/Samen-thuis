const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs');
const N = require('./nav-core.js');
const read = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const OLD = ['today','planning','tasks','groceries','stock','offers','budget19','meals','chores','challenges','weather','programs','ideas','home','trips','auto24','extra19','imports243','settings','sportcoach'];

test('maximaal vijf hoofdonderdelen in de onderbalk', () => {
  assert.ok(N.SECTIONS.length <= 5);
  assert.deepEqual(N.SECTIONS.map(s => s.key), ['vandaag', 'financien', 'sport', 'doelen', 'meer']);
});

test('elke bestaande pagina is in precies één sectie bereikbaar', () => {
  const all = N.allPages();
  assert.equal(new Set(all).size, all.length, 'dubbele menu-items');
  for (const p of OLD) assert.ok(N.sectionOf(p), p + ' onbereikbaar');
});

test('Meer-blokken bevatten elke pagina uit de sectie Meer precies één keer', () => {
  const tiles = N.MORE_GROUPS.flatMap(g => g.tiles.map(t => t[0]));
  assert.equal(new Set(tiles).size, tiles.length, 'dubbele tegels');
  const meerPages = N.SECTIONS.find(s => s.key === 'meer').pages.map(p => p[0]).filter(p => p !== 'meer');
  assert.deepEqual([...tiles].sort(), meerPages.sort());
});

test('routes worden gelezen en geschreven', () => {
  assert.deepEqual(N.parseRoute('#/settings/account'), { page: 'settings', sub: 'account' });
  assert.equal(N.formatRoute('settings', 'account'), '#/settings/account');
  assert.equal(N.parseRoute('#/bestaat-niet'), null);
});

test('Instellingen, Financiën en Sport zijn opgesplitst in subpagina’s', () => {
  const keys = p => N.HUBS[p].subs.map(s => s.key);
  assert.deepEqual(keys('settings'), ['profiel', 'huishouden', 'account', 'synchronisatie', 'back-ups', 'voorkeuren', 'overig']);
  assert.deepEqual(keys('budget19'), ['dashboard', 'transacties', 'budgetten', 'vaste-lasten', 'spaardoelen', 'overzichten']);
  assert.deepEqual(keys('sportcoach'), ['profielen', 'schemas', 'oefeningen', 'planning', 'geschiedenis', 'voortgang']);
  for (const [page, hub] of Object.entries(N.HUBS)) {
    assert.ok(N.isHub(page));
    for (const s of hub.subs) {
      assert.ok(s.label && s.icon && s.parts.length, page + '/' + s.key);
      assert.equal(N.parseRoute(N.formatRoute(page, s.key)).sub, s.key);
    }
  }
});

test('terugnavigatie en kruimelpad gaan naar de bovenliggende pagina', () => {
  assert.deepEqual(N.parentOf('settings', 'account'), { page: 'settings', sub: null });
  assert.deepEqual(N.crumbs('settings', 'account').map(c => c.label), ['Meer', 'Instellingen', 'Account en beveiliging']);
});

test('nieuwe scripts staan in index.html en sw.js, oude navigatie-CSS is vervangen', () => {
  const h = read('index.html'), sw = read('sw.js');
  for (const f of ['nav-core.js', 'nav-groups.js', 'search-core.js', 'search.js', 'shell.css', 'sportcoach.js']) {
    assert.match(h, new RegExp(f.replace('.', '\\.'))); assert.match(sw, new RegExp(f.replace('.', '\\.')));
  }
  assert.ok(h.indexOf('sportcoach.js') < h.indexOf('nav-groups.js') && h.indexOf('nav-groups.js') < h.indexOf('search.js'));
  assert.match(h, /data-st-search/);
  assert.doesNotMatch(read('css/layout.css'), /body\.nav5/);
});

test('onderbalk gebruikt safe areas en de zoekdialoog ondersteunt Ctrl/Cmd+K', () => {
  assert.match(read('shell.css'), /env\(safe-area-inset-bottom\)/);
  assert.match(read('search.js'), /ctrlKey \|\| e\.metaKey/);
});
