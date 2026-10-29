const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs');
const H = require('./household-sync-core.js');

// Fake server die RLS/versiecontrole van de migratie nabootst.
function server() {
  const st = { members: { hh1: new Set(['A', 'B']) }, state: {}, legacy: {} };
  const client = user => H.createCloud({
    url: 'https://x.supabase.co', anonKey: 'k', getToken: async () => user,
    fetchImpl: async (u, o = {}) => {
      const ok = (b, s = 200) => ({ ok: s < 300, status: s, json: async () => b });
      if (!user) return ok({ message: 'JWT' }, 401);
      const member = hid => st.members[hid] && st.members[hid].has(user);
      if (u.includes('/household_state?')) {
        const hid = decodeURIComponent(u.split('household_id=eq.')[1]);
        if (!member(hid)) return ok([]); // RLS: leeg resultaat
        return ok(Object.entries(st.state[hid] || {}).map(([section, r]) => ({ section, ...r })));
      }
      const body = o.body ? JSON.parse(o.body) : {};
      if (u.endsWith('/rpc/put_household_state')) {
        if (!member(body.p_household)) return ok({ code: '42501', message: 'Geen toegang' }, 403);
        const t = st.state[body.p_household] = st.state[body.p_household] || {}, cur = t[body.p_section];
        if (!cur ? body.p_expected_version !== 0 : cur.version !== body.p_expected_version) return ok({ code: '40001', message: 'Versieconflict' }, 400);
        t[body.p_section] = { payload: body.p_payload, version: cur ? cur.version + 1 : 1 };
        return ok(t[body.p_section].version);
      }
      throw new Error('onverwacht ' + u);
    }
  });
  return { st, client };
}
const enc = async v => ({ enc: JSON.stringify(v) }), dec = async p => { if (!p || !p.enc) throw new Error('huishoudcode'); return JSON.parse(p.enc); };
const run = (cloud, local, extra = {}) => H.runAccountSync({ cloud, householdId: 'hh1', local, encrypt: enc, decrypt: dec, ...extra });
const D = o => ({ meta: {}, settings: { householdCode: 'geheim' }, tasks: [], notes: [], ...o });

test('instellingen en meta worden nooit gesynchroniseerd', async () => {
  const s = server(), r = await run(s.client('A'), D({ tasks: [{ id: 1 }] }));
  assert.deepEqual(Object.keys(s.st.state.hh1), ['tasks']);
  assert.deepEqual(r.pushed, ['tasks']);
});
test('twee leden: wijziging van A komt bij B, zonder volledige state', async () => {
  const s = server(); let a = D({ tasks: [{ id: 1 }], notes: ['x'] });
  const ra = await run(s.client('A'), a);
  const rb = await run(s.client('B'), D(), {});
  assert.deepEqual(rb.pulls.tasks, [{ id: 1 }]);
  a = D({ tasks: [{ id: 1 }, { id: 2 }], notes: ['x'] });
  const ra2 = await run(s.client('A'), a, { base: ra.base });
  assert.deepEqual(ra2.pushed, ['tasks']); // alleen gewijzigd onderdeel
});
test('autorisatie: niet-lid en afgemeld krijgen niets en kunnen niet schrijven', async () => {
  const s = server(); await run(s.client('A'), D({ tasks: [1] }));
  const rc = await run(s.client('C'), D({ tasks: [9] }), {});
  assert.equal(rc.status, 'partial'); assert.equal(rc.failed[0].error.kind, 'auth'); assert.deepEqual(rc.pulls, {});
  assert.equal(s.st.state.hh1.tasks.version, 1);
  const out = await run(s.client(null), D()).catch(e => e);
  assert.equal(H.classifyError(out).kind, 'auth');
});
test('versieconflict: beide leden wijzigen -> conflict, niets overschreven', async () => {
  const s = server(), ra = await run(s.client('A'), D({ tasks: [1] }));
  const rb = await run(s.client('B'), D());
  await run(s.client('A'), D({ tasks: [1, 2] }), { base: ra.base });
  const c = await run(s.client('B'), D({ tasks: [1, 3] }), { base: rb.base });
  assert.equal(c.status, 'conflict'); assert.equal(c.conflicts[0].section, 'tasks');
  assert.deepEqual(JSON.parse(s.st.state.hh1.tasks.payload.enc), [1, 2]);
  const keep = await run(s.client('B'), D({ tasks: [1, 3] }), { base: rb.base, resolutions: { tasks: 'local' } });
  assert.deepEqual(keep.pushed, ['tasks']);
  assert.deepEqual(JSON.parse(s.st.state.hh1.tasks.payload.enc), [1, 3]);
});
test('race: server weigert verouderde versie met 40001 -> conflict, geen dataverlies', async () => {
  const s = server(), ra = await run(s.client('A'), D({ tasks: [1] }));
  const cloud = s.client('B'), orig = cloud.readState;
  cloud.readState = async hid => { const r = await orig(hid); await run(s.client('A'), D({ tasks: [1, 'a'] }), { base: ra.base }); return r; };
  const r = await run(cloud, D({ tasks: [1, 'b'] }), { base: ra.base });
  assert.equal(r.status, 'conflict'); assert.equal(r.conflicts[0].raced, true);
});
test('offline: netwerkfout wordt herkend en laat lokale data ongemoeid', async () => {
  const cloud = H.createCloud({ url: 'https://x', anonKey: 'k', getToken: async () => 't', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  const local = D({ tasks: [1] }), copy = JSON.stringify(local);
  const e = await run(cloud, local).catch(x => x);
  assert.equal(H.classifyError(e).kind, 'network'); assert.equal(JSON.stringify(local), copy);
});
test('legacy-import: oude cloudrij wordt voorgesteld, lokale wijzigingen worden niet stilzwijgend overschreven', async () => {
  const s = server();
  s.st.state.hh1 = { legacy_full: { version: 1, payload: { enc: JSON.stringify({ tasks: ['oud'], notes: ['n'] }) } } };
  const empty = await run(s.client('A'), D());
  assert.deepEqual(empty.pulls, { tasks: ['oud'], notes: ['n'] }); // lege lokale data haalt cloud op
  const full = await run(s.client('B'), D({ tasks: ['lokaal'], notes: ['n'] }));
  assert.equal(full.status, 'conflict'); assert.deepEqual(full.conflicts.map(c => c.section), ['tasks']);
  assert.ok(s.st.state.hh1.legacy_full, 'legacy rij blijft onaangetast');
  assert.ok(!s.st.state.hh1.tasks, 'niets geschreven bij conflict');
});
test('lege lokale data overschrijft nooit gevulde cloud (ook na accountwissel zonder base)', async () => {
  const s = server(); await run(s.client('A'), D({ tasks: [1] }));
  const r = await run(s.client('B'), D(), { base: {} });
  assert.deepEqual(r.pushed, []); assert.deepEqual(r.pulls.tasks, [1]);
});
test('herstelvlag (hold): lokaal herstel pusht niet automatisch over cloud heen', async () => {
  const s = server(), ra = await run(s.client('A'), D({ tasks: [1] }));
  const r = await run(s.client('A'), D({ tasks: ['hersteld'] }), { base: ra.base, hold: true });
  assert.equal(r.status, 'conflict'); assert.equal(s.st.state.hh1.tasks.version, 1);
});
test('verkeerde huishoudcode stopt vóór schrijven', async () => {
  const s = server(); s.st.state.hh1 = { tasks: { version: 1, payload: { bad: 1 } } };
  const e = await run(s.client('A'), D({ tasks: [5] })).catch(x => x);
  assert.equal(H.classifyError(e).kind, 'key'); assert.equal(s.st.state.hh1.tasks.version, 1);
});
test('client bevat geen service-role key en migratie sluit aan op clientnamen', () => {
  const sql = fs.readFileSync(__dirname + '/supabase/migrations/20261014000000_household_state_sync.sql', 'utf8');
  const js = fs.readFileSync(__dirname + '/household-sync-core.js', 'utf8');
  assert.doesNotMatch(js, /service_role/i);
  for (const n of ['put_household_state', 'import_legacy_household_data']) { assert.match(sql, new RegExp('function public\\.' + n)); assert.match(js, new RegExp(n)); }
  for (const p of ['p_household', 'p_section', 'p_payload', 'p_expected_version', 'p_legacy_id']) { assert.match(sql, new RegExp(p)); assert.match(js, new RegExp(p)); }
  assert.match(sql, /household_state/); assert.match(js, /household_state\?select=section,payload,version,updated_at/);
});

// ---- Aanvullende risico's (gesimuleerd met nepserver; geen bewijs voor live RLS/Supabase) ----
test('route: ingeschakeld blijft accountroute zonder sessie (geen stille terugval naar anon-sync)', () => {
  assert.equal(H.syncRoute({}, true), 'legacy');
  assert.equal(H.syncRoute({ enabled: true }, true), 'account');
  assert.equal(H.syncRoute({ enabled: true }, false), 'account-signed-out');
  assert.equal(H.shouldEnable('ok'), true); assert.equal(H.shouldEnable('conflict'), true);
  for (const s of ['offline', 'network', 'migration', 'auth', 'partial', 'error', 'signed-out']) assert.equal(H.shouldEnable(s), false, s);
});
test('cloud kan apparaatinstellingen/gereserveerde onderdelen niet overschrijven', async () => {
  const s = server();
  s.st.state.hh1 = { settings: { version: 1, payload: { enc: JSON.stringify({ householdCode: 'gestolen' }) } }, meta: { version: 1, payload: { enc: '{"x":1}' } }, 'bad name': { version: 1, payload: { enc: '1' } } };
  const r = await run(s.client('A'), D({ tasks: [1] }));
  assert.deepEqual(r.pulls, {}); assert.ok(!('settings' in r.base) && !('meta' in r.base));
});
test('twee apparaten wijzigen hetzelfde onderdeel én verschillende onderdelen', async () => {
  const s = server(), a0 = await run(s.client('A'), D({ tasks: [1], notes: ['n'] })), b0 = await run(s.client('B'), D());
  await run(s.client('A'), D({ tasks: [1, 'a'], notes: ['n'] }), { base: a0.base });          // A wijzigt tasks
  const b1 = await run(s.client('B'), D({ tasks: [1], notes: ['n', 'b'] }), { base: b0.base }); // B wijzigt notes
  assert.equal(b1.status, 'ok'); assert.deepEqual(b1.pulls.tasks, [1, 'a']); assert.deepEqual(b1.pushed, ['notes']);
  assert.deepEqual(JSON.parse(s.st.state.hh1.tasks.payload.enc), [1, 'a'], 'tasks niet overschreven door B');
});
test('conflictkeuze voor één onderdeel raakt een ander onderdeel niet', async () => {
  const s = server(), a0 = await run(s.client('A'), D({ tasks: [1], notes: ['n'] })), b0 = await run(s.client('B'), D());
  await run(s.client('A'), D({ tasks: ['A'], notes: ['A'] }), { base: a0.base });
  const c = await run(s.client('B'), D({ tasks: ['B'], notes: ['B'] }), { base: b0.base });
  assert.deepEqual(c.conflicts.map(x => x.section).sort(), ['notes', 'tasks']);
  const r = await run(s.client('B'), D({ tasks: ['B'], notes: ['B'] }), { base: b0.base, resolutions: { tasks: 'local' } });
  assert.deepEqual(r.pushed, ['tasks']); assert.deepEqual(r.conflicts.map(x => x.section), ['notes']);
  assert.deepEqual(JSON.parse(s.st.state.hh1.notes.payload.enc), ['A'], 'notes ongemoeid');
});
test('accountwissel met openstaand conflict: basisstand van account A geldt niet voor account B', async () => {
  const s = server(), a0 = await run(s.client('A'), D({ tasks: [1] }));
  await run(s.client('B'), D({ tasks: [1, 'b'] }), { base: a0.base });
  // Zelfde lokale data, maar B heeft een eigen (lege) basis: geen stille push over de cloud heen.
  const r = await run(s.client('B'), D({ tasks: ['andere'] }), { base: {} });
  assert.equal(r.status, 'conflict'); assert.equal(s.st.state.hh1.tasks.version, 2);
});
test('offline wijzigingen worden bij hervatten gepusht; tussentijdse cloudwijziging geeft conflict', async () => {
  const s = server(), a0 = await run(s.client('A'), D({ tasks: [1], notes: ['n'] }));
  const off = H.createCloud({ url: 'https://x', anonKey: 'k', getToken: async () => 'A', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  const local = D({ tasks: [1, 'offline'], notes: ['n'] });
  assert.equal(H.classifyError(await run(off, local, { base: a0.base }).catch(e => e)).kind, 'network');
  const resumed = await run(s.client('A'), local, { base: a0.base });
  assert.deepEqual(resumed.pushed, ['tasks']);
  const b0 = await run(s.client('B'), D(), {});
  await run(s.client('B'), D({ tasks: ['B'], notes: ['n'] }), { base: b0.base, resolutions: { tasks: 'local' } });
  const again = await run(s.client('A'), D({ tasks: [1, 'offline', 'x'], notes: ['n'] }), { base: resumed.base });
  assert.equal(again.status, 'conflict');
});
test('mislukte migratie/RPC: ontbrekende functie of tabel -> duidelijke melding met vervolgstap, lokale data intact', async () => {
  for (const [status, code] of [[404, 'PGRST202'], [404, 'PGRST205'], [400, '42P01']]) {
    const cloud = H.createCloud({ url: 'https://x', anonKey: 'k', getToken: async () => 't', fetchImpl: async () => ({ ok: false, status, json: async () => ({ code, message: 'x' }) }) });
    const local = D({ tasks: [1] }), copy = JSON.stringify(local);
    const e = await run(cloud, local).catch(x => x), c = H.classifyError(e);
    assert.equal(c.kind, 'migration'); assert.match(c.message, /migraties/); assert.equal(JSON.stringify(local), copy);
  }
});
test('deels mislukte push: gelukte onderdelen krijgen basisversie, mislukte niet (volgende ronde probeert opnieuw)', async () => {
  const s = server(), real = s.client('A'), orig = real.putState;
  real.putState = async (h, sec, p, v) => { if (sec === 'notes') throw new H.CloudError(500, { message: 'boem' }); return orig(h, sec, p, v); };
  const r = await run(real, D({ tasks: [1], notes: ['n'] }));
  assert.equal(r.status, 'partial'); assert.ok(r.base.tasks && !r.base.notes); assert.equal(r.failed[0].section, 'notes');
  const retry = await run(s.client('A'), D({ tasks: [1], notes: ['n'] }), { base: r.base });
  assert.deepEqual(retry.pushed, ['notes']);
});
test('dubbele/deels mislukte legacy-import: legacy_full wordt niet naar lokale data of cloud overschreven', async () => {
  const s = server();
  s.st.state.hh1 = { legacy_full: { version: 1, payload: { enc: JSON.stringify({ tasks: ['oud'] }) } } };
  const r1 = await run(s.client('A'), D({ tasks: ['oud'] }));          // gelijk -> adopt
  const r2 = await run(s.client('B'), D({ tasks: ['oud'] }), { base: r1.base });
  assert.deepEqual(r2.pushed, []); assert.deepEqual(r2.conflicts, []);
  assert.deepEqual(Object.keys(s.st.state.hh1), ['legacy_full'], 'niets onnodig geschreven');
});
test('rollback/herstel na mislukte overstap: foutieve ronde schrijft geen basisstand en geen lokale pulls', async () => {
  const cloud = H.createCloud({ url: 'https://x', anonKey: 'k', getToken: async () => 't', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ message: 'serverfout' }) }) });
  const e = await run(cloud, D({ tasks: [1] })).catch(x => x);
  assert.ok(e instanceof H.CloudError); assert.equal(H.classifyError(e).kind, 'other');
});
