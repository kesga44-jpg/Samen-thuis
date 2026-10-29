const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./personal-preferences-core.js');
const D = require('./dashboard-core.js');

test('personal preference storage is keyed by authenticated user ID only', () => {
  const kees = P.storageKey('11111111-1111-4111-8111-111111111111');
  const daphne = P.storageKey('22222222-2222-4222-8222-222222222222');
  assert.notEqual(kees, daphne);
  assert.throws(() => P.storageKey('Kees'), /gebruikers-ID/);
  assert.throws(() => P.storageKey('shared-household-code'), /gebruikers-ID/);
});

test('personal preference restore constrains theme and color while retaining dashboard settings', () => {
  const result = P.normalize({
    ui: { theme: 'unexpected', accent: 'orange', density: 'compact', accentColor: '#21a4bc' },
    dashboard: { order: ['agenda'], visible: { agenda: false } }
  }, ['weather', 'agenda'], D);
  assert.deepEqual(result.ui, { theme: 'system', accent: 'orange', density: 'compact', accentColor: '#21a4bc' });
  assert.deepEqual(result.dashboard, {
    order: ['agenda', 'weather'],
    visible: { weather: true, agenda: false }
  });
});

test('invalid or absent custom accent colors restore a safe preset color', () => {
  assert.equal(P.normalize({ ui: { accent: 'orange', accentColor: 'red' } }, [], D).ui.accentColor, '#d56e38');
  assert.equal(P.normalize({ ui: {} }, [], D).ui.accentColor, '#7057d9');
});
