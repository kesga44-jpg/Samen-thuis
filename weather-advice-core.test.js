const test = require('node:test'), assert = require('node:assert/strict');
const W = require('./weather-advice-core.js');
test('kledingadvies per temperatuur, regen en wind', () => {
  assert.deepEqual(W.advice({ apparent_temperature: 3 }, {}).items.map(i => i.id), ['coat', 'sweater', 'pants', 'scarf']);
  const a = W.advice({ apparent_temperature: 20, wind_speed_10m: 35, weather_code: 0 }, { precipitation_probability_max: [60] });
  assert.deepEqual(a.items.map(i => i.id), ['tshirt', 'pants', 'umbrella', 'wind', 'sunglasses']);
  assert.equal(W.advice({}, {}), null);
  a.items.forEach(i => assert.match(W.icon(i.id), /<svg/));
});
test('lucht/pollen met bron en tijdstip; geen metingen -> null', () => {
  const s = W.airSummary({ current: { time: '2026-10-20T10:00', european_aqi: 35, grass_pollen: 25, birch_pollen: 0 } });
  assert.equal(s.label, 'Goed'); assert.equal(s.pollen[0].name, 'Gras'); assert.equal(s.pollen[0].level, 'Matig'); assert.equal(s.time, '2026-10-20T10:00'); assert.match(s.source, /Open-Meteo/);
  assert.equal(W.airSummary({}), null); assert.equal(W.airSummary({ current: {} }), null);
});
