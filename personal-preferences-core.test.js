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
    ui: {
      theme: 'unexpected', accent: 'orange', density: 'spacious', accentColor: '#21a4bc',
      fontFamily: 'Nunito', fontSize: 20, fontWeight: 600, lineHeight: 1.8,
      radius: 4, spacing: 1.3, animations: false,
      colors: { background: '#112233', button: '#445566', error: 'red', unknown: '#000000' }
    },
    dashboard: { order: ['agenda'], visible: { agenda: false } }
  }, ['weather', 'agenda'], D);
  assert.equal(result.ui.theme, 'system');
  assert.equal(result.ui.accent, 'orange');
  assert.equal(result.ui.density, 'spacious');
  assert.equal(result.ui.accentColor, '#21a4bc');
  assert.equal(result.ui.colors.accent, '#21a4bc');
  assert.equal(result.ui.fontFamily, 'Nunito');
  assert.equal(result.ui.fontSize, 20);
  assert.equal(result.ui.fontWeight, 600);
  assert.equal(result.ui.lineHeight, 1.8);
  assert.equal(result.ui.radius, 4);
  assert.equal(result.ui.spacing, 1.3);
  assert.equal(result.ui.animations, false);
  assert.equal(result.ui.colors.background, '#112233');
  assert.equal(result.ui.colors.button, '#445566');
  assert.equal(result.ui.colors.error, P.DEFAULT_UI.colors.error);
  assert.equal(Object.hasOwn(result.ui.colors, 'unknown'), false);
  assert.deepEqual(result.dashboard, {
    order: ['agenda', 'weather'],
    visible: { weather: true, agenda: false }
  });
});

test('invalid or absent custom accent colors restore a safe preset color', () => {
  assert.equal(P.normalize({ ui: { accent: 'orange', accentColor: 'red' } }, [], D).ui.accentColor, '#d56e38');
  assert.equal(P.normalize({ ui: {} }, [], D).ui.accentColor, '#7057d9');
});

test('optional profiles normalize empty and invalid values without requiring a name or photo', () => {
  assert.deepEqual(P.normalizeProfile(), { firstName: '', lastName: '', nickname: '', personKey: '', avatarPath: '' });
  assert.deepEqual(P.normalizeProfile({
    firstName: ' Ada ', lastName: 'Lovelace', nickname: '', personKey: 'Daphne', avatarPath: 'not-a-storage-path'
  }), { firstName: 'Ada', lastName: 'Lovelace', nickname: '', personKey: 'Daphne', avatarPath: '' });
  assert.equal(P.normalizeProfile({ avatarPath: '11111111-1111-4111-8111-111111111111/profile.jpg' }).avatarPath,
    '11111111-1111-4111-8111-111111111111/profile.jpg');
});

test('personal style settings clamp numeric values and reject unsupported choices', () => {
  const ui = P.normalize({ ui: {
    fontFamily: 'Comic Sans', fontSize: 99, fontWeight: 900, lineHeight: 3,
    radius: -10, spacing: 0.1, density: 'huge'
  } }, [], D).ui;
  assert.equal(ui.fontFamily, 'system');
  assert.equal(ui.fontSize, 24);
  assert.equal(ui.fontWeight, 400);
  assert.equal(ui.lineHeight, 2);
  assert.equal(ui.radius, 0);
  assert.equal(ui.spacing, 0.75);
  assert.equal(ui.density, 'comfortable');
});
