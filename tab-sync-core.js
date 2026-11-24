/* Coördinatie tussen tabbladen op hetzelfde apparaat (zelfde localStorage).
   - createDataGuard: voorkomt dat een tabblad met verouderde gegevens in geheugen de opslag van een ander tabblad
     overschrijft. Vóór elke schrijfactie wordt gecontroleerd of de opgeslagen tekst nog dezelfde is als de laatst
     bekende; zo niet, dan volgt een 3-wegs samenvoeging (basis = laatst bekende tekst). Bij hetzelfde veld aan beide
     kanten anders blijft de waarde van dit tabblad staan en wordt het conflict gemeld (nooit ongemerkt).
   - createSyncLock: één synchronisatieronde tegelijk per apparaat. Web Locks (navigator.locks) waar beschikbaar,
     anders een lease in localStorage met vervaltijd en verlenging.
   - createChannel: BroadcastChannel voor korte meldingen tussen tabbladen; zonder ondersteuning een no-op. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisTabSync = core;
})(globalThis, function () {
  'use strict';

  const parse = text => { try { return { ok: true, value: JSON.parse(text) }; } catch (_) { return { ok: false }; } };
  const randomId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  // Elke geschreven versie krijgt in meta.__tabRev een id en het id van de versie waarop hij voortbouwt (ouder).
  // Daarmee kan een tabblad bij een wijziging uit een ander tabblad de echte gemeenschappelijke voorganger als basis
  // gebruiken. Nodig omdat localStorage tussen tabbladen (processen) met enige vertraging bijwerkt: een tabblad kan
  // schrijven zonder de net gemaakte wijziging van een ander tabblad al te zien. Het tabblad dat dat later via het
  // storage-event merkt, voegt samen en schrijft het resultaat terug (needsWrite), zodat beide wijzigingen blijven.
  const REV = '__tabRev';
  const HISTORY_LIMIT = 100;      // herkomstketen (alleen id's)
  const TEXT_LIMIT = 8;           // volledige teksten alleen van de jongste versies (geheugengebruik begrensd)

  // storage: Storage-achtig object; merge3(base, local, remote, opts) uit household-sync-core.js.
  function createDataGuard({ storage, key, merge3, newId = randomId }) {
    if (!storage || !key || typeof merge3 !== 'function') throw new Error('createDataGuard: storage, key en merge3 zijn vereist');
    const history = new Map(); // id -> { text, parent }
    let known = { id: null, text: null };

    // parent: de versie waarop is voortgebouwd; merged: de tweede voorganger als het een samengevoegde versie is.
    const revOf = value => {
      const r = value && value.meta && value.meta[REV];
      return r && typeof r.id === 'string'
        ? { id: r.id, parent: typeof r.parent === 'string' ? r.parent : null, merged: typeof r.merged === 'string' ? r.merged : null }
        : { id: null, parent: null, merged: null };
    };
    let mergedFrom = null; // id van onze eigen versie die in de volgende schrijfactie is samengevoegd met een andere
    function remember(text, r) {
      if (!r.id) return r;
      history.delete(r.id); history.set(r.id, { text, parents: [r.parent, r.merged].filter(Boolean) });
      let withText = 0;
      for (const id of [...history.keys()].reverse()) { const h = history.get(id); if (h.text != null && ++withText > TEXT_LIMIT) h.text = null; }
      while (history.size > HISTORY_LIMIT) history.delete(history.keys().next().value);
      return r;
    }
    function setKnown(text, rev) {
      const r = rev || revOf(text == null ? null : parse(text).value);
      remember(text, r);
      known = { id: r.id, text };
    }
    let lastSerialized = null;
    try { setKnown(storage.getItem(key)); } catch (_) { known = { id: null, text: null }; }

    // Voorgangers, dichtstbijzijnde eerst (breedte-eerst over beide voorgangers).
    const ancestors = starts => {
      const out = [], seen = new Set(), queue = starts.filter(Boolean);
      while (queue.length) { const id = queue.shift(); if (seen.has(id)) continue; seen.add(id); out.push(id); queue.push(...(history.get(id)?.parents || [])); }
      return out;
    };

    // Basis voor samenvoegen van `other` met wat dit tabblad kent: de jongste gemeenschappelijke voorganger.
    function baseFor(otherRev) {
      if (known.text == null) return { ok: false };
      if (!otherRev.id || !known.id) return parse(known.text); // oude gegevens zonder herkomst: laatst bekende versie
      const mine = new Set(ancestors([known.id, mergedFrom]));
      for (const id of ancestors([otherRev.parent, otherRev.merged])) {
        if (!mine.has(id)) continue;
        const h = history.get(id);
        if (h && h.text != null) return parse(h.text);
      }
      return { ok: false }; // geen gemeenschappelijke voorganger bekend: zonder basis samenvoegen (niets verwijderen)
    }

    // meta is lokaal en wordt apart behandeld: geen conflict op updatedAt/__tabRev.
    function split(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { body: value, meta: undefined };
      const { meta, ...body } = value; return { body, meta };
    }
    function mergeWith(otherText, current) {
      const other = parse(otherText);
      if (!other.ok || !other.value || typeof other.value !== 'object') return { value: current, external: true, conflicts: ['(onleesbare gegevens van een ander tabblad)'], unreadable: true, needsWrite: false };
      const otherRev = revOf(other.value);
      // Zelfde inhoud als de laatst bekende versie (bijv. twee tabbladen die elk hetzelfde samenvoegresultaat schreven):
      // alleen de herkomst overnemen, niets samenvoegen. Voorkomt een te oude basis en onterechte conflicten.
      const knownParsed = known.text == null ? { ok: false } : parse(known.text);
      if (knownParsed.ok && stableText(split(knownParsed.value).body) === stableText(split(other.value).body)) {
        setKnown(otherText, otherRev);
        return { value: current, external: true, conflicts: [], remote: other.value, needsWrite: false, sameContent: true };
      }
      const base = baseFor(otherRev);
      const B = base.ok ? split(base.value) : { body: undefined }, L = split(current), R = split(other.value);
      const opts = { conflicts: [] };
      const body = merge3(B.body, L.body, R.body, opts);
      const lm = L.meta && typeof L.meta === 'object' ? L.meta : {}, rm = R.meta && typeof R.meta === 'object' ? R.meta : {};
      const meta = { ...rm, ...lm };
      const times = [lm.updatedAt, rm.updatedAt].filter(Boolean).sort();
      if (times.length) meta.updatedAt = times[times.length - 1];
      meta[REV] = { ...otherRev };
      const value = { ...body, meta };
      const needsWrite = stableText(body) !== stableText(R.body);
      if (stableText(body) !== stableText(R.body) || stableText(L.body) !== stableText(R.body)) mergedFrom = mergedFrom || known.id;
      setKnown(otherText, otherRev);
      return { value, external: true, conflicts: opts.conflicts, remote: other.value, base: base.ok ? base.value : undefined, needsWrite };
    }

    return {
      known: () => known.text,
      stats: () => ({ versions: history.size, texts: [...history.values()].filter(h => h.text != null).length }),
      // Vlak vóór het schrijven van `current`. Geeft de waarde terug die geschreven moet worden.
      prepareWrite(current) {
        let stored = null;
        try { stored = storage.getItem(key); } catch (_) { stored = null; }
        if (stored == null || stored === known.text) return { value: current, external: false, conflicts: [] };
        return mergeWith(stored, current);
      },
      // Zet de herkomst (nieuw id, ouder = laatst bekende versie) en geeft de te schrijven tekst.
      serialize(value) {
        if (value && typeof value === 'object') {
          if (!value.meta || typeof value.meta !== 'object') value.meta = {};
          value.meta[REV] = { id: newId(), parent: known.id, ...(mergedFrom && mergedFrom !== known.id ? { merged: mergedFrom } : {}) };
        }
        const text = JSON.stringify(value);
        lastSerialized = { text, rev: revOf(value) };
        return text;
      },
      // Na een geslaagde schrijfactie (zonder de tekst opnieuw te parsen als hij net door serialize is gemaakt).
      commit(text) { setKnown(text, lastSerialized && lastSerialized.text === text ? lastSerialized.rev : undefined); lastSerialized = null; mergedFrom = null; },
      // Wijziging uit een ander tabblad (storage-event). needsWrite: het resultaat bevat iets dat de opslag mist.
      absorb(newText, current) {
        if (newText == null || newText === known.text) return { value: current, external: false, conflicts: [], needsWrite: false };
        return mergeWith(newText, current);
      }
    };
  }

  function stableText(v) {
    if (Array.isArray(v)) return '[' + v.map(stableText).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableText(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  // locks: navigator.locks (optioneel). storage: fallback voor de lease. Fail-open als de lease niet te schrijven is:
  // de server weigert dan nog steeds verouderde versies (versiecontrole), er gaat dus niets verloren.
  function createSyncLock({ name = 'samen-thuis-sync', locks, storage, leaseKey = 'samenThuisSyncLeaseV1', ttlMs = 30000, tabId = randomId(), now = () => Date.now(), timers = globalThis } = {}) {
    const webLocks = locks && typeof locks.request === 'function' ? locks : null;
    let held = false;

    const readLease = () => { try { return JSON.parse(storage.getItem(leaseKey) || 'null'); } catch (_) { return null; } };
    const writeLease = () => storage.setItem(leaseKey, JSON.stringify({ owner: tabId, expires: now() + ttlMs }));
    function releaseLease() {
      try { const lease = readLease(); if (lease && lease.owner === tabId) storage.removeItem(leaseKey); } catch (_) {}
    }

    async function runWithLease(fn) {
      if (!storage) return { acquired: true, value: await fn() };
      try {
        const lease = readLease();
        if (lease && lease.owner !== tabId && Number(lease.expires) > now()) return { acquired: false };
        writeLease();
        const check = readLease();
        if (!check || check.owner !== tabId) return { acquired: false };
      } catch (_) {
        return { acquired: true, value: await fn(), degraded: true };
      }
      const renew = timers.setInterval(() => { try { const l = readLease(); if (l && l.owner === tabId) writeLease(); } catch (_) {} }, Math.max(1000, Math.floor(ttlMs / 3)));
      try { return { acquired: true, value: await fn() }; }
      finally { timers.clearInterval(renew); releaseLease(); }
    }

    async function run(fn) {
      if (held) return { acquired: false };
      held = true;
      try {
        if (webLocks) {
          let outcome = null;
          try {
            outcome = await webLocks.request(name, { ifAvailable: true }, async lock => {
              if (!lock) return { acquired: false };
              try { return { acquired: true, value: await fn() }; }
              catch (error) { return { acquired: true, failed: true, error }; }
            });
          } catch (_) {
            outcome = null; // Web Locks niet bruikbaar (bijv. beveiligingscontext): terugvallen op de lease.
          }
          if (outcome) {
            if (outcome.failed) throw outcome.error;
            return outcome;
          }
        }
        return await runWithLease(fn);
      } finally { held = false; }
    }
    // exclusive: alleen Web Locks geven een echte garantie. De lease is best effort: lezen-schrijven-controleren in
    // localStorage is niet atomair en kan tussen tabbladen vertraagd zichtbaar zijn, waardoor twee tabbladen hem
    // tegelijk kunnen denken te hebben. Een verlopen lease (crash, gepauzeerd tabblad) wordt na ttlMs overgenomen.
    // De versiecontrole op de server (put_household_state) blijft daarom altijd de laatste beveiliging.
    return { run, tabId, release: releaseLease, isHeld: () => held, kind: webLocks ? 'web-locks' : 'lease', exclusive: !!webLocks };
  }

  function createChannel({ name = 'samen-thuis', BroadcastChannelImpl = globalThis.BroadcastChannel, tabId = randomId() } = {}) {
    let channel = null;
    const handlers = new Set();
    try { if (typeof BroadcastChannelImpl === 'function') channel = new BroadcastChannelImpl(name); } catch (_) { channel = null; }
    if (channel) channel.onmessage = event => {
      const msg = event && event.data;
      if (!msg || msg.from === tabId) return;
      handlers.forEach(h => { try { h(msg); } catch (_) {} });
    };
    return {
      available: !!channel,
      post(type, detail = {}) { if (channel) try { channel.postMessage({ type, from: tabId, at: Date.now(), ...detail }); } catch (_) {} },
      on(handler) { handlers.add(handler); return () => handlers.delete(handler); },
      close() { handlers.clear(); if (channel) { try { channel.close(); } catch (_) {} channel = null; } }
    };
  }

  // ---------- Conflictdetails per pad ----------
  // Pad zoals merge3 het meldt: "budgetV23.incomes.Kees", "groceries[g1].title", "(onderdeel)".
  function parsePath(path) {
    const out = []; const re = /\[([^\]]*)\]|([^.[\]]+)/g; let m;
    while ((m = re.exec(String(path)))) out.push(m[1] !== undefined ? { id: m[1] } : { key: m[2] });
    return out;
  }
  function valueAt(obj, path) {
    let cur = obj;
    for (const step of parsePath(path)) {
      if (cur == null) return undefined;
      if (step.id !== undefined) cur = Array.isArray(cur) ? cur.find(x => x && String(x.id) === step.id) : undefined;
      else cur = typeof cur === 'object' ? cur[step.key] : undefined;
    }
    return cur;
  }
  // Zet een waarde op een pad; alleen bestaande tussenliggende objecten/items (geen nieuwe structuur verzinnen).
  function setAt(obj, path, value) {
    const steps = parsePath(path);
    if (!steps.length) return false;
    let cur = obj;
    for (let i = 0; i < steps.length - 1; i++) {
      const step = steps[i];
      cur = step.id !== undefined ? (Array.isArray(cur) ? cur.find(x => x && String(x.id) === step.id) : undefined) : (cur && typeof cur === 'object' ? cur[step.key] : undefined);
      if (cur == null || typeof cur !== 'object') return false;
    }
    const last = steps[steps.length - 1];
    if (last.id !== undefined) {
      if (!Array.isArray(cur)) return false;
      const idx = cur.findIndex(x => x && String(x.id) === last.id);
      if (idx < 0) cur.push(value); else cur[idx] = value;
      return true;
    }
    if (value === undefined) delete cur[last.key]; else cur[last.key] = value;
    return true;
  }
  // Financiële paden: uitsluitend volgens de centrale, expliciete definitie in finance-conflict-core.js.
  const financeCore = () => (typeof module === 'object' && module.exports && typeof require === 'function')
    ? require('./finance-conflict-core.js') : globalThis.SamenThuisFinanceConflicts;
  const isFinancialPath = path => { const core = financeCore(); return !!(core && core.isFinancialPath(path)); };
  // Zet de paden uit merge3 om naar records met beide waarden (en de basis), voor het conflictlogboek.
  function describeConflicts({ paths, kept, other, base, prefix = '' }) {
    return (paths || []).map(p => {
      const path = prefix ? (p === '(onderdeel)' ? prefix : `${prefix}${p.startsWith('[') ? '' : '.'}${p}`) : p;
      const whole = /^\(/.test(path);
      return {
        path, section: whole ? '' : (parsePath(path)[0] || {}).key || '', financial: !whole && isFinancialPath(path),
        kept: whole ? null : valueAt(kept, path), other: whole ? null : valueAt(other, path), base: whole || base === undefined ? null : valueAt(base, path)
      };
    });
  }

  return { createDataGuard, createSyncLock, createChannel, randomId, parsePath, valueAt, setAt, isFinancialPath, describeConflicts };
});
