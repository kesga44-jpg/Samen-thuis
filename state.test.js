import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, loadState, mergeState, persistState } from '../state.js';

test('merges legacy partial backups without discarding defaults', () => {
  const merged = mergeState(defaultState(), { tasks: [{ text: 'Oude taak' }], budget: { monthly: 75 } });
  assert.equal(merged.tasks.length, 1);
  assert.equal(merged.tasks[0].text, 'Oude taak');
  assert.equal(typeof merged.tasks[0].id, 'string');
  assert.deepEqual(merged.budget.items, []);
  assert.equal(merged.budget.monthly, 75);
  assert.equal(merged.version, 2);
});

test('rejects invalid top-level schemas and repairs malformed known values', () => {
  assert.throws(() => mergeState(defaultState(), []), /JSON-object/);
  assert.throws(() => mergeState(defaultState(), { tasks: {} }), /Ongeldige lijst/);
  const merged = mergeState(defaultState(), {
    tasks: [null, 'broken', { id: 7, done: 'yes', text: 'Veilig' }],
    weather: { place: 'Nergens', lat: 1000, lon: 4 },
    budget: { monthly: -5, items: [null, { name: 'Boodschap', amount: 12 }] }
  });
  assert.equal(merged.tasks.length, 1);
  assert.equal(merged.tasks[0].done, false);
  assert.equal(merged.weather.place, 'Amsterdam');
  assert.equal(merged.budget.monthly, 0);
  assert.equal(merged.budget.items.length, 1);
});

test('loads and persists data using the existing localStorage key', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const state = mergeState(defaultState(), { showQuote: false });
  persistState(state, storage);
  assert.equal(loadState(storage).showQuote, false);
  assert.ok(values.has('samenThuisV2'));
});
