const test = require('node:test'), assert = require('node:assert');
const S = require('./search-core.js');

const data = {
  tasks: [{ id: 't1', title: 'Café reserveren', done: false }],
  groceries: [{ id: 'g1', name: 'Melk', store: 'AH' }, { id: 'g2', name: 'Havermelk' }],
  sportCoach: {
    profiles: { kees: { health: 'knieblessure' } },
    programs: [{ id: 'p1', person: 'kees', name: 'Kracht schema' }, { id: 'p2', person: 'daphne', name: 'Kracht privé' }],
    sessions: [], library: []
  }
};

test('lege zoekterm geeft geen resultaten', () => {
  assert.deepEqual(S.search(data, '', {}), []);
  assert.deepEqual(S.search(data, '   ', {}), []);
});

test('hoofdletters en accenten worden genegeerd en resultaten zijn per module gegroepeerd', () => {
  const r = S.search(data, 'CAFE', {});
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'tasks');
  assert.equal(r[0].results[0].page, 'tasks');
});

test('meerdere woorden werken als EN', () => {
  assert.equal(S.search(data, 'kracht schema', {}).flatMap(g => g.results).length, 1);
});

test('sportresultaten respecteren canManagePerson', () => {
  const only = p => p === 'kees';
  const ids = S.search(data, 'kracht', { canManagePerson: only }).flatMap(g => g.results.map(x => x.id));
  assert.deepEqual(ids, ['p1']);
});

test('gezondheidsgegevens uit sportprofielen worden nooit doorzocht', () => {
  assert.equal(S.search(data, 'knieblessure', { canManagePerson: () => true }).length, 0);
});

test('pagina’s en instellingen zijn doorzoekbaar met subroute', () => {
  const g = S.search(data, 'synchronisatie', {}).find(x => x.results.some(i => i.page === 'settings'));
  assert.ok(g, 'instellingen niet gevonden');
  assert.equal(g.results.find(i => i.page === 'settings').sub, 'synchronisatie');
});
