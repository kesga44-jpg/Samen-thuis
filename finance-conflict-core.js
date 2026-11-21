/* Financiële conflictbeveiliging (opdracht 4).
   Regels:
   - Financieel = expliciet genoemde onderdelen in FINANCIAL_SECTIONS (geen zoekwoorden).
   - Een conflict op hetzelfde veld wordt nooit automatisch gekozen. Er komt één record per onderdeel met basis, lokale en
     concurrerende waarde, gebruikers, tijdstippen en het onderdeel. Zolang het openstaat of op bevestiging wacht, wordt het
     onderdeel niet geüpload (andere onderdelen synchroniseren door).
   - Oplossen = per veld expliciet kiezen tussen beide waarden. Het record verdwijnt pas als de gekozen waarde lokaal is
     opgeslagen én de server een versie heeft bevestigd én de versie-administratie duurzaam is vastgelegd.
   - Na bevestiging wordt per veld alleen de hash van de afgewezen waarde onthouden (30 dagen). Komt die waarde via een oude
     kopie op dit apparaat terug, dan opent er opnieuw een conflict in plaats van een stille upload.
   - De audit bevat paden, hashes, versies, gebruikers-id's en tijdstippen, maar geen bedragen.
   Opslag via de metastore (sync-meta-store.js): getRecord/listRecords/putRecord/updateRecord/deleteRecord. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisFinanceConflicts = core;
})(globalThis, function () {
  'use strict';

  // Centrale, expliciete definitie. Nieuw financieel onderdeel? Hier toevoegen (en een test in finance-conflicts.test.js).
  // fuelEntries (tankbeurten met bedragen) sinds opdracht 6.
  const FINANCIAL_SECTIONS = Object.freeze(['budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23', 'fuelEntries']);
  const WHOLE = '(onderdeel)';
  const GUARD_TTL_MS = 30 * 24 * 3600 * 1000;
  const MAX_AUDIT = 300;

  const isFinancialSection = s => FINANCIAL_SECTIONS.includes(s);
  function parsePath(path) {
    const out = []; const re = /\[([^\]]*)\]|([^.[\]]+)/g; let m;
    while ((m = re.exec(String(path)))) out.push(m[1] !== undefined ? { id: m[1] } : { key: m[2] });
    return out;
  }
  const isFinancialPath = path => { const first = parsePath(path)[0]; return !!(first && first.key && isFinancialSection(first.key)); };
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  function valueAt(obj, path) {
    if (path === WHOLE || path === '') return obj;
    let cur = obj;
    for (const step of parsePath(path)) {
      if (cur == null) return undefined;
      cur = step.id !== undefined ? (Array.isArray(cur) ? cur.find(x => x && String(x.id) === step.id) : undefined) : (typeof cur === 'object' ? cur[step.key] : undefined);
    }
    return cur;
  }
  function setAt(obj, path, value) {
    const steps = parsePath(path);
    let cur = obj;
    for (let i = 0; i < steps.length - 1; i++) {
      const st = steps[i];
      cur = st.id !== undefined ? (Array.isArray(cur) ? cur.find(x => x && String(x.id) === st.id) : undefined) : (cur && typeof cur === 'object' ? cur[st.key] : undefined);
      if (cur == null || typeof cur !== 'object') return false;
    }
    const last = steps[steps.length - 1];
    if (!last) return false;
    if (last.id !== undefined) {
      if (!Array.isArray(cur)) return false;
      const idx = cur.findIndex(x => x && String(x.id) === last.id);
      if (value === undefined) { if (idx >= 0) cur.splice(idx, 1); return true; }
      if (idx < 0) cur.push(value); else cur[idx] = value;
      return true;
    }
    if (value === undefined) delete cur[last.key]; else cur[last.key] = value;
    return true;
  }

  // Openstaande conflictpaden (relatief aan het onderdeel), op basis van de actuele lokale waarde.
  function livePaths({ merge3, hashValue, base, local, remote, forcedPaths = [] }) {
    const opts = { conflicts: [] };
    merge3(base === null ? undefined : base, local, remote, opts);
    const paths = [...new Set(opts.conflicts)];
    for (const p of forcedPaths) {
      if (!paths.includes(p) && hashValue(valueAt(local, p)) !== hashValue(valueAt(remote, p))) paths.push(p);
    }
    return paths.map(path => ({ path, base: valueAt(base, path), local: valueAt(local, path), remote: valueAt(remote, path) }));
  }

  // choices: { [pad]: 'local' | 'remote' }. Niet-conflicterende verschillen worden gewoon samengevoegd.
  function resolveValue({ merge3, hashValue, base, local, remote, forcedPaths = [], choices = {} }) {
    const missing = [];
    const pick = (path, l, r) => {
      const c = choices[path];
      if (c === 'local') return clone(l);
      if (c === 'remote') return clone(r);
      if (!missing.includes(path)) missing.push(path);
      return clone(l);
    };
    let value = merge3(base === null ? undefined : clone(base), clone(local), clone(remote), { onConflict: pick });
    for (const p of forcedPaths) {
      const l = valueAt(local, p), r = valueAt(remote, p);
      if (hashValue(l) === hashValue(r)) continue;
      const v = pick(p, l, r);
      if (p === WHOLE) value = v; else setAt(value, p, v);
    }
    return { ok: missing.length === 0, value, missing };
  }

  // ---------- Scope (opdracht 5) ----------
  // Elk record hoort bij precies één scope:
  //   '<accountId>:<huishoudenId>'  identiteit (zelfde notatie als slot() in account-sync.js)
  //   'device'                      tabbladconflict ontstaan zonder bekende identiteit (niet aangemeld / geen huishouden)
  //   'legacy-unknown'              oud record waarvan de identiteit niet vast te stellen is (quarantaine, nooit verwerkt)
  // Een syncronde ziet uitsluitend records van de eigen identiteit. 'device'-records horen bij het lokale profiel
  // (opdracht 7: localKey = de lokale dataset waarin ze ontstonden) en zijn in een account niet zichtbaar, niet
  // toepasbaar en niet bepalend; bij de expliciete koppeling van het lokale profiel aan een account verhuizen ze mee
  // (adoptDevice).
  const DEVICE_SCOPE = 'device', LEGACY_SCOPE = 'legacy-unknown';
  const isIdentityScope = s => typeof s === 'string' && /^[^|:\s]+:[^|:\s]+$/.test(s);
  const isValidScope = s => s === DEVICE_SCOPE || isIdentityScope(s);
  const scopeFor = (accountId, householdId) => (accountId && householdId ? `${accountId}:${householdId}` : null);
  const recordKey = (scope, section) => 'fin|' + scope + '|' + section;
  const guardKey = (scope, section) => 'fing|' + scope + '|' + section;
  const choicesHash = (hashValue, choices) => hashValue(Object.keys(choices || {}).sort().map(k => [k, choices[k]]));

  function newRecord({ scope, section, origin, base, local, remote, remoteVersion = null, remoteUpdatedBy = null, remoteUpdatedAt = null, localUser = null, householdId = null, forcedPaths = [], localKey = null, now }) {
    const at = now();
    return {
      key: recordKey(scope, section), slot: scope, scope, kind: 'finance', section, origin, status: 'open', rev: 1,
      localKey: scope === DEVICE_SCOPE && typeof localKey === 'string' ? localKey : null,
      base: clone(base) ?? null, local: clone(local) ?? null, remote: clone(remote) ?? null,
      remoteVersion, remoteUpdatedBy, remoteUpdatedAt, localUser, householdId, forcedPaths: [...forcedPaths],
      detectedAt: at, updatedAt: at, resolution: null, confirmedVersion: null
    };
  }

  // Audit zonder bedragen: alleen paden, hashes, versies, gebruikers-id's, scope en tijdstippen.
  function auditEntry({ hashValue, action, record, paths = [], choices = null, actor = null, version = null, note = '', now }) {
    const at = now();
    const hashes = {};
    for (const p of paths) {
      hashes[p.path] = { base: hashValue(p.base ?? null), local: hashValue(p.local ?? null), remote: hashValue(p.remote ?? null), ...(choices && choices[p.path] ? { chosen: choices[p.path] } : {}) };
    }
    return {
      key: 'fina:' + at + ':' + Math.random().toString(36).slice(2, 8), slot: record.scope || null, scope: record.scope || null, kind: 'finance-audit', at,
      action, section: record.section, origin: record.origin, paths: paths.map(p => p.path), hashes,
      actor, remoteUser: record.remoteUpdatedBy || null, remoteVersion: record.remoteVersion ?? null, version, note
    };
  }

  function createFinanceConflicts({ store, merge3, hashValue, now = () => new Date().toISOString(), nowMs = () => Date.now() }) {
    if (!store || typeof merge3 !== 'function' || typeof hashValue !== 'function') throw new Error('createFinanceConflicts: store, merge3 en hashValue zijn vereist');
    const requireScope = (scope, { identity = false } = {}) => {
      if (identity ? !isIdentityScope(scope) : !isValidScope(scope)) throw new Error('Ongeldige of ontbrekende scope voor financiële conflicten: ' + scope);
    };

    async function audit(entry) {
      await store.putRecord(entry);
      const all = (await store.listRecords('finance-audit')).sort((a, b) => String(a.at).localeCompare(String(b.at)));
      if (all.length > MAX_AUDIT) for (const r of all.slice(0, all.length - MAX_AUDIT)) await store.deleteRecord(r.key);
    }

    // ---- Migratie van records zonder scope (opdracht 4: key 'fin:'+onderdeel) ----
    // Nooit stil verwijderen: eerst onder de nieuwe key bewaren, dan pas de oude key weghalen (alleen dezelfde revisie).
    // Identiteit uit het record zelf (localUser + householdId). Onbekend: tabbladconflict → 'device', anders quarantaine.
    let migration = null;
    function migrate() {
      return (migration ||= (async () => {
        for (const r of await store.listRecords('finance')) {
          if (r.scope) continue;
          const identity = scopeFor(r.localUser, r.householdId);
          let scope = identity && isIdentityScope(identity) ? identity : (r.origin === 'tab' ? DEVICE_SCOPE : LEGACY_SCOPE);
          let key = recordKey(scope, r.section);
          let placed = await store.updateRecord(key, cur => (cur ? undefined : { ...r, key, slot: scope, scope, migratedFrom: r.key, migratedAt: now() }));
          if (!placed) { // doelkey bestaat al (nieuwer record): oud record apart in quarantaine, niets overschrijven
            scope = LEGACY_SCOPE; key = recordKey(scope, r.section + '#' + Math.random().toString(36).slice(2, 8));
            placed = await store.updateRecord(key, () => ({ ...r, key, slot: scope, scope, migratedFrom: r.key, migratedAt: now() }));
          }
          if (placed) {
            await store.deleteRecord(r.key, cur => cur && !cur.scope && cur.rev === r.rev);
            await audit(auditEntry({ hashValue, action: 'migrated', record: placed, note: 'van ' + r.key + ' naar ' + key, now }));
          }
        }
        // Oude guards hebben geen identiteit: inert bewaren (quarantaine), niet verwijderen en niet toepassen.
        for (const g of await store.listRecords('finance-guard')) {
          if (g.scope) continue;
          const key = guardKey(LEGACY_SCOPE, g.section);
          const placed = await store.updateRecord(key, cur => (cur ? undefined : { ...g, key, slot: LEGACY_SCOPE, scope: LEGACY_SCOPE, migratedFrom: g.key }));
          if (placed) await store.deleteRecord(g.key, cur => cur && !cur.scope);
        }
      })().catch(error => { migration = null; throw error; }));
    }

    const all = async () => { await migrate(); return store.listRecords('finance'); };
    const list = async scope => { requireScope(scope === LEGACY_SCOPE ? DEVICE_SCOPE : scope); return (await all()).filter(r => r.scope === scope); };
    const get = async (scope, section) => { requireScope(scope); await migrate(); const r = await store.getRecord(recordKey(scope, section)); return r && r.scope === scope ? r : null; };

    // Opent een conflict binnen een scope (of laat een bestaand record van die scope staan). Idempotent.
    async function open(input) {
      requireScope(input.scope);
      await migrate();
      const rec = newRecord({ ...input, now });
      let created = false;
      const stored = await store.updateRecord(rec.key, cur => {
        if (cur) return undefined; // bestaand record van dezelfde scope blijft leidend
        created = true; return rec;
      });
      const current = stored || await store.getRecord(rec.key);
      if (created) {
        const paths = livePaths({ merge3, hashValue, base: rec.base, local: rec.local, remote: rec.remote, forcedPaths: rec.forcedPaths });
        await audit(auditEntry({ hashValue, action: 'detected', record: rec, paths, actor: rec.localUser, now }));
      }
      return { record: current, created };
    }

    function view(record, currentLocal) {
      const local = currentLocal === undefined ? record.local : currentLocal;
      return livePaths({ merge3, hashValue, base: record.base, local, remote: record.remote, forcedPaths: record.forcedPaths || [] });
    }

    // Expliciete keuze binnen een scope. Identiteit: open → resolved-pending (daarna versturen en serverbevestiging).
    // 'device': open → resolved-local (geen server die kan bevestigen; daarna synchroniseert de lokale waarde gewoon).
    async function resolve({ scope, section, choices, currentLocal, actor, pushBase = null }) {
      requireScope(scope);
      const rec = await get(scope, section);
      if (!rec) return { ok: false, reason: 'not-found' };
      const ch = choicesHash(hashValue, choices);
      if (rec.status !== 'open') {
        if (rec.resolution && rec.resolution.choicesHash === ch) return { ok: true, idempotent: true, record: rec, value: rec.resolution.value };
        return { ok: false, reason: 'already-resolved', record: rec };
      }
      const r = resolveValue({ merge3, hashValue, base: rec.base, local: currentLocal, remote: rec.remote, forcedPaths: rec.forcedPaths || [], choices });
      if (!r.ok) return { ok: false, reason: 'missing-choices', missing: r.missing };
      const resolution = {
        id: Math.random().toString(36).slice(2) + nowMs().toString(36), choices: { ...choices }, choicesHash: ch,
        value: r.value, valueHash: hashValue(r.value), localHash: hashValue(currentLocal ?? null),
        pushBase: rec.origin === 'tab' || rec.origin === 'reintroduction' ? pushBase : { version: rec.remoteVersion || 0, value: rec.remote },
        resolvedBy: actor || null, resolvedAt: now()
      };
      const nextStatus = scope === DEVICE_SCOPE ? 'resolved-local' : 'resolved-pending';
      let won = false;
      const after = await store.updateRecord(rec.key, cur => {
        if (!cur || cur.scope !== scope || cur.status !== 'open' || cur.rev !== rec.rev) return undefined;
        won = true; return { ...cur, status: nextStatus, resolution, rev: cur.rev + 1, updatedAt: now() };
      });
      if (!won) {
        const cur = await get(scope, section);
        if (cur && cur.resolution && cur.resolution.choicesHash === ch) return { ok: true, idempotent: true, record: cur, value: cur.resolution.value };
        return { ok: false, reason: cur && cur.status === 'open' ? 'changed' : 'already-resolved', record: cur };
      }
      await audit(auditEntry({ hashValue, action: 'resolved', record: rec, paths: view(rec, currentLocal), choices, actor, now }));
      return { ok: true, record: after, value: r.value };
    }

    // 'device'-keuze lokaal opgeslagen: financiële waarden uit het record halen (minimale opslag); keuze en hashes blijven.
    async function completeLocal(scope, section, resolutionId) {
      if (scope !== DEVICE_SCOPE) return null;
      return store.updateRecord(recordKey(scope, section), cur => (cur && cur.scope === scope && cur.status === 'resolved-local' && cur.resolution && cur.resolution.id === resolutionId && cur.resolution.value !== null)
        ? { ...cur, base: null, local: null, remote: null, resolution: { ...cur.resolution, value: null, pushBase: null }, rev: cur.rev + 1, updatedAt: now() } : undefined);
    }

    async function rollback(scope, section, resolutionId) {
      await store.updateRecord(recordKey(scope, section), cur => (cur && cur.scope === scope && cur.resolution && cur.resolution.id === resolutionId && ['resolved-pending', 'resolved-local'].includes(cur.status))
        ? { ...cur, status: 'open', resolution: null, rev: cur.rev + 1, updatedAt: now() } : undefined);
    }

    // Na een herstart: keuze vastgelegd maar lokale waarde nog niet opgeslagen. Alleen records die de aanroeper voor de
    // huidige scope (en 'device') meegeeft; nooit records van een andere identiteit.
    function interrupted(records, data) {
      return records.filter(r => ['resolved-pending', 'resolved-local'].includes(r.status) && r.resolution && r.resolution.value !== null
        && hashValue(data[r.section] ?? null) === r.resolution.localHash && r.resolution.localHash !== r.resolution.valueHash)
        .map(r => ({ section: r.section, value: clone(r.resolution.value), scope: r.scope }));
    }

    const frozenSections = records => records.filter(r => ['open', 'resolved-pending', 'confirmed'].includes(r.status)).map(r => r.section);

    // Lokale waarde die nog die van een (openstaand of wachtend) conflict van een ándere identiteit is: hoort bij dat
    // account/huishouden en mag nooit in deze scope worden verstuurd of overschreven.
    async function foreignSections({ scope, data }) {
      const out = new Set();
      for (const r of await all()) {
        if (r.scope === scope || !isIdentityScope(r.scope) || !['open', 'resolved-pending', 'confirmed'].includes(r.status)) continue;
        const h = hashValue(data[r.section] ?? null);
        if (h === hashValue(r.local ?? null) || (r.resolution && h === r.resolution.valueHash)) out.add(r.section);
      }
      return [...out];
    }

    async function findReintroductions({ scope, data, baseValues }) {
      requireScope(scope, { identity: true });
      const guards = (await store.listRecords('finance-guard')).filter(g => g.scope === scope && nowMs() - Date.parse(g.at) < GUARD_TTL_MS);
      const found = [];
      for (const g of guards) {
        if (!isFinancialSection(g.section)) continue;
        const local = data[g.section], base = baseValues[g.section];
        if (local === undefined || base === undefined) continue;
        const paths = g.paths.filter(p => hashValue(valueAt(local, p.path) ?? null) === p.rejectedHash && hashValue(valueAt(base, p.path) ?? null) !== p.rejectedHash).map(p => p.path);
        if (paths.length) found.push({ section: g.section, paths });
      }
      return found;
    }

    // Verwerkt alleen records van `scope` (andere worden overgeslagen, ook als ze per ongeluk worden meegegeven).
    async function processRound({ scope, records, remoteState, prevBase = {}, prevBaseValues = {}, cloud, householdId, encrypt, classify, data, actor }) {
      requireScope(scope, { identity: true });
      const outcomes = [];
      for (const rec of records) {
        if (rec.scope !== scope) continue;
        const s = rec.section, r = remoteState[s];
        if (rec.status === 'open') {
          if (r && r.version !== rec.remoteVersion && rec.origin === 'sync') {
            const next = await store.updateRecord(rec.key, cur => (cur && cur.scope === scope && cur.status === 'open' && cur.rev === rec.rev)
              ? { ...cur, remote: clone(r.value), remoteVersion: r.version, remoteUpdatedBy: r.updatedBy || null, remoteUpdatedAt: r.updatedAt || null, rev: cur.rev + 1, updatedAt: now() } : undefined);
            if (next) await audit(auditEntry({ hashValue, action: 'refreshed', record: next, paths: view(next, data[s]), actor, now }));
            outcomes.push({ key: rec.key, scope, section: s, kind: 'refreshed' });
          } else outcomes.push({ key: rec.key, scope, section: s, kind: 'open' });
          continue;
        }
        if (rec.status === 'confirmed') { outcomes.push({ key: rec.key, scope, section: s, kind: 'confirmed', touchBase: false, resolutionId: rec.resolution && rec.resolution.id }); continue; }
        if (rec.status !== 'resolved-pending' || !rec.resolution) continue;
        const res = rec.resolution, val = res.value;
        if (r && hashValue(r.value) === res.valueHash) {
          outcomes.push({ key: rec.key, scope, section: s, kind: 'confirmed', version: r.version, value: clone(val), touchBase: true, resolutionId: res.id });
          continue;
        }
        const pb = res.pushBase || (prevBase[s] ? { version: prevBase[s].version, value: prevBaseValues[s] } : { version: r ? r.version : 0, value: r ? r.value : undefined });
        let toPush = val, expected = pb.version;
        const remoteVersion = r ? r.version : 0;
        if (remoteVersion !== pb.version) {
          const paths = livePaths({ merge3, hashValue, base: pb.value, local: val, remote: r ? r.value : undefined });
          if (paths.length) { outcomes.push({ key: rec.key, scope, section: s, kind: 'reopen', base: pb.value, local: val, remote: r ? r.value : null, remoteVersion, remoteUpdatedBy: r && r.updatedBy, remoteUpdatedAt: r && r.updatedAt, resolutionId: res.id }); continue; }
          toPush = merge3(pb.value === undefined ? undefined : clone(pb.value), clone(val), clone(r ? r.value : undefined), { conflicts: [] });
          expected = remoteVersion;
        }
        try {
          const version = await cloud.putState(householdId, s, await encrypt(toPush), expected);
          outcomes.push({ key: rec.key, scope, section: s, kind: 'confirmed', version: Number(version), value: toPush, touchBase: true, pushed: true, resolutionId: res.id });
        } catch (error) {
          outcomes.push({ key: rec.key, scope, section: s, kind: 'pending', reason: (classify ? classify(error).kind : 'other'), resolutionId: res.id });
        }
      }
      return outcomes;
    }

    const sameResolution = (cur, o) => cur && cur.scope === o.scope && cur.resolution && cur.resolution.id === o.resolutionId;
    async function markConfirmed(outcome) {
      return store.updateRecord(outcome.key, cur => (sameResolution(cur, outcome) && cur.status === 'resolved-pending')
        ? { ...cur, status: 'confirmed', confirmedVersion: outcome.version ?? null, rev: cur.rev + 1, updatedAt: now() } : undefined);
    }
    async function reopen(outcome, actor) {
      const next = await store.updateRecord(outcome.key, cur => sameResolution(cur, outcome)
        ? { ...cur, status: 'open', origin: 'sync', base: clone(outcome.base) ?? null, local: clone(outcome.local) ?? null, remote: clone(outcome.remote) ?? null,
            remoteVersion: outcome.remoteVersion, remoteUpdatedBy: outcome.remoteUpdatedBy || null, remoteUpdatedAt: outcome.remoteUpdatedAt || null,
            forcedPaths: [], resolution: null, rev: cur.rev + 1, updatedAt: now() } : undefined);
      if (next) await audit(auditEntry({ hashValue, action: 'reopened', record: next, paths: view(next), actor, note: 'cloud intussen opnieuw gewijzigd', now }));
      return next;
    }
    async function finalize(outcome, actor) {
      const rec = await store.getRecord(outcome.key);
      if (!sameResolution(rec, outcome)) return false;
      const res = rec.resolution;
      const local = rec.local, remote = rec.remote;
      const rejected = Object.entries(res.choices || {}).map(([path, choice]) => ({ path, rejectedHash: hashValue((choice === 'local' ? valueAt(remote, path) : valueAt(local, path)) ?? null) }))
        .filter(p => p.rejectedHash !== hashValue(valueAt(res.value, p.path) ?? null));
      if (rejected.length) {
        const gk = guardKey(rec.scope, rec.section);
        await store.updateRecord(gk, cur => {
          const keep = (cur && cur.paths || []).filter(p => !rejected.some(x => x.path === p.path));
          return { key: gk, slot: rec.scope, scope: rec.scope, kind: 'finance-guard', section: rec.section, at: now(), paths: [...keep, ...rejected] };
        });
      }
      await store.deleteRecord(outcome.key, cur => sameResolution(cur, outcome));
      await audit(auditEntry({ hashValue, action: 'confirmed', record: rec, paths: Object.keys(res.choices || {}).map(path => ({ path, base: valueAt(rec.base, path), local: valueAt(local, path), remote: valueAt(remote, path) })), choices: res.choices, actor, version: outcome.version ?? rec.confirmedVersion, now }));
      return true;
    }

    // ---------- Volgorde rond een syncronde (scope = '<accountId>:<huishoudenId>' van deze ronde) ----------
    async function beforeRound({ scope, data, prevBase = {}, prevBaseValues = {}, actor = null, householdId = null }) {
      requireScope(scope, { identity: true });
      let own = await list(scope);
      const fixes = interrupted(own, data);
      for (const ri of await findReintroductions({ scope, data, baseValues: prevBaseValues })) {
        if (own.some(r => r.section === ri.section)) continue;
        await open({ scope, section: ri.section, origin: 'reintroduction', base: prevBaseValues[ri.section], local: data[ri.section], remote: prevBaseValues[ri.section],
          remoteVersion: prevBase[ri.section] ? prevBase[ri.section].version : null, forcedPaths: ri.paths, localUser: actor, householdId });
      }
      own = await list(scope);
      const foreign = await foreignSections({ scope, data });
      const frozen = [...new Set([...frozenSections(own), ...foreign])];
      return { scope, records: own, frozen, fixes, foreign, deviceOpen: [] };
    }
    async function afterRound({ scope, raw, records, snapshot, prevBase = {}, prevBaseValues = {}, cloud, householdId, encrypt, classify, actor }) {
      requireScope(scope, { identity: true });
      const result = { ...raw, pulls: { ...raw.pulls }, base: { ...raw.base }, baseValues: { ...raw.baseValues } };
      const financial = (raw.conflicts || []).filter(c => isFinancialSection(c.section));
      result.conflicts = (raw.conflicts || []).filter(c => !isFinancialSection(c.section));
      for (const c of financial) {
        const s = c.section, rs = (raw.remoteState || {})[s] || {};
        const hasBase = prevBase[s] && Object.prototype.hasOwnProperty.call(prevBaseValues, s) && hashValue(prevBaseValues[s]) === prevBase[s].hash;
        await open({ scope, section: s, origin: 'sync', base: hasBase ? prevBaseValues[s] : null, local: snapshot[s], remote: c.remote,
          remoteVersion: c.remoteVersion, remoteUpdatedBy: rs.updatedBy || null, remoteUpdatedAt: rs.updatedAt || null, localUser: actor, householdId });
      }
      const own = (records || []).filter(r => r.scope === scope);
      const outcomes = await processRound({ scope, records: own, remoteState: raw.remoteState || {}, prevBase, prevBaseValues, cloud, householdId, encrypt, classify, data: snapshot, actor });
      for (const o of outcomes) {
        if (o.kind === 'reopen') { await reopen(o, actor); continue; }
        if (o.kind !== 'confirmed') continue;
        if (o.touchBase) {
          const rec = own.find(r => r.key === o.key);
          await markConfirmed(o);
          if (rec && hashValue(snapshot[o.section] ?? null) === rec.resolution.valueHash) {
            result.pulls[o.section] = clone(o.value);
            result.base[o.section] = { version: o.version, hash: hashValue(o.value) };
            result.baseValues[o.section] = clone(o.value);
          }
        }
        if (o.pushed) result.pushed = [...(result.pushed || []), o.section];
      }
      const openLeft = (await list(scope)).some(r => r.status === 'open');
      if (openLeft && result.status === 'ok') result.status = 'conflict';
      return { result, outcomes };
    }
    async function afterCommit({ scope, outcomes, actor }) {
      requireScope(scope, { identity: true });
      let done = 0;
      for (const o of outcomes) if (o.scope === scope && o.kind === 'confirmed' && await finalize(o, actor)) done++;
      return done;
    }

    // Expliciete koppeling van het lokale profiel aan een account (opdracht 7): open apparaatrecords van precies die
    // lokale dataset gaan mee naar de identiteit van het account. Eerst onder de nieuwe sleutel bewaren, pas daarna de
    // oude sleutel weghalen; bestaat er al een record voor dat onderdeel, dan blijft het apparaatrecord staan.
    // includeUntagged: ook records zonder localKey (van vóór opdracht 7), alleen als het gekoppelde profiel de
    // oorspronkelijke dataset is waarin die records ontstonden.
    async function adoptDevice({ localKey, scope, includeUntagged = false }) {
      requireScope(scope, { identity: true });
      if (typeof localKey !== 'string' || !localKey) return [];
      const moved = [];
      for (const r of await list(DEVICE_SCOPE)) {
        if (r.status !== 'open' || !(r.localKey === localKey || (includeUntagged && !r.localKey))) continue;
        const key = recordKey(scope, r.section);
        const placed = await store.updateRecord(key, cur => (cur ? undefined : { ...r, key, slot: scope, scope, localKey: null, adoptedFrom: r.key, adoptedAt: now() }));
        if (!placed) continue;
        await store.deleteRecord(r.key, cur => cur && cur.scope === DEVICE_SCOPE && cur.rev === r.rev);
        await audit(auditEntry({ hashValue, action: 'adopted', record: placed, note: 'van ' + r.key + ' naar ' + key, now }));
        moved.push(r.section);
      }
      return moved;
    }

    const api = { adoptDevice, list, all, get, open, view, resolve, completeLocal, rollback, interrupted, frozenSections, foreignSections, findReintroductions, processRound, markConfirmed, reopen, finalize, beforeRound, afterRound, afterCommit, migrate,
      audit: async scope => { await migrate(); const a = await store.listRecords('finance-audit'); return scope ? a.filter(x => x.scope === scope) : a; } };
    // Gebonden aan één scope: dezelfde methodes zonder scope-parameter (voor de aanroepers en tests).
    api.scoped = scope => ({
      scope,
      list: () => list(scope), get: section => get(scope, section), view,
      open: input => open({ ...input, scope }),
      resolve: input => resolve({ ...input, scope }), rollback: (section, id) => rollback(scope, section, id), completeLocal: (section, id) => completeLocal(scope, section, id),
      interrupted, beforeRound: input => beforeRound({ ...input, scope }), afterRound: input => afterRound({ ...input, scope }), afterCommit: input => afterCommit({ ...input, scope }),
      audit: () => api.audit(scope)
    });
    return api;
  }

  // ---------- Persoonlijke financiële instellingen (personal_preferences.finance_config) ----------
  // Geen last-write-wins: lezen → 3-wegs samenvoegen met de laatst geladen versie → voorwaardelijk bijwerken op updated_at
  // (PostgREST-filter, geen databasewijziging). Veldconflict → niets schrijven, expliciete keuze nodig.
  // fetchRow() → { finance_config, updated_at } | null; patchIf(value, updatedAt) → bijgewerkte rij | null (0 rijen);
  // insertIfAbsent(value) → rij | null (bestond al).
  async function savePersonalConfig({ fetchRow, patchIf, insertIfAbsent, merge3, hashValue, base, local, attempts = 3 }) {
    for (let i = 0; i < attempts; i++) {
      const row = await fetchRow();
      if (!row) {
        const inserted = await insertIfAbsent(local);
        if (inserted) return { ok: true, value: local, updatedAt: inserted.updated_at || null };
        continue;
      }
      const remote = row.finance_config && typeof row.finance_config === 'object' ? row.finance_config : {};
      if (hashValue(remote) === hashValue(local)) return { ok: true, value: remote, updatedAt: row.updated_at, unchanged: true };
      const opts = { conflicts: [] };
      const remoteEmpty = Object.keys(remote).length === 0;
      const merged = base === undefined || base === null
        ? (remoteEmpty ? local : (opts.conflicts.push('(onderdeel)'), local))
        : merge3(base, local, remote, opts);
      if (opts.conflicts.length) return { ok: false, conflict: { paths: [...new Set(opts.conflicts)], local, remote, base: base ?? null, updatedAt: row.updated_at } };
      const updated = await patchIf(merged, row.updated_at);
      if (updated) return { ok: true, value: merged, updatedAt: updated.updated_at || null, merged: hashValue(merged) !== hashValue(local) };
    }
    return { ok: false, reason: 'race' };
  }

  let sharedInstance = null;
  function shared() {
    if (sharedInstance) return sharedInstance;
    const meta = globalThis.SamenThuisSyncMeta, hs = globalThis.SamenThuisHouseholdSync;
    if (!meta || !hs) return null;
    sharedInstance = createFinanceConflicts({ store: meta.shared(), merge3: hs.merge3, hashValue: hs.hashValue });
    return sharedInstance;
  }

  return { savePersonalConfig, shared, FINANCIAL_SECTIONS, isFinancialSection, isFinancialPath, parsePath, valueAt, setAt, livePaths, resolveValue, newRecord, auditEntry, createFinanceConflicts, recordKey, guardKey, scopeFor, isIdentityScope, isValidScope, DEVICE_SCOPE, LEGACY_SCOPE, WHOLE };
});
