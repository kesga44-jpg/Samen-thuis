/* Lokale gegevensisolatie per identiteit (opdracht 6).
   Identiteit wordt bij het laden van de pagina vastgesteld en ligt daarna vast. Een wissel van account of huishouden
   herlaadt de pagina (stopt alle lopende verzoeken, timers en callbacks).

   Datasets in localStorage:
     samenThuisDataV2                   apparaat: SportCoach en settings (altijd); daarnaast het lokale profiel zolang de
                                        inhoud niet aan een account is gekoppeld of in quarantaine staat
     samenThuisDataV3|local             lokaal profiel nadat samenThuisDataV2 gekoppeld of in quarantaine is
     samenThuisDataV3|<acc>|<hh>        huishoudgegevens van één account binnen één huishouden
   Accountsync staat per account aan (samenThuisAccountSyncV1.accounts[acc] = { enabled, householdId }).
   Zonder bekend huishouden voor een account met accountsync: 'locked' (lege dataset, schrijven geblokkeerd).

   Migratie van de oude enkele dataset (journaal samenThuisDataMigrationV1, herhaalbaar en crashbestendig):
     - geen account met accountsync: samenThuisDataV2 blijft het lokale profiel (niets verandert);
     - precies één identiteit aantoonbaar (één slot in de versie-administratie): kopie naar die identiteit, alleen als
       daar nog geen dataset staat; samenThuisDataV2 blijft staan (niet verwijderd);
     - meer identiteiten of twijfel: quarantaine; de gegevens blijven ongewijzigd staan en worden nergens geladen of
       gesynchroniseerd. Nooit automatisch aan het eerstvolgende account. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisIdentityStore = core;
})(globalThis, function () {
  'use strict';

  const LEGACY_KEY = 'samenThuisDataV2', V1_KEY = 'samenThuisDataV1', V3 = 'samenThuisDataV3';
  const CFG_KEY = 'samenThuisAccountSyncV1', AUTH_KEY = 'samenThuisPersonalAuthV1', JOURNAL_KEY = 'samenThuisDataMigrationV1';
  const DEVICE_FIELDS = Object.freeze(['sportCoach', 'settings']);
  const ID = /^[A-Za-z0-9-]{1,80}$/;

  const parse = text => { try { return JSON.parse(text); } catch (_) { return undefined; } };
  const read = (storage, key) => { try { return storage.getItem(key); } catch (_) { return null; } };
  const readJson = (storage, key, fallback) => { const v = parse(read(storage, key)); return v === undefined || v === null ? fallback : v; };
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hashText(text) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + ':' + text.length;
  }
  const hashValue = v => hashText(stable(v));

  const accountKey = (acc, hh) => `${V3}|${acc}|${hh}`;
  const LOCAL_V3 = `${V3}|local`;

  // Zonder huishoud-/accountinhoud (apparaatvelden horen in samenThuisDataV2).
  function withoutDeviceFields(value) {
    if (!value || typeof value !== 'object') return value;
    const out = { ...value }; DEVICE_FIELDS.forEach(f => { delete out[f]; }); return out;
  }

  // ---------- Configuratie per account ----------
  // Oud formaat: { enabled, householdId, bases: { '<acc>:<hh>': {...} } } → accounts[acc] = { enabled, householdId }.
  // Alleen afleiden wat aantoonbaar is; het oude formaat blijft staan (niet verwijderd).
  function readConfig(storage) {
    const cfg = readJson(storage, CFG_KEY, {});
    const accounts = cfg.accounts && typeof cfg.accounts === 'object' ? { ...cfg.accounts } : {};
    const slots = Object.keys(cfg.bases || {}).map(s => s.split(':')).filter(([a, h]) => ID.test(a || '') && ID.test(h || ''));
    if (cfg.enabled && !cfg.accountsMigrated) {
      const byAccount = {};
      slots.forEach(([a, h]) => { (byAccount[a] ||= new Set()).add(h); });
      for (const [a, hs] of Object.entries(byAccount)) {
        if (accounts[a]) continue;
        accounts[a] = { enabled: true, householdId: hs.size === 1 ? [...hs][0] : null, migratedFromLegacy: true };
      }
    }
    return { raw: cfg, accounts, slots };
  }
  function writeConfig(storage, raw, accounts) {
    storage.setItem(CFG_KEY, JSON.stringify({ ...raw, accounts, accountsMigrated: true }));
  }
  function setAccount(storage, accountId, patch) {
    if (!ID.test(accountId || '')) throw new Error('Ongeldig account');
    const { raw, accounts } = readConfig(storage);
    accounts[accountId] = { ...(accounts[accountId] || {}), ...patch };
    writeConfig(storage, raw, accounts);
    return accounts[accountId];
  }

  const journal = storage => readJson(storage, JOURNAL_KEY, {});
  const writeJournal = (storage, j) => storage.setItem(JOURNAL_KEY, JSON.stringify(j));

  // ---------- Identiteit (synchroon, uit localStorage) ----------
  function resolve(storage) {
    const session = readJson(storage, AUTH_KEY, null);
    const accountId = session && session.user && ID.test(session.user.id || '') ? session.user.id : null;
    const { accounts } = readConfig(storage);
    const j = journal(storage);
    const localKey = ['bound', 'quarantined'].includes(j.v2) ? LOCAL_V3 : LEGACY_KEY;
    const acc = accountId ? accounts[accountId] : null;
    if (accountId && acc && acc.enabled) {
      if (ID.test(acc.householdId || '')) {
        return { mode: 'account', accountId, householdId: acc.householdId, key: accountKey(accountId, acc.householdId), scope: `${accountId}:${acc.householdId}` };
      }
      return { mode: 'locked', accountId, householdId: null, key: null, reason: 'household-unknown' };
    }
    return { mode: 'local', accountId, householdId: null, key: localKey, scope: null };
  }

  // Sleutels voor opslag en herstel van de actieve dataset. Het oorspronkelijke lokale profiel houdt de oude namen.
  function keysFor(identity) {
    if (identity.mode === 'local' && identity.key === LEGACY_KEY) {
      return { storageKey: LEGACY_KEY, legacyKey: V1_KEY, backupKey: 'samenThuisPreV23Backup', backupAtKey: 'samenThuisPreV23BackupAt',
        corruptKey: 'samenThuisCorruptBackup', preRestoreKey: 'samenThuisPreRestoreBackup', restoreHoldKey: 'samenThuisRestoreHold', preSyncKey: 'samenThuisPreAccountSyncBackup' };
    }
    const suffix = identity.mode === 'account' ? `|${identity.accountId}|${identity.householdId}` : identity.mode === 'locked' ? `|locked|${identity.accountId}` : '|local';
    return { storageKey: identity.key || `${V3}|locked|${identity.accountId}`, legacyKey: null,
      backupKey: null, backupAtKey: null, corruptKey: 'samenThuisCorruptBackup' + suffix,
      preRestoreKey: 'samenThuisPreRestoreBackup' + suffix, restoreHoldKey: 'samenThuisRestoreHold' + suffix, preSyncKey: 'samenThuisPreAccountSyncBackup' + suffix };
  }

  // ---------- Migratie oude enkele dataset ----------
  function migrateLegacy(storage, { now = () => new Date().toISOString() } = {}) {
    let j = journal(storage);
    if (['local', 'bound', 'quarantined'].includes(j.v2)) return { action: 'none', journal: j };
    const { raw, accounts, slots } = readConfig(storage);
    if (raw.enabled && !raw.accountsMigrated) writeConfig(storage, raw, accounts);
    const v2 = read(storage, LEGACY_KEY);
    if (!raw.enabled || v2 == null) { j = { ...j, v2: 'local', at: now() }; writeJournal(storage, j); return { action: 'local', journal: j }; }
    const v2Value = parse(v2);
    if (!v2Value || typeof v2Value !== 'object') { j = { v2: 'quarantined', reason: 'onleesbaar', at: now() }; writeJournal(storage, j); return { action: 'quarantined', journal: j }; }
    const content = JSON.stringify(withoutDeviceFields(v2Value));
    const sourceHash = hashText(content);
    const owner = slots.length === 1 ? slots[0] : null;
    if (!owner) {
      j = { v2: 'quarantined', reason: slots.length ? 'meerdere-identiteiten' : 'geen-identiteit', slots: slots.map(s => s.join(':')), sourceHash, at: now() };
      writeJournal(storage, j); return { action: 'quarantined', journal: j };
    }
    const target = accountKey(owner[0], owner[1]);
    const existing = read(storage, target);
    if (j.v2 === 'copying' && j.target === target && existing != null && hashText(existing) === sourceHash) {
      j = { v2: 'bound', target, sourceHash, at: now() }; writeJournal(storage, j); return { action: 'bound', journal: j, resumed: true };
    }
    if (existing != null) { // nooit een bestaande identiteitsdataset overschrijven
      j = { v2: 'quarantined', reason: 'doel-bestaat-al', target, sourceHash, at: now() }; writeJournal(storage, j); return { action: 'quarantined', journal: j };
    }
    writeJournal(storage, { v2: 'copying', target, sourceHash, at: now() });
    storage.setItem(target, content);
    if (hashText(read(storage, target) || '') !== sourceHash) throw new Error('Migratie niet geverifieerd; oude gegevens zijn ongewijzigd bewaard.');
    j = { v2: 'bound', target, sourceHash, at: now() }; writeJournal(storage, j);
    return { action: 'bound', journal: j };
  }

  // Expliciete koppeling bij het inschakelen van accountsync: de gegevens van het lokale profiel gaan naar deze identiteit
  // (alleen als daar nog niets staat). Het lokale profiel wordt daarna niet meer als lokaal profiel geladen: oorspronkelijke
  // samenThuisDataV2 krijgt status 'bound'; een samenThuisDataV3|local-profiel wordt naar een archiefsleutel verplaatst.
  function bindLocalToAccount(storage, { accountId, householdId, now = () => new Date().toISOString() }) {
    if (!ID.test(accountId || '') || !ID.test(householdId || '')) throw new Error('Ongeldige identiteit');
    const target = accountKey(accountId, householdId);
    if (read(storage, target) != null) return { bound: false, reason: 'bestaat-al', target };
    const j = journal(storage);
    const source = ['bound', 'quarantined'].includes(j.v2) ? LOCAL_V3 : LEGACY_KEY;
    const text = read(storage, source);
    const value = text == null ? null : parse(text);
    if (!value || typeof value !== 'object') return { bound: false, reason: 'geen-lokale-gegevens', target };
    const content = JSON.stringify(withoutDeviceFields(value));
    storage.setItem(target, content);
    if (hashText(read(storage, target) || '') !== hashText(content)) throw new Error('Koppeling niet geverifieerd');
    if (source === LEGACY_KEY) writeJournal(storage, { ...j, v2: 'bound', target, sourceHash: hashText(content), at: now(), explicit: true });
    else {
      storage.setItem(`${V3}|local-archive|${Date.now()}`, text); // niet wissen: archief
      storage.removeItem(LOCAL_V3);
    }
    return { bound: true, target, source };
  }

  // Overzicht van bewaarde gegevens die niet (meer) worden geladen.
  function retained(storage) {
    const j = journal(storage), out = [];
    if (j.v2 === 'quarantined') out.push({ key: LEGACY_KEY, status: 'quarantaine', reason: j.reason, at: j.at });
    if (j.v2 === 'bound') out.push({ key: LEGACY_KEY, status: 'gekoppeld', target: j.target, at: j.at });
    try {
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(`${V3}|local-archive|`)) out.push({ key: k, status: 'archief' }); }
    } catch (_) {}
    return out;
  }

  // Inhoud van samenThuisDataV2 wordt bij een gekoppelde/quarantaine-status niet meer als dataset gebruikt; alleen de
  // apparaatvelden. Leest de apparaatvelden.
  function readDeviceFields(storage) {
    const v = parse(read(storage, LEGACY_KEY));
    const out = {};
    if (v && typeof v === 'object') DEVICE_FIELDS.forEach(f => { if (v[f] !== undefined) out[f] = v[f]; });
    return out;
  }

  // Mag een back-up in de actieve identiteit worden teruggezet? Een back-up van een account alleen in hetzelfde account
  // en huishouden; back-ups zonder accountherkomst (lokaal, bewaard, oud formaat) alleen als expliciete gebruikersactie.
  function backupAllowed(text, identity) {
    if (identity.mode === 'locked') return { ok: false, reason: 'locked' };
    const value = parse(text);
    const origin = value && value.meta && value.meta.exportIdentity;
    if (origin && origin.mode === 'account') {
      if (identity.mode !== 'account' || origin.accountId !== identity.accountId || origin.householdId !== identity.householdId) return { ok: false, reason: 'other-identity' };
    }
    return { ok: true };
  }

  return { backupAllowed, LEGACY_KEY, V1_KEY, V3, LOCAL_V3, CFG_KEY, AUTH_KEY, JOURNAL_KEY, DEVICE_FIELDS, accountKey, resolve, keysFor, readConfig, setAccount,
    migrateLegacy, bindLocalToAccount, retained, readDeviceFields, withoutDeviceFields, hashValue, journal };
});
