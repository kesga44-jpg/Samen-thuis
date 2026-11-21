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
      // Archief met vastgelegd doel (opdracht 7): alleen zichtbaar voor de identiteit waaraan het profiel is gekoppeld.
      const archiveKey = `${V3}|local-archive|${Date.now()}`;
      storage.setItem(archiveKey, text); // niet wissen: archief
      writeJournal(storage, { ...journal(storage), archives: { ...(journal(storage).archives || {}), [archiveKey]: target } });
      storage.removeItem(LOCAL_V3);
    }
    return { bound: true, target, source };
  }

  // Overzicht van bewaarde gegevens die niet (meer) worden geladen (alle identiteiten; intern gebruik).
  // target: de identiteitsdataset waaraan de gegevens aantoonbaar horen; ontbreekt die, dan is de herkomst onzeker
  // (quarantaine). Een archief zonder vastgelegd doel (van vóór opdracht 7) geldt als quarantaine.
  function retained(storage) {
    const j = journal(storage), out = [];
    if (j.v2 === 'quarantined') out.push({ key: LEGACY_KEY, status: 'quarantaine', reason: j.reason, at: j.at, target: null });
    if (j.v2 === 'bound') out.push({ key: LEGACY_KEY, status: 'gekoppeld', target: j.target || null, at: j.at });
    const archives = j.archives || {};
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(`${V3}|local-archive|`)) out.push({ key: k, status: 'archief', target: typeof archives[k] === 'string' ? archives[k] : null });
        else if (k && k.startsWith(`${V3}|quarantine|`)) out.push({ key: k, status: 'quarantaine', reason: 'onbekende-onderdelen', target: null });
      }
    } catch (_) {}
    return out;
  }

  // ---------- Eigenaar van een oud financieel apparaatconflict (M1) ----------
  // Een apparaatconflict zonder localKey (van vóór opdracht 7) ontstond in het lokale profiel dat er op dat moment was.
  // Welk profiel dat was, volgt uit het migratiejournaal en de archieven, vergeleken met het tijdstip van het conflict
  // (dezelfde apparaatklok). Uitkomst:
  //   { kind: 'local', key }                       het profiel is nog steeds het lokale profiel met die sleutel;
  //   { kind: 'account', key, accountId, householdId } de gegevens zijn aantoonbaar aan die identiteit gekoppeld;
  //   { kind: 'unknown', reason }                  niet betrouwbaar vast te stellen (quarantaine, onbekend archief,
  //                                                migratie bezig, geen of ongeldig tijdstip).
  function parseAccountKey(key) {
    const parts = String(key || '').split('|');
    return parts.length === 3 && parts[0] === V3 && ID.test(parts[1]) && ID.test(parts[2]) ? { accountId: parts[1], householdId: parts[2] } : null;
  }
  function legacyRecordOwner(storage, detectedAt) {
    const t = Date.parse(detectedAt || '');
    if (!Number.isFinite(t)) return { kind: 'unknown', reason: 'geen-tijdstip' };
    const j = journal(storage);
    const toOwner = target => { const p = parseAccountKey(target); return p ? { kind: 'account', key: target, ...p } : { kind: 'unknown', reason: 'doel-onbekend' }; };
    if (!j.v2 || j.v2 === 'local') return { kind: 'local', key: LEGACY_KEY };
    if (!['bound', 'quarantined'].includes(j.v2)) return { kind: 'unknown', reason: 'migratie-niet-afgerond' };
    const at = Date.parse(j.at || '');
    if (!Number.isFinite(at)) return { kind: 'unknown', reason: 'migratietijdstip-onbekend' };
    if (t < at) return j.v2 === 'bound' ? toOwner(j.target) : { kind: 'unknown', reason: 'quarantaine' };
    // Ontstaan in samenThuisDataV3|local. Is dat profiel daarna gearchiveerd, dan hoort het conflict bij dat archief.
    const archives = j.archives || {};
    let first = null;
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        const m = k && k.startsWith(`${V3}|local-archive|`) ? Number(k.slice(`${V3}|local-archive|`.length)) : NaN;
        if (Number.isFinite(m) && m > t && (!first || m < first.ms)) first = { ms: m, key: k };
      }
    } catch (_) { return { kind: 'unknown', reason: 'opslag-onleesbaar' }; }
    if (first) return typeof archives[first.key] === 'string' ? toOwner(archives[first.key]) : { kind: 'unknown', reason: 'archief-zonder-doel' };
    return { kind: 'local', key: LOCAL_V3 };
  }

  // Bewaarde gegevens die de actieve identiteit mag zien (opdracht 7):
  //   - met vastgelegd doel: uitsluitend de identiteit met precies die dataset;
  //   - zonder bewezen eigenaar (quarantaine): uitsluitend in de lokale identiteit én in de expliciete herstelmodus.
  // Een account ziet nooit gegevens van een ander account of huishouden, en nooit quarantainegegevens.
  function retainedFor(storage, identity, { recovery = false } = {}) {
    if (!identity || identity.mode === 'locked') return [];
    return retained(storage).filter(item => item.target
      ? item.target === identity.key
      : identity.mode === 'local' && recovery === true);
  }

  // Inhoud van samenThuisDataV2 wordt bij een gekoppelde/quarantaine-status niet meer als dataset gebruikt; alleen de
  // apparaatvelden. Leest de apparaatvelden.
  function readDeviceFields(storage) {
    const v = parse(read(storage, LEGACY_KEY));
    const out = {};
    if (v && typeof v === 'object') DEVICE_FIELDS.forEach(f => { if (v[f] !== undefined) out[f] = v[f]; });
    return out;
  }

  // ---------- Back-ups (opdracht 7) ----------
  // Schema- en versiecontrole vóór herstel. Onbekende onderdelen met een geldige naam blijven toegestaan (de app bewaart
  // onbekende velden bewust, zie migrateData); bekende onderdelen moeten het juiste type hebben.
  const SUPPORTED_VERSION = 2;
  const LIST_SECTIONS = Object.freeze(['planning', 'calendars', 'excludedCalendars', 'meals', 'groceries', 'freezer', 'chores', 'stock', 'ideas', 'home', 'tripFolders', 'tripSections', 'trips', 'fuelEntries', 'cars']);
  const OBJECT_SECTIONS = Object.freeze(['dailyAnswers', 'budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23']);
  const BACKUP_RESERVED = Object.freeze(['__proto__', 'constructor', 'prototype', 'legacy_full']);
  // Strikte allowlist (opdracht 7, vervolg): alleen deze onderdelen mogen via een back-up in een account terechtkomen.
  // Afgeleid uit de onderdelen die de app zelf leest en schrijft. Apparaatvelden en meta worden apart behandeld
  // (nooit overgenomen). Een back-up met een ander onderdeel wordt in een account in zijn geheel geweigerd.
  const ACCOUNT_SECTIONS = Object.freeze([
    'planning', 'calendars', 'excludedCalendars', 'meals', 'groceries', 'freezer', 'chores', 'stock', 'ideas', 'home',
    'tripFolders', 'tripSections', 'trips', 'tasks', 'dailyAnswers',
    'budget', 'budget19', 'budget219', 'budgetV22', 'budgetV23', 'fuelEntries', 'cars',
    'nutrition', 'challengeDataV26',
    'offers25', 'offerSearchCache25', 'offerArchive25', 'offerCategoryCache25', 'offerCurrentQuery25', 'offerScheduled25', 'favoriteOffers25',
    'priceReferences', 'priceReferenceUpdatedAt', 'priceReferenceSource'
  ]);
  const NON_DATA_FIELDS = Object.freeze(['meta', ...DEVICE_FIELDS]);
  const unknownSections = value => Object.keys(isPlain(value) ? value : {}).filter(k => !ACCOUNT_SECTIONS.includes(k) && !NON_DATA_FIELDS.includes(k));
  // Splitst een back-up in toegestane gegevens (zonder apparaatvelden) en onbekende onderdelen.
  function splitBackup(value) {
    const known = {}, unknown = {};
    for (const [k, v] of Object.entries(isPlain(value) ? value : {})) {
      if (DEVICE_FIELDS.includes(k)) continue;
      if (k === 'meta' || ACCOUNT_SECTIONS.includes(k)) known[k] = v; else unknown[k] = v;
    }
    return { known, unknown };
  }
  // Onbekende onderdelen uit een back-up in het lokale profiel: apart bewaard (quarantaine), nooit geladen of
  // gesynchroniseerd; alleen te downloaden in de lokale herstelmodus.
  const RESTORE_QUARANTINE_PREFIX = `${V3}|quarantine|`;
  function quarantineUnknown(storage, unknown, { source = 'back-up', now = () => new Date().toISOString() } = {}) {
    if (!unknown || !Object.keys(unknown).length) return null;
    const key = `${RESTORE_QUARANTINE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    storage.setItem(key, JSON.stringify({ meta: { quarantinedAt: now(), source }, ...unknown }));
    return key;
  }
  const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function validateBackup(value) {
    if (!isPlain(value)) return { ok: false, reason: 'schema', detail: 'geen object' };
    if (value.meta !== undefined && !isPlain(value.meta)) return { ok: false, reason: 'schema', detail: 'meta' };
    const version = value.meta && value.meta.version;
    if (version !== undefined && (!Number.isInteger(version) || version < 1 || version > SUPPORTED_VERSION)) return { ok: false, reason: 'version', detail: String(version) };
    for (const key of Object.keys(value)) {
      if (BACKUP_RESERVED.includes(key) || !/^[\w.-]{1,60}$/.test(key)) return { ok: false, reason: 'schema', detail: key };
      if (LIST_SECTIONS.includes(key) && !Array.isArray(value[key])) return { ok: false, reason: 'schema', detail: key };
      if (OBJECT_SECTIONS.includes(key) && !isPlain(value[key])) return { ok: false, reason: 'schema', detail: key };
    }
    return { ok: true };
  }

  // Mag een back-up in de actieve identiteit worden teruggezet?
  //   - account-back-up: alleen in precies hetzelfde account én huishouden;
  //   - bewaarde gegevens met vastgelegd doel: alleen in die identiteit;
  //   - zonder bewezen herkomst (oud formaat, lokaal profiel, quarantaine): alleen in de lokale identiteit, nooit
  //     automatisch in een account. Koppelen aan een account gaat daarna via de expliciete overstap.
  // exportIdentity staat in het bestand zelf: dit voorkomt vergissingen, het is geen bewijs tegen opzet.
  function backupAllowed(text, identity) {
    if (!identity || identity.mode === 'locked') return { ok: false, reason: 'locked' };
    const value = parse(text);
    const valid = validateBackup(value);
    if (!valid.ok) return valid;
    const origin = isPlain(value.meta) && isPlain(value.meta.exportIdentity) ? value.meta.exportIdentity : null;
    let result;
    if (origin && origin.mode === 'account') {
      result = identity.mode === 'account' && origin.accountId === identity.accountId && origin.householdId === identity.householdId
        ? { ok: true, origin: 'account' } : { ok: false, reason: 'other-identity' };
    } else if (origin && origin.mode === 'retained' && typeof origin.target === 'string' && origin.target) {
      result = origin.target === identity.key ? { ok: true, origin: 'retained' } : { ok: false, reason: 'other-identity' };
    } else result = identity.mode === 'local' ? { ok: true, origin: 'unverified' } : { ok: false, reason: 'unverified' };
    if (!result.ok) return result;
    // Strikte allowlist: in een account wordt een back-up met een onbekend onderdeel geweigerd (niets gewijzigd). In het
    // lokale profiel gaan onbekende onderdelen naar een aparte quarantaine (zie splitBackup/quarantineUnknown).
    const unknown = unknownSections(value);
    if (unknown.length && identity.mode === 'account') return { ok: false, reason: 'unknown-sections', sections: unknown };
    return { ...result, unknown };
  }

  // ---------- Huishoudcode per account + huishouden (opdracht 7) ----------
  // samenThuisHouseholdCodesV1 = { '<account>|<huishouden>': { code, source: 'entered'|'legacy-verified', verified, at } }
  // De oude globale code (samenThuisSyncV1.householdCode) blijft alleen voor het lokale profiel en de oude code-sync.
  // Een account gebruikt nooit de globale code om te schrijven: die geldt pas als code van een huishouden nadat hij
  // bestaande gegevens van precies dat huishouden heeft ontsleuteld (bewijs), zie account-sync.js.
  const CODES_KEY = 'samenThuisHouseholdCodesV1', SYNC_KEY = 'samenThuisSyncV1', MIN_CODE = 12;
  const codeSlot = identity => identity && identity.mode === 'account' && ID.test(identity.accountId || '') && ID.test(identity.householdId || '') ? `${identity.accountId}|${identity.householdId}` : null;
  function readCode(storage, identity) {
    const slot = codeSlot(identity);
    if (!slot) return null;
    const entry = readJson(storage, CODES_KEY, {})[slot];
    return isPlain(entry) && typeof entry.code === 'string' ? { code: entry.code, source: entry.source || 'entered', verified: entry.verified === true, at: entry.at || null } : null;
  }
  function setCode(storage, identity, code, { source = 'entered', verified = false, now = () => new Date().toISOString() } = {}) {
    const slot = codeSlot(identity);
    const value = String(code || '').trim();
    if (!slot) throw new Error('Een huishoudcode hoort bij een account en huishouden.');
    if (value.length < MIN_CODE) throw new Error('Kies een huishoudcode van minimaal 12 tekens');
    const all = readJson(storage, CODES_KEY, {});
    const map = isPlain(all) ? all : {};
    map[slot] = { code: value, source, verified: !!verified, at: now() };
    storage.setItem(CODES_KEY, JSON.stringify(map));
    return map[slot];
  }
  function markCodeVerified(storage, identity, code) {
    const cur = readCode(storage, identity);
    if (!cur || cur.code !== code || cur.verified) return cur;
    return setCode(storage, identity, code, { source: cur.source, verified: true });
  }
  // Mag met deze code een eerste versie naar een LEEG huishouden worden gestuurd? Alleen een code die de gebruiker
  // zelf voor dit account en huishouden heeft ingevuld, of een code die al bewezen bij dit huishouden hoort.
  const codeTrustedForEmpty = entry => !!entry && entry.code.length >= MIN_CODE && (entry.source === 'entered' || entry.verified === true);
  // Kandidaat uit de oude globale configuratie, uitsluitend voor een identiteit die al vóór deze versie op dit apparaat
  // bestond (doel van de migratie, of al gesynchroniseerd volgens de versie-administratie; toen gebruikte zij de globale
  // code). Een nieuwe identiteit krijgt nooit de globale code. Ook dan alleen bruikbaar om bestaande cloudgegevens van
  // dat huishouden te ontsleutelen (bewijs); nooit voor een eerste versie naar een leeg huishouden.
  function legacyCodeCandidate(storage, identity) {
    const slot = codeSlot(identity);
    if (!slot) return null;
    const existed = journal(storage).target === identity.key
      || readConfig(storage).slots.some(([a, h]) => a === identity.accountId && h === identity.householdId);
    if (!existed) return null;
    const v = readJson(storage, SYNC_KEY, {});
    const code = isPlain(v) ? String(v.householdCode || '').trim() : '';
    return code.length >= MIN_CODE ? code : null;
  }

  return { legacyRecordOwner, ACCOUNT_SECTIONS, unknownSections, splitBackup, quarantineUnknown, backupAllowed, validateBackup, retainedFor, readCode, setCode, markCodeVerified, codeTrustedForEmpty, legacyCodeCandidate, CODES_KEY, SUPPORTED_VERSION, LEGACY_KEY, V1_KEY, V3, LOCAL_V3, CFG_KEY, AUTH_KEY, JOURNAL_KEY, DEVICE_FIELDS, accountKey, resolve, keysFor, readConfig, setAccount,
    migrateLegacy, bindLocalToAccount, retained, readDeviceFields, withoutDeviceFields, hashValue, journal };
});
