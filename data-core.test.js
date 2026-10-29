const test = require('node:test');
const assert = require('node:assert/strict');
const { hasConcurrentChanges, mergeUnique, nextDue, normalizeFuelMateFill, preserveUnknownFields, resolveSyncConflict, createConflictStore, sameData, remoteChangedSinceChoice, conditionalUpdateSucceeded, preserveCorruptData, loadWithRecovery, listCorruptBackups, restoreCorruptBackup, planSync, restoreBackupText } = require('./data-core.js');

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
  assert.throws(() => resolveSyncConflict(conflict, 'other', value => structuredClone(value), '2026-10-03'), /geldige synchronisatieversie/);
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
  assert.equal(remoteChangedSinceChoice(reloaded.remoteData, { ...reloaded.remoteData, value: 'new remote edit' }), true);
  assert.equal(remoteChangedSinceChoice(reloaded.remoteData, reloaded.remoteData), false);
  assert.equal(conditionalUpdateSucceeded([{ updated_at: '2026-10-02' }]), true);
  assert.equal(conditionalUpdateSucceeded([]), false);
});

test('smart recurrence uses the actual completion date and clamps month ends', () => {
  assert.equal(nextDue('2026-01-31', '', 'Maandelijks'), '2026-02-28');
  assert.equal(nextDue('2026-10-01', '2026-09-20', 'Wekelijks'), '2026-10-08');
  assert.equal(nextDue('', '2026-10-07', 'Eenmalig'), '2026-10-07');
  assert.equal(nextDue('2026-10-01', '', 'Eenmalig'), '');
  assert.equal(nextDue('2026-10-01', '', 'Wanneer nodig'), '');
});

function fakeStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; }

test('corrupt storage is preserved once and empty storage is ignored', () => {
  const s = fakeStorage();
  assert.equal(preserveCorruptData(s, '', 'bak', 't1'), false);
  assert.equal(s.getItem('bak'), null);
  assert.equal(preserveCorruptData(s, '{kapot', 'bak', 't1'), true);
  assert.equal(preserveCorruptData(s, '{kapot', 'bak', 't2'), true);
  const saved = JSON.parse(s.getItem('bak'));
  assert.equal(saved.raw, '{kapot');
  assert.equal(saved.items.length, 1);
  preserveCorruptData(s, '{ander', 'bak', 't3');
  assert.equal(JSON.parse(s.getItem('bak')).items.length, 2);
});

test('preserveCorruptData reports failure when storage is full', () => {
  const s = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assert.equal(preserveCorruptData(s, '{kapot', 'bak', 't1'), false);
});

const K = { storageKey: 'd', legacyKey: 'old', backupKey: 'pre', backupAtKey: 'preAt', corruptKey: 'bad', preRestoreKey: 'prr' };
const opts = { ...K, migrate: d => { if (d.boom) throw new Error('migratie'); return { ...d, migrated: true }; }, fresh: () => ({ fresh: true }), now: () => 'nu' };

test('loadData route: empty storage gives fresh data and writes nothing', () => {
  const s = fakeStorage();
  const r = loadWithRecovery(s, opts);
  assert.deepEqual(r, { data: { fresh: true }, status: 'empty' });
  assert.equal(s.getItem('bad'), null);
  assert.equal(s.getItem('pre'), null);
});

test('loadData route: valid data is migrated and snapshotted once', () => {
  const s = fakeStorage(); s.setItem('d', '{"a":1}');
  assert.equal(loadWithRecovery(s, opts).status, 'ok');
  assert.equal(s.getItem('pre'), '{"a":1}');
  s.setItem('d', '{"a":2}');
  loadWithRecovery(s, opts);
  assert.equal(s.getItem('pre'), '{"a":1}');
});

test('loadData route: invalid JSON is preserved, never snapshotted, falls back to fresh', () => {
  const s = fakeStorage(); s.setItem('d', '{kapot');
  const r = loadWithRecovery(s, opts);
  assert.equal(r.status, 'fresh');
  assert.equal(s.getItem('pre'), null);
  assert.equal(JSON.parse(s.getItem('bad')).items[0].raw, '{kapot');
  assert.equal(s.getItem('d'), '{kapot');
});

test('loadData route: non-object JSON is treated as corrupt', () => {
  const s = fakeStorage(); s.setItem('d', '[1,2]');
  assert.equal(loadWithRecovery(s, opts).status, 'fresh');
  assert.equal(JSON.parse(s.getItem('bad')).items[0].raw, '[1,2]');
});

test('loadData route: migration failure recovers from safety snapshot and keeps source', () => {
  const s = fakeStorage(); s.setItem('pre', '{"ok":1}'); s.setItem('d', '{"boom":true}');
  const r = loadWithRecovery(s, opts);
  assert.equal(r.status, 'recovered');
  assert.equal(r.data.ok, 1);
  assert.equal(JSON.parse(s.getItem('bad')).items[0].raw, '{"boom":true}');
});

test('loadData route: failing snapshot falls back to fresh, source preserved', () => {
  const s = fakeStorage(); s.setItem('pre', '{kapot2'); s.setItem('d', '{"boom":true}');
  assert.equal(loadWithRecovery(s, opts).status, 'fresh');
  assert.equal(JSON.parse(s.getItem('bad')).items[0].raw, '{"boom":true}');
});

test('corrupt backups are listed with validity and restored only when valid', () => {
  const s = fakeStorage(); s.setItem('d', '{"boom":true}');
  loadWithRecovery(s, opts);
  preserveCorruptData(s, '{"x":1}', 'bad', 't');
  const list = listCorruptBackups(s, 'bad', opts.migrate);
  assert.deepEqual(list.map(i => i.valid), [false, true]);
  assert.throws(() => restoreCorruptBackup(s, opts, 0));
  assert.equal(s.getItem('d'), '{"boom":true}');
  assert.throws(() => restoreCorruptBackup(s, opts, 9));
  const data = restoreCorruptBackup(s, opts, 1);
  assert.equal(data.x, 1);
  assert.equal(JSON.parse(s.getItem('d')).x, 1);
  assert.equal(s.getItem('prr'), '{"boom":true}');
  assert.deepEqual(listCorruptBackups(fakeStorage(), 'bad', opts.migrate), []);
});

test('loadData route: failed corrupt-backup write is reported via preserved=false and source stays untouched', () => {
  const m = { d: '{kapot' };
  const s = { getItem: k => (k in m ? m[k] : null), setItem(k, v) { if (k === 'bad') throw new Error('quota'); m[k] = v; } };
  const r = loadWithRecovery(s, opts);
  assert.equal(r.status, 'fresh');
  assert.equal(r.preserved, false);
  assert.equal(m.d, '{kapot');
});

test('restore hold: a restored copy that differs from cloud data is detected by sameData', () => {
  assert.equal(sameData({ a: 1, meta: { updatedAt: 'x' } }, { meta: { updatedAt: 'x' }, a: 1 }), true);
  assert.equal(sameData({ a: 1 }, { a: 2 }), false);
});

test('restore sets hold first; failing storage keeps original data and no hold', () => {
  const m = { d: '{kapot', bad: JSON.stringify({ items: [{ raw: '{"x":1}', at: 't' }] }) };
  const mk = failKey => ({ getItem: k => (k in m ? m[k] : null), removeItem: k => { delete m[k]; }, setItem(k, v) { if (k === failKey) throw new Error('quota'); m[k] = v; } });
  const o = { ...opts, holdKey: 'hold' };
  assert.throws(() => restoreCorruptBackup(mk('hold'), o, 0));
  assert.equal(m.d, '{kapot'); assert.equal(m.hold, undefined);
  assert.throws(() => restoreCorruptBackup(mk('prr'), o, 0));
  assert.equal(m.d, '{kapot'); assert.equal(m.hold, undefined);
  const data = restoreCorruptBackup(mk(''), o, 0);
  assert.equal(data.x, 1); assert.equal(m.hold, '1');
});

test('planSync: restore hold never auto-overwrites differing cloud data', () => {
  const local = { a: 1, meta: { updatedAt: '2026-10-10T10:00:00Z' } };
  const remote = { a: 2, meta: { updatedAt: '2026-10-01T10:00:00Z' } };
  const base = { local, remote, lastSyncedAt: '2026-10-11T00:00:00Z' };
  assert.equal(planSync({ ...base, hold: true }), 'conflict');
  assert.equal(planSync({ ...base, hold: false }), 'upload');
  assert.equal(planSync({ ...base, hold: true, resolution: 'remote' }), 'remote');
  assert.equal(planSync({ ...base, hold: true, resolution: 'local' }), 'upload');
  assert.equal(planSync({ ...base, hold: true, remote: local }), 'none');
  assert.equal(planSync({ ...base, hold: true, remote: null }), 'upload');
  const fresh = { meta: { updatedAt: new Date(0).toISOString() } };
  assert.equal(planSync({ local: fresh, remote, hold: false, lastSyncedAt: '' }), 'remote');
});

test('backup import: hold set, current data copied, imported updatedAt kept, next sync asks for a choice', () => {
  const s = fakeStorage(); s.setItem('d', '{"cur":1}');
  const text = JSON.stringify({ x: 1, meta: { updatedAt: '2026-10-19T00:00:00Z' } });
  const data = restoreBackupText(s, { ...opts, holdKey: 'hold' }, text);
  assert.equal(s.getItem('hold'), '1');
  assert.equal(s.getItem('prr'), '{"cur":1}');
  assert.equal(JSON.parse(s.getItem('d')).x, 1);
  assert.equal(data.meta.updatedAt, '2026-10-19T00:00:00Z');
  const cloud = { x: 2, meta: { updatedAt: '2026-10-01T00:00:00Z' } };
  assert.equal(planSync({ local: data, remote: cloud, hold: !!s.getItem('hold'), lastSyncedAt: '2026-10-19T00:00:00Z' }), 'conflict');
  assert.equal(planSync({ local: data, remote: null, hold: true }), 'upload');
});

test('backup import: invalid file changes nothing; failing storage keeps data, copy and no hold', () => {
  const s = fakeStorage(); s.setItem('d', '{"cur":1}');
  const o = { ...opts, holdKey: 'hold' };
  assert.throws(() => restoreBackupText(s, o, '{kapot'));
  assert.throws(() => restoreBackupText(s, o, '[1]'));
  assert.equal(s.getItem('d'), '{"cur":1}'); assert.equal(s.getItem('hold'), null); assert.equal(s.getItem('prr'), null);
  const m = { d: '{"cur":1}', prr: 'eerdere-kopie' };
  const f = { getItem: k => (k in m ? m[k] : null), removeItem: k => { delete m[k]; }, setItem(k, v) { if (k === 'd') throw new Error('quota'); m[k] = v; } };
  assert.throws(() => restoreBackupText(f, o, '{"x":1}'));
  assert.equal(m.d, '{"cur":1}'); assert.equal(m.hold, undefined); assert.equal(m.prr, '{"cur":1}');
});
