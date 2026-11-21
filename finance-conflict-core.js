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
  const FINANCIAL_SECTIONS = Object.freeze(['budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23']);
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

  const recordKey = section => 'fin:' + section;
  const choicesHash = (hashValue, choices) => hashValue(Object.keys(choices || {}).sort().map(k => [k, choices[k]]));

  function newRecord({ section, origin, base, local, remote, remoteVersion = null, remoteUpdatedBy = null, remoteUpdatedAt = null, localUser = null, householdId = null, forcedPaths = [], now }) {
    const at = now();
    return {
      key: recordKey(section), slot: 'device', kind: 'finance', section, origin, status: 'open', rev: 1,
      base: clone(base) ?? null, local: clone(local) ?? null, remote: clone(remote) ?? null,
      remoteVersion, remoteUpdatedBy, remoteUpdatedAt, localUser, householdId, forcedPaths: [...forcedPaths],
      detectedAt: at, updatedAt: at, resolution: null, confirmedVersion: null
    };
  }

  // Audit zonder bedragen: alleen paden, hashes, versies, gebruikers-id's en tijdstippen.
  function auditEntry({ hashValue, action, record, paths = [], choices = null, actor = null, version = null, note = '', now }) {
    const at = now();
    const hashes = {};
    for (const p of paths) {
      hashes[p.path] = { base: hashValue(p.base ?? null), local: hashValue(p.local ?? null), remote: hashValue(p.remote ?? null), ...(choices && choices[p.path] ? { chosen: choices[p.path] } : {}) };
    }
    return {
      key: 'fina:' + at + ':' + Math.random().toString(36).slice(2, 8), slot: 'device', kind: 'finance-audit', at,
      action, section: record.section, origin: record.origin, paths: paths.map(p => p.path), hashes,
      actor, remoteUser: record.remoteUpdatedBy || null, remoteVersion: record.remoteVersion ?? null, version, note
    };
  }

  function createFinanceConflicts({ store, merge3, hashValue, now = () => new Date().toISOString(), nowMs = () => Date.now() }) {
    if (!store || typeof merge3 !== 'function' || typeof hashValue !== 'function') throw new Error('createFinanceConflicts: store, merge3 en hashValue zijn vereist');

    async function audit(entry) {
      await store.putRecord(entry);
      const all = (await store.listRecords('finance-audit')).sort((a, b) => String(a.at).localeCompare(String(b.at)));
      if (all.length > MAX_AUDIT) for (const r of all.slice(0, all.length - MAX_AUDIT)) await store.deleteRecord(r.key);
    }
    const list = () => store.listRecords('finance');
    const get = section => store.getRecord(recordKey(section));

    // Opent een conflict (of laat een bestaand record staan). Idempotent: hetzelfde conflict twee keer → één record.
    async function open(input) {
      const rec = newRecord({ ...input, now });
      let created = false;
      const stored = await store.updateRecord(rec.key, cur => {
        if (cur) return undefined; // bestaand record (open of wachtend) blijft leidend; geen tweede record
        created = true; return rec;
      });
      const current = stored || await store.getRecord(rec.key);
      if (created) {
        const paths = livePaths({ merge3, hashValue, base: rec.base, local: rec.local, remote: rec.remote, forcedPaths: rec.forcedPaths });
        await audit(auditEntry({ hashValue, action: 'detected', record: rec, paths, actor: rec.localUser, now }));
      }
      return { record: current, created };
    }

    // Live weergave voor de interface en voor oplossen: paden op basis van de actuele lokale waarde.
    function view(record, currentLocal) {
      const local = currentLocal === undefined ? record.local : currentLocal;
      return livePaths({ merge3, hashValue, base: record.base, local, remote: record.remote, forcedPaths: record.forcedPaths || [] });
    }

    // Expliciete keuze. Stap 1 (atomair in IndexedDB): open → resolved-pending met de gekozen waarde. De aanroeper slaat
    // daarna de waarde lokaal op (applyLocal) en draait bij een fout terug (rollback). Twee tabbladen: de tweede krijgt
    // hetzelfde resultaat bij dezelfde keuze (idempotent) of een weigering bij een andere keuze.
    async function resolve({ section, choices, currentLocal, actor, pushBase = null }) {
      const rec = await get(section);
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
      let won = false;
      const after = await store.updateRecord(rec.key, cur => {
        if (!cur || cur.status !== 'open' || cur.rev !== rec.rev) return undefined;
        won = true; return { ...cur, status: 'resolved-pending', resolution, rev: cur.rev + 1, updatedAt: now() };
      });
      if (!won) { // intussen door een ander tabblad opgelost of bijgewerkt: opnieuw beoordelen
        const cur = await get(section);
        if (cur && cur.resolution && cur.resolution.choicesHash === ch) return { ok: true, idempotent: true, record: cur, value: cur.resolution.value };
        return { ok: false, reason: cur && cur.status === 'open' ? 'changed' : 'already-resolved', record: cur };
      }
      const paths = view(rec, currentLocal);
      await audit(auditEntry({ hashValue, action: 'resolved', record: rec, paths, choices, actor, now }));
      return { ok: true, record: after, value: r.value };
    }

    // Lokaal opslaan mislukt na resolve: terug naar open (alleen als dit dezelfde oplossing is).
    async function rollback(section, resolutionId) {
      await store.updateRecord(recordKey(section), cur => (cur && cur.resolution && cur.resolution.id === resolutionId && cur.status === 'resolved-pending')
        ? { ...cur, status: 'open', resolution: null, rev: cur.rev + 1, updatedAt: now() } : undefined);
    }

    // Na een herstart: was de keuze vastgelegd maar de lokale waarde nog niet opgeslagen (crash ertussen), dan alsnog
    // toepassen. Alleen als de lokale waarde nog precies die van het moment van kiezen is.
    function interrupted(records, data) {
      return records.filter(r => r.status === 'resolved-pending' && r.resolution
        && hashValue(data[r.section] ?? null) === r.resolution.localHash && r.resolution.localHash !== r.resolution.valueHash)
        .map(r => ({ section: r.section, value: clone(r.resolution.value) }));
    }

    const frozenSections = records => records.filter(r => ['open', 'resolved-pending', 'confirmed'].includes(r.status)).map(r => r.section);

    // Oude kopie op dit apparaat die een afgewezen waarde terugbrengt → nieuw (geforceerd) conflict.
    async function findReintroductions({ data, baseValues }) {
      const guards = (await store.listRecords('finance-guard')).filter(g => nowMs() - Date.parse(g.at) < GUARD_TTL_MS);
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

    // Na het lezen van de cloud in een ronde: open records bijwerken met de nieuwste cloudstand, keuzes versturen.
    // Geeft per record een uitkomst; schrijft zelf geen applicatiegegevens of versie-administratie.
    async function processRound({ records, remoteState, prevBase = {}, prevBaseValues = {}, cloud, householdId, encrypt, classify, data, actor }) {
      const outcomes = [];
      for (const rec of records) {
        const s = rec.section, r = remoteState[s];
        if (rec.status === 'open') {
          if (r && r.version !== rec.remoteVersion && rec.origin === 'sync') {
            const next = await store.updateRecord(rec.key, cur => (cur && cur.status === 'open' && cur.rev === rec.rev)
              ? { ...cur, remote: clone(r.value), remoteVersion: r.version, remoteUpdatedBy: r.updatedBy || null, remoteUpdatedAt: r.updatedAt || null, rev: cur.rev + 1, updatedAt: now() } : undefined);
            if (next) await audit(auditEntry({ hashValue, action: 'refreshed', record: next, paths: view(next, data[s]), actor, now }));
            outcomes.push({ key: rec.key, section: s, kind: 'refreshed' });
          } else outcomes.push({ key: rec.key, section: s, kind: 'open' });
          continue;
        }
        if (rec.status === 'confirmed') { outcomes.push({ key: rec.key, section: s, kind: 'confirmed', touchBase: false, resolutionId: rec.resolution && rec.resolution.id }); continue; }
        if (rec.status !== 'resolved-pending' || !rec.resolution) continue;
        const res = rec.resolution, val = res.value;
        if (r && hashValue(r.value) === res.valueHash) { // al door de server verwerkt (bijv. antwoord kwijtgeraakt)
          outcomes.push({ key: rec.key, section: s, kind: 'confirmed', version: r.version, value: clone(val), touchBase: true, resolutionId: res.id });
          continue;
        }
        const pb = res.pushBase || (prevBase[s] ? { version: prevBase[s].version, value: prevBaseValues[s] } : { version: r ? r.version : 0, value: r ? r.value : undefined });
        let toPush = val, expected = pb.version;
        const remoteVersion = r ? r.version : 0;
        if (remoteVersion !== pb.version) {
          const paths = livePaths({ merge3, hashValue, base: pb.value, local: val, remote: r ? r.value : undefined });
          if (paths.length) { outcomes.push({ key: rec.key, section: s, kind: 'reopen', base: pb.value, local: val, remote: r ? r.value : null, remoteVersion, remoteUpdatedBy: r && r.updatedBy, remoteUpdatedAt: r && r.updatedAt, resolutionId: res.id }); continue; }
          toPush = merge3(pb.value === undefined ? undefined : clone(pb.value), clone(val), clone(r ? r.value : undefined), { conflicts: [] });
          expected = remoteVersion;
        }
        try {
          const version = await cloud.putState(householdId, s, await encrypt(toPush), expected);
          outcomes.push({ key: rec.key, section: s, kind: 'confirmed', version: Number(version), value: toPush, touchBase: true, pushed: true, resolutionId: res.id });
        } catch (error) {
          outcomes.push({ key: rec.key, section: s, kind: 'pending', reason: (classify ? classify(error).kind : 'other'), resolutionId: res.id });
        }
      }
      return outcomes;
    }

    // Server heeft bevestigd: duurzaam markeren vóór het vastleggen van de versie-administratie.
    async function markConfirmed(outcome) {
      return store.updateRecord(outcome.key, cur => (cur && cur.resolution && cur.resolution.id === outcome.resolutionId && cur.status === 'resolved-pending')
        ? { ...cur, status: 'confirmed', confirmedVersion: outcome.version ?? null, rev: cur.rev + 1, updatedAt: now() } : undefined);
    }

    async function reopen(outcome, actor) {
      const rec = await store.getRecord(outcome.key);
      if (!rec || !rec.resolution || rec.resolution.id !== outcome.resolutionId) return null;
      const next = await store.updateRecord(outcome.key, cur => (cur && cur.resolution && cur.resolution.id === outcome.resolutionId)
        ? { ...cur, status: 'open', origin: 'sync', base: clone(outcome.base) ?? null, local: clone(outcome.local) ?? null, remote: clone(outcome.remote) ?? null,
            remoteVersion: outcome.remoteVersion, remoteUpdatedBy: outcome.remoteUpdatedBy || null, remoteUpdatedAt: outcome.remoteUpdatedAt || null,
            forcedPaths: [], resolution: null, rev: cur.rev + 1, updatedAt: now() } : undefined);
      if (next) await audit(auditEntry({ hashValue, action: 'reopened', record: next, paths: view(next), actor, note: 'cloud intussen opnieuw gewijzigd', now }));
      return next;
    }

    // Pas aanroepen nadat de versie-administratie duurzaam is vastgelegd. Verwijdert het record (alleen dezelfde oplossing),
    // onthoudt de hash van de afgewezen waarden en schrijft de audit.
    async function finalize(outcome, actor) {
      const rec = await store.getRecord(outcome.key);
      if (!rec || !rec.resolution || rec.resolution.id !== outcome.resolutionId) return false;
      const res = rec.resolution;
      const local = rec.local, remote = rec.remote;
      const rejected = Object.entries(res.choices || {}).map(([path, choice]) => ({ path, rejectedHash: hashValue((choice === 'local' ? valueAt(remote, path) : valueAt(local, path)) ?? null) }))
        .filter(p => p.rejectedHash !== hashValue(valueAt(res.value, p.path) ?? null));
      if (rejected.length) {
        await store.updateRecord('fing:' + rec.section, cur => {
          const keep = (cur && cur.paths || []).filter(p => !rejected.some(x => x.path === p.path));
          return { key: 'fing:' + rec.section, slot: 'device', kind: 'finance-guard', section: rec.section, at: now(), paths: [...keep, ...rejected] };
        });
      }
      await store.deleteRecord(outcome.key, cur => cur && cur.resolution && cur.resolution.id === outcome.resolutionId);
      await audit(auditEntry({ hashValue, action: 'confirmed', record: rec, paths: Object.keys(res.choices || {}).map(path => ({ path, base: valueAt(rec.base, path), local: valueAt(local, path), remote: valueAt(remote, path) })), choices: res.choices, actor, version: outcome.version ?? rec.confirmedVersion, now }));
      return true;
    }

    // ---------- Volgorde rond een syncronde (gebruikt door account-sync.js en de tests) ----------
    // 1. beforeRound: onderbroken keuzes vinden (aanroeper past `fixes` toe en slaat op), herintroducties blokkeren,
    //    bevroren onderdelen bepalen.
    async function beforeRound({ data, prevBase = {}, prevBaseValues = {}, actor = null, householdId = null }) {
      let records = await list();
      const fixes = interrupted(records, data);
      for (const ri of await findReintroductions({ data, baseValues: prevBaseValues })) {
        if (records.some(r => r.section === ri.section)) continue;
        await open({ section: ri.section, origin: 'reintroduction', base: prevBaseValues[ri.section], local: data[ri.section], remote: prevBaseValues[ri.section],
          remoteVersion: prevBase[ri.section] ? prevBase[ri.section].version : null, forcedPaths: ri.paths, localUser: actor, householdId });
      }
      records = await list();
      return { records, frozen: frozenSections(records), fixes };
    }
    // 2. afterRound: nieuwe financiële conflicten vastleggen (en uit de gewone conflictlijst halen), open records bijwerken,
    //    gekozen waarden versturen. Bevestigde waarden worden als pull + basis in het rondresultaat gezet, maar alleen als
    //    de lokale waarde sinds de keuze niet is veranderd (anders volgt in de volgende ronde een nieuw, expliciet conflict).
    async function afterRound({ raw, records, snapshot, prevBase = {}, prevBaseValues = {}, cloud, householdId, encrypt, classify, actor }) {
      const result = { ...raw, pulls: { ...raw.pulls }, base: { ...raw.base }, baseValues: { ...raw.baseValues } };
      const financial = (raw.conflicts || []).filter(c => isFinancialSection(c.section));
      result.conflicts = (raw.conflicts || []).filter(c => !isFinancialSection(c.section));
      for (const c of financial) {
        const s = c.section, rs = (raw.remoteState || {})[s] || {};
        const hasBase = prevBase[s] && Object.prototype.hasOwnProperty.call(prevBaseValues, s) && hashValue(prevBaseValues[s]) === prevBase[s].hash;
        await open({ section: s, origin: 'sync', base: hasBase ? prevBaseValues[s] : null, local: snapshot[s], remote: c.remote,
          remoteVersion: c.remoteVersion, remoteUpdatedBy: rs.updatedBy || null, remoteUpdatedAt: rs.updatedAt || null, localUser: actor, householdId });
      }
      const outcomes = await processRound({ records, remoteState: raw.remoteState || {}, prevBase, prevBaseValues, cloud, householdId, encrypt, classify, data: snapshot, actor });
      for (const o of outcomes) {
        if (o.kind === 'reopen') { await reopen(o, actor); continue; }
        if (o.kind !== 'confirmed') continue;
        if (o.touchBase) {
          const rec = records.find(r => r.key === o.key);
          await markConfirmed(o);
          if (rec && hashValue(snapshot[o.section] ?? null) === rec.resolution.valueHash) {
            result.pulls[o.section] = clone(o.value);
            result.base[o.section] = { version: o.version, hash: hashValue(o.value) };
            result.baseValues[o.section] = clone(o.value);
          }
        }
        if (o.pushed) result.pushed = [...(result.pushed || []), o.section];
      }
      const openLeft = (await list()).some(r => r.status === 'open');
      if (openLeft && result.status === 'ok') result.status = 'conflict';
      return { result, outcomes };
    }
    // 3. afterCommit: pas na duurzaam vastgelegde versie-administratie de bevestigde records afronden.
    async function afterCommit({ outcomes, actor }) {
      let done = 0;
      for (const o of outcomes) if (o.kind === 'confirmed' && await finalize(o, actor)) done++;
      return done;
    }

    return { list, get, open, view, resolve, rollback, interrupted, frozenSections, findReintroductions, processRound, markConfirmed, reopen, finalize, beforeRound, afterRound, afterCommit, audit: () => store.listRecords('finance-audit') };
  }

  let sharedInstance = null;
  function shared() {
    if (sharedInstance) return sharedInstance;
    const meta = globalThis.SamenThuisSyncMeta, hs = globalThis.SamenThuisHouseholdSync;
    if (!meta || !hs) return null;
    sharedInstance = createFinanceConflicts({ store: meta.shared(), merge3: hs.merge3, hashValue: hs.hashValue });
    return sharedInstance;
  }

  return { shared, FINANCIAL_SECTIONS, isFinancialSection, isFinancialPath, parsePath, valueAt, setAt, livePaths, resolveValue, newRecord, auditEntry, createFinanceConflicts, recordKey, WHOLE };
});
