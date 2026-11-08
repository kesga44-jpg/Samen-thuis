(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisHouseholdSync = core;
})(globalThis, function () {
  // Lokale-only sleutels: apparaatinstellingen en meta worden nooit per onderdeel gesynchroniseerd.
  const SKIP_KEYS = ['settings', 'meta'];
  const LEGACY_SECTION = 'legacy_full';

  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hashValue(v) {
    const s = stable(v); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + ':' + s.length;
  }
  function isEmptyValue(v) {
    if (v == null || v === '' || v === false) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  }
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const RESERVED = ['meta', 'settings', 'legacy_full', '__proto__', 'constructor', 'prototype'];
  const validSection = n => typeof n === 'string' && /^[\w.-]{1,60}$/.test(n) && !RESERVED.includes(n);
  function sectionsOf(data) {
    const out = {};
    Object.keys(data || {}).forEach(k => { if (validSection(k)) out[k] = data[k]; });
    return out;
  }


  // ---------- Automatisch samenvoegen (3-wegs) ----------
  // Doel: wijzigingen van beide huisgenoten in hetzelfde onderdeel (bijv. allebei een boodschap toevoegen)
  // samenvoegen in plaats van een conflict te tonen. Werkt met de laatst gesynchroniseerde versie als basis.
  // - Lijsten met objecten met `id`: per id samenvoegen (toegevoegd, gewijzigd, verwijderd per kant).
  // - Objecten: per sleutel. Lijsten met tekst/getallen: als verzameling (toevoegen/verwijderen per kant).
  // - Hetzelfde veld aan beide kanten verschillend gewijzigd = echt conflict. Standaard wordt dat gemeld
  //   (nooit stil overschrijven); alleen met onConflict 'remote' of 'local' (expliciete keuze van de gebruiker) wint één kant.
  const MISSING = undefined;
  const same = (a, b) => stable(a) === stable(b);
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const hasId = v => isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number') && v.id !== '';
  const idList = a => Array.isArray(a) && a.length > 0 && a.every(hasId) && new Set(a.map(x => String(x.id))).size === a.length;
  const primList = a => Array.isArray(a) && a.every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x));

  function merge3(base, local, remote, opts = {}, path = '') {
    const conflicts = opts.conflicts || (opts.conflicts = []);
    if (same(local, remote)) return local;
    if (base !== MISSING && same(base, local)) return remote;
    if (base !== MISSING && same(base, remote)) return local;
    if (local === MISSING) return remote;          // toegevoegd aan de andere kant (zonder basis)
    if (remote === MISSING) return local;
    const listsOk = Array.isArray(local) && Array.isArray(remote) && (base === MISSING || Array.isArray(base));
    if (listsOk && (local.length === 0 || idList(local)) && (remote.length === 0 || idList(remote)) && (base === MISSING || base.length === 0 || idList(base)) && (local.length || remote.length)) {
      const key = x => String(x.id);
      const B = new Map((base || []).map(x => [key(x), x])), L = new Map(local.map(x => [key(x), x])), R = new Map(remote.map(x => [key(x), x]));
      const order = [...remote.map(key), ...local.map(key).filter(k => !R.has(k))];
      const out = [];
      for (const k of order) {
        const b = B.get(k), l = L.get(k), r = R.get(k), p = `${path}[${k}]`;
        if (l && r) { out.push(merge3(b, l, r, opts, p)); continue; }
        const only = l || r;
        if (!b) { out.push(only); continue; }                       // nieuw aan één kant
        if (same(b, only)) continue;                                // ongewijzigd aan de ene kant, verwijderd aan de andere
        // Gewijzigd aan de ene kant, verwijderd aan de andere: het gewijzigde item blijft bestaan (niets gaat verloren).
        out.push(only);
      }
      return out;
    }
    if (listsOk && primList(local) && primList(remote) && (base === MISSING || primList(base))) {
      const bs = new Set((base || []).map(x => stable(x)));
      const ls = new Set(local.map(x => stable(x))), rs = new Set(remote.map(x => stable(x)));
      const out = [];
      const seen = new Set();
      for (const v of [...remote, ...local]) {
        const k = stable(v); if (seen.has(k)) continue; seen.add(k);
        const inL = ls.has(k), inR = rs.has(k), inB = bs.has(k);
        if (inL && inR) out.push(v);
        else if (!inB) out.push(v);                                 // toegevoegd aan één kant
        // in basis en aan één kant verwijderd → weg
      }
      return out;
    }
    if (isObj(local) && isObj(remote) && (base === MISSING || isObj(base))) {
      const out = {};
      const keys = [...new Set([...Object.keys(remote), ...Object.keys(local)])];
      for (const k of keys) {
        const b = base === MISSING ? MISSING : base[k];
        const v = merge3(b === undefined && base !== MISSING && !(k in base) ? MISSING : b, k in local ? local[k] : MISSING, k in remote ? remote[k] : MISSING, opts, path ? `${path}.${k}` : k);
        if (v !== MISSING) out[k] = v;
      }
      // Verwijderd aan de ene kant en ongewijzigd aan de andere: niet meenemen.
      if (base !== MISSING) for (const k of Object.keys(base)) {
        if (!(k in local) && k in remote && same(base[k], remote[k])) delete out[k];
        if (!(k in remote) && k in local && same(base[k], local[k])) delete out[k];
      }
      return out;
    }
    // Scalars of onvergelijkbare structuren die aan beide kanten anders zijn gewijzigd.
    if (opts.onConflict === 'remote') return remote;
    if (opts.onConflict === 'local') return local;
    conflicts.push(path || '(onderdeel)');
    return local;
  }

  // Voegt één onderdeel samen. Geeft { ok, value, conflicts } terug; ok=false betekent: gebruiker moet kiezen.
  function mergeSection(base, local, remote, { onConflict = 'report' } = {}) {
    const opts = { onConflict, conflicts: [] };
    const value = merge3(base, local, remote, opts);
    return { ok: opts.conflicts.length === 0, value, conflicts: opts.conflicts };
  }

  // remote: {section:{version, value}} ; base: {section:{version, hash}} ; resolutions: {section:'local'|'remote'}
  function planSections({ local, remote, base = {}, hold = false, resolutions = {} }) {
    const L = sectionsOf(local), actions = [];
    const allLocalEmpty = Object.values(L).every(isEmptyValue);
    const names = [...new Set([...Object.keys(L), ...Object.keys(remote)])].sort();
    for (const s of names) {
      const hasL = s in L, r = remote[s], b = base[s];
      const lh = hasL ? hashValue(L[s]) : null, rh = r ? hashValue(r.value) : null;
      const res = resolutions[s];
      let act;
      if (r && !hasL) act = 'pull';
      else if (hasL && !r) act = isEmptyValue(L[s]) ? 'none' : 'push';
      else if (lh === rh) act = 'adopt';
      else if (res === 'remote') act = 'pull';
      else if (res === 'local') act = 'push';
      else if (allLocalEmpty && !isEmptyValue(r.value)) act = 'pull';
      else if (b) {
        const lc = lh !== b.hash, rc = r.version !== b.version;
        act = !lc && !rc ? 'none' : lc && !rc ? (hold ? 'conflict' : 'push') : !lc && rc ? 'pull' : 'conflict';
      } else if (isEmptyValue(L[s])) act = 'pull';
      else if (isEmptyValue(r.value)) act = hold ? 'conflict' : 'push';
      else act = 'conflict';
      actions.push({ section: s, action: act, expectedVersion: r ? r.version : 0, localHash: lh, remoteHash: rh });
    }
    return actions;
  }

  function classifyError(err) {
    const status = err?.status || 0, code = String(err?.code || ''), msg = String(err?.message || '');
    if (code === '40001' || /Versieconflict/i.test(msg)) return { kind: 'conflict', message: 'De andere versie is ondertussen bijgewerkt. Je lokale gegevens zijn niet overschreven: tik op Nu synchroniseren en kies per onderdeel welke versie je bewaart.' };
    if (status === 401 || status === 403 || code === '42501' || code === 'PGRST301') return { kind: 'auth', message: 'Geen toegang. Meld je opnieuw aan via Instellingen en controleer of je lid bent van dit huishouden. Je lokale gegevens zijn veilig.' };
    if (code === 'PGRST202' || code === '42P01' || code === 'PGRST205' || status === 404) return { kind: 'migration', message: 'Accountsynchronisatie is nog niet beschikbaar: de Supabase-migraties moeten eerst handmatig zijn toegepast. Je gebruikt voorlopig de oude code-sync of werkt lokaal; er gaat niets verloren.' };
    if (err instanceof TypeError || /failed to fetch|network/i.test(msg)) return { kind: 'network', message: 'Geen verbinding. Je wijzigingen blijven lokaal bewaard en worden automatisch gesynchroniseerd zodra je weer online bent.' };
    if (err?.name === 'OperationError' || /huishoudcode/i.test(msg)) return { kind: 'key', message: 'De huishoudcode past niet bij de versleutelde cloudgegevens. Controleer de code bij Instellingen; er is niets geschreven of overschreven.' };
    return { kind: 'other', message: msg || 'Synchronisatie mislukt' };
  }

  // Eenmaal ingeschakeld blijft de accountroute leidend, ook zonder sessie: nooit stilzwijgend terugvallen op anon-sync.
  function syncRoute(cfg, hasSession) {
    if (cfg && cfg.enabled) return hasSession ? 'account' : 'account-signed-out';
    return 'legacy';
  }
  // Schakelt pas in na een geslaagde (of conflict-)ronde; bij fouten/offline blijft de oude route actief.
  const shouldEnable = status => status === 'ok' || status === 'conflict';

  class CloudError extends Error { constructor(status, body) { super((body && (body.message || body.msg)) || ('Supabase ' + status)); this.status = status; this.code = body && body.code; } }

  // Dunne REST-client; token wordt per aanroep opgehaald (gebruikers-JWT, nooit een service-role key).
  function createCloud({ url, anonKey, getToken, fetchImpl }) {
    const f = fetchImpl || ((...a) => globalThis.fetch(...a)), base = String(url).replace(/\/+$/, '');
    async function call(path, opts = {}) {
      const token = await getToken();
      if (!token) throw new CloudError(401, { message: 'Niet aangemeld' });
      const res = await f(base + path, { ...opts, headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
      const body = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) throw new CloudError(res.status, body);
      return body;
    }
    const rpc = (name, args) => call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
    return {
      async membership() {
        const rows = await call('/rest/v1/household_members?select=role,households(id,name,join_code)&order=joined_at.asc&limit=1');
        return rows && rows[0] && rows[0].households ? { role: rows[0].role, ...rows[0].households } : null;
      },
      createHousehold: name => rpc('create_household', { p_name: name }),
      joinHousehold: code => rpc('join_household', { p_code: code }),
      readState: hid => call('/rest/v1/household_state?select=section,payload,version,updated_at&household_id=eq.' + encodeURIComponent(hid)),
      putState: (hid, section, payload, expected) => rpc('put_household_state', { p_household: hid, p_section: section, p_payload: payload, p_expected_version: expected }),
      importLegacy: (hid, legacyId) => rpc('import_legacy_household_data', { p_household: hid, p_legacy_id: legacyId })
    };
  }

  // Volledige synchronisatieronde. Schrijft nooit lokaal; geeft pulls/base terug zodat de app veilig kan opslaan.
  // baseValues: {section: waarde bij de laatste geslaagde synchronisatie} (lokaal bewaard). Daarmee worden gelijktijdige
  // wijzigingen automatisch samengevoegd. Ontbreekt de basis, dan blijft het oude gedrag (conflict → gebruiker kiest).
  // resolutions[s] === 'merge': door de gebruiker gekozen samenvoegen; bij echte veldconflicten wint de cloudversie.
  async function runAccountSync({ cloud, householdId, local, base = {}, baseValues = {}, hold = false, resolutions = {}, encrypt, decrypt }) {
    const rows = await cloud.readState(householdId);
    const remote = {}; let legacy = null;
    for (const row of rows || []) {
      const value = await decrypt(row.payload); // sleutelfout stopt vóór enig schrijven
      if (row.section === LEGACY_SECTION) legacy = value;
      else if (validSection(row.section)) remote[row.section] = { version: Number(row.version), value };
      // Onbekende/gereserveerde namen (bijv. settings) uit de cloud worden genegeerd: nooit apparaatinstellingen overschrijven.
    }
    if (legacy && typeof legacy === 'object') {
      for (const [k, v] of Object.entries(sectionsOf(legacy))) if (!(k in remote)) remote[k] = { version: 0, value: v };
    }
    const actions = planSections({ local, remote, base, hold, resolutions });
    const L = sectionsOf(local), newBase = { ...base }, pulls = {}, conflicts = [], pushed = [], failed = [], merged = [];
    const newBaseValues = {};
    for (const a of actions) {
      const s = a.section;
      // Conflict of gekozen samenvoegen: probeer 3-wegs samenvoegen; lukt dat zonder veldconflict, dan versturen we het resultaat.
      if ((a.action === 'conflict' && !hold) || resolutions[s] === 'merge') {
        const forced = resolutions[s] === 'merge';
        const hasBase = Object.prototype.hasOwnProperty.call(baseValues, s) && base[s] && hashValue(baseValues[s]) === base[s].hash;
        if (remote[s] && (hasBase || forced)) {
          const m = mergeSection(hasBase ? baseValues[s] : undefined, L[s], remote[s].value, { onConflict: forced ? 'remote' : 'report' });
          if (m.ok) {
            try {
              const version = await cloud.putState(householdId, s, await encrypt(m.value), remote[s].version);
              const h = hashValue(m.value);
              newBase[s] = { version: Number(version), hash: h }; newBaseValues[s] = m.value;
              pulls[s] = m.value; pushed.push(s); merged.push(s);
            } catch (e) {
              const c = classifyError(e);
              if (c.kind === 'conflict') conflicts.push({ section: s, local: L[s], remote: remote[s].value, remoteVersion: remote[s].version, raced: true });
              else failed.push({ section: s, error: c });
            }
            continue;
          }
          conflicts.push({ section: s, local: L[s], remote: remote[s].value, remoteVersion: remote[s].version, fields: m.conflicts.slice(0, 20) });
          continue;
        }
      }
      if (a.action === 'adopt') { newBase[s] = { version: a.expectedVersion, hash: a.localHash }; newBaseValues[s] = L[s]; }
      else if (a.action === 'none' && hasOwn(L, s) && base[s] && base[s].hash === a.localHash) newBaseValues[s] = L[s];
      else if (a.action === 'pull') { pulls[s] = remote[s].value; newBase[s] = { version: remote[s].version, hash: a.remoteHash }; newBaseValues[s] = remote[s].value; }
      else if (a.action === 'conflict') conflicts.push({ section: s, local: L[s], remote: remote[s].value, remoteVersion: remote[s].version });
      else if (a.action === 'push') {
        try {
          const version = await cloud.putState(householdId, s, await encrypt(L[s]), a.expectedVersion);
          newBase[s] = { version: Number(version), hash: a.localHash }; newBaseValues[s] = L[s]; pushed.push(s);
        } catch (e) {
          const c = classifyError(e);
          if (c.kind === 'conflict') conflicts.push({ section: s, local: L[s], remote: remote[s] ? remote[s].value : undefined, remoteVersion: a.expectedVersion, raced: true });
          else { failed.push({ section: s, error: c }); }
        }
      }
    }
    return { status: failed.length ? 'partial' : conflicts.length ? 'conflict' : 'ok', pulls, base: newBase, baseValues: newBaseValues, pushed, merged, conflicts, failed, hadLegacy: !!legacy };
  }

  // Legacy-route (één payload): alle onderdelen samenvoegen; meta/settings blijven lokaal.
  function mergeData(base, local, remote, { onConflict = 'report' } = {}) {
    const L = sectionsOf(local), R = sectionsOf(remote), B = base ? sectionsOf(base) : null;
    const out = { ...local }; const conflicts = [];
    for (const s of [...new Set([...Object.keys(L), ...Object.keys(R)])]) {
      const m = mergeSection(B ? (hasOwn(B, s) ? B[s] : undefined) : undefined, hasOwn(L, s) ? L[s] : undefined, hasOwn(R, s) ? R[s] : undefined, { onConflict });
      if (m.value === undefined) delete out[s]; else out[s] = m.value;
      m.conflicts.forEach(c => conflicts.push(`${s}${c && c !== '(onderdeel)' ? (c.startsWith('[') ? '' : '.') + c : ''}`));
    }
    return { ok: conflicts.length === 0, value: out, conflicts };
  }

  return { syncRoute, shouldEnable, validSection, SKIP_KEYS, LEGACY_SECTION, hashValue, isEmptyValue, sectionsOf, planSections, classifyError, createCloud, runAccountSync, CloudError, merge3, mergeSection, mergeData };
});
