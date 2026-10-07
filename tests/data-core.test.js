const test = require('node:test');
const assert = require('node:assert/strict');
const { hasConcurrentChanges, mergeUnique, nextDue, normalizeFuelMateFill, preserveUnknownFields, resolveSyncConflict, createConflictStore, sameData } = require('../data-core.js');

test('concurrent sync edits are detected after a shared baseline', () => {
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:01:00Z', '2026-10-07T09:00:00Z'), true);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', { value: 'local' }, { value: 'remote' }), true);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', { value: 'same' }, { value: 'same' }), false);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', { b: 2, a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T09:00:00Z', '2026-10-07T09:00:00Z'), false);
  assert.equal(hasConcurrentChanges('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z', ''), false);
});

test('mergeUnique preserves existing rows and skips duplicate incoming rows', () => {
  const rows = mergeUnique([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }, { id: 'b' }], row => row.id);
  assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }]);
});

test('migration preserves cloned unknown data without overriding known defaults', () => {
  const source = { futureModule: { enabled: true }, planning: ['legacy'] };
  const migrated = { planning: [], standard: true };
  preserveUnknownFields(source, migrated, value => structuredClone(value));
  assert.deepEqual(migrated, { futureModule: { enabled: true }, planning: [], standard: true });
  assert.notEqual(migrated.futureModule, source.futureModule);
});

test('FuelMate fillups normalize aliases, derive unit price, and retain flags', () => {
  assert.deepEqual(normalizeFuelMateFill({
    datetime: '2026-10-02T10:30:00Z',
    mileage: '120500',
    volume: '40,5',
    totalCost: '81',
    station: 'Tankstation',
    partial: 1,
    missedFill: 'ja',
    fuelType: 'E10'
  }, 'car-1', 'fill-1'), {
    id: 'fill-1',
    carId: 'car-1',
    date: '2026-10-02',
    odometer: 120500,
    liters: 40.5,
    total: 81,
    pricePerLiter: 2,
    fuelGrade: 'E10',
    station: 'Tankstation',
    partialFill: true,
    missedPrevious: true,
    note: ''
  });
});

test('conflict choice clones the selected version and advances local data timestamp', () => {
  const conflict = {
    localData: { meta: { updatedAt: '2026-10-01' }, value: 'local' },
    remoteData: { meta: { updatedAt: '2026-10-02' }, value: 'remote' }
  };
  const local = resolveSyncConflict(conflict, 'local', value => structuredClone(value), '2026-10-03');
  assert.deepEqual(local, { choice: 'local', data: { meta: { updatedAt: '2026-10-03' }, value: 'local' } });
  assert.equal(conflict.localData.meta.updatedAt, '2026-10-01');
  assert.deepEqual(resolveSyncConflict(conflict, 'remote', value => structuredClone(value), '2026-10-03'), {
    choice: 'remote', data: conflict.remoteData
  });
  assert.deepEqual(resolveSyncConflict({ localData: { value: 'legacy' }, remoteData: {} }, 'local', value => structuredClone(value), '2026-10-03'), {
    choice: 'local', data: { value: 'legacy', meta: { updatedAt: '2026-10-03' } }
  });
});

test('conflict store retains state through storage failures and clears after resolution', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key)
  };
  const store = createConflictStore(storage, 'conflict');
  const conflict = { localData: { value: 'local' }, remoteData: { value: 'remote' } };
  assert.equal(store.store(conflict), true);
  assert.deepEqual(store.get(), conflict);
  assert.equal(store.clear(), true);
  assert.equal(store.get(), null);

  storage.setItem = () => { throw new Error('storage full'); };
  assert.equal(store.store(conflict), false);
  assert.deepEqual(store.get(), conflict);
});

test('conflict resolution is resumable after reload and detects a changed remote snapshot', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key)
  };
  const conflict = {
    localData: { meta: { updatedAt: '2026-10-01' }, value: 'local' },
    remoteData: { meta: { updatedAt: '2026-10-02' }, value: 'remote' }
  };
  const selection = resolveSyncConflict(conflict, 'remote', value => structuredClone(value), '2026-10-03');
  const store = createConflictStore(storage, 'conflict');
  store.store({ ...conflict, resolution: selection.choice, selectedData: selection.data });

  const reloaded = createConflictStore(storage, 'conflict').get();
  assert.equal(reloaded.resolution, 'remote');
  assert.deepEqual(reloaded.selectedData, conflict.remoteData);
  assert.equal(sameData(reloaded.remoteData, { value: 'remote', meta: { updatedAt: '2026-10-02' } }), true);
  assert.equal(sameData(reloaded.remoteData, { ...reloaded.remoteData, value: 'new remote edit' }), false);
});

test('smart recurrence uses the actual completion date and clamps month ends', () => {
  assert.equal(nextDue('2026-01-31', '', 'Maandelijks'), '2026-02-28');
  assert.equal(nextDue('2026-10-01', '2026-09-20', 'Wekelijks'), '2026-10-08');
  assert.equal(nextDue('', '2026-10-07', 'Eenmalig'), '2026-10-07');
  assert.equal(nextDue('2026-10-01', '', 'Eenmalig'), '');
  assert.equal(nextDue('2026-10-01', '', 'Wanneer nodig'), '');
});
