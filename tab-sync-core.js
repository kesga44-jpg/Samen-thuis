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
  const HISTORY_LIMIT = 30;

  // storage: Storage-achtig object; merge3(base, local, remote, opts) uit household-sync-core.js.
  function createDataGuard({ storage, key, merge3, newId = randomId }) {
    if (!storage || !key || typeof merge3 !== 'function') throw new Error('createDataGuard: storage, key en merge3 zijn vereist');
    const history = new Map(); // id -> { text, parent }
    let known = { id: null, text: null };

    const revOf = value => {
      const r = value && value.meta && value.meta[REV];
      return r && typeof r.id === 'string' ? { id: r.id, parent: typeof r.parent === 'string' ? r.parent : null } : { id: null, parent: null };
    };
    function remember(text, value) {
      const r = revOf(value);
      if (!r.id) return r;
      history.delete(r.id); history.set(r.id, { text, parent: r.parent });
      while (history.size > HISTORY_LIMIT) history.delete(history.keys().next().value);
      return r;
    }
    function setKnown(text, parsed) {
      const value = parsed !== undefined ? parsed : (text == null ? null : parse(text).value);
      const r = remember(text, value);
      known = { id: r.id, text };
    }
    try { setKnown(storage.getItem(key)); } catch (_) { known = { id: null, text: null }; }

    const chain = id => { const out = []; const seen = new Set(); let cur = id; while (cur && !seen.has(cur)) { out.push(cur); seen.add(cur); cur = history.get(cur)?.parent || null; } return out; };

    // Basis voor samenvoegen van `other` met wat dit tabblad kent: de jongste gemeenschappelijke voorganger.
    function baseFor(otherRev) {
      if (known.text == null) return { ok: false };
      if (!otherRev.id || !known.id) return parse(known.text); // oude gegevens zonder herkomst: laatst bekende versie
      const mine = new Set(chain(known.id));
      for (const id of chain(otherRev.parent)) {
        if (mine.has(id)) { const h = history.get(id); return h ? parse(h.text) : { ok: false }; }
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
      setKnown(otherText, other.value);
      return { value, external: true, conflicts: opts.conflicts, remote: other.value, needsWrite };
    }

    return {
      known: () => known.text,
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
          value.meta[REV] = { id: newId(), parent: known.id };
        }
        return JSON.stringify(value);
      },
      // Na een geslaagde schrijfactie.
      commit(text) { setKnown(text); },
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
    return { run, tabId, release: releaseLease, isHeld: () => held, kind: webLocks ? 'web-locks' : 'lease' };
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

  return { createDataGuard, createSyncLock, createChannel, randomId };
});
