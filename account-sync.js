/* Accountsynchronisatie per onderdeel (Supabase Auth + household_state). Legacy anon-sync blijft de standaard
   tot de gebruiker expliciet overstapt; daarna draait alleen de nieuwe route (geen dubbele schrijvers). */
(() => {
  'use strict';
  const HS = window.SamenThuisHouseholdSync, AUTH = window.SamenThuisAuth25;
  if (window.__ST_ACCOUNT_SYNC__ || !HS || !AUTH) return;
  window.__ST_ACCOUNT_SYNC__ = true;
  const KEY = 'samenThuisAccountSyncV1', PRE_KEY = 'samenThuisPreAccountSyncBackup';
  const st = { household: null, conflicts: [], message: '', busy: false, uid: AUTH.session()?.user?.id || '' };
  // Accountwissel: nooit huishouden/conflicten van het vorige account blijven gebruiken.
  function syncIdentity() {
    const uid = AUTH.session()?.user?.id || '';
    if (uid !== st.uid) Object.assign(st, { uid, household: null, conflicts: [], message: '' });
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  const store = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const accountMode = () => HS.syncRoute(load(), !!AUTH.session()?.user?.id) !== 'legacy';
  const slot = () => `${AUTH.session()?.user?.id || ''}:${st.household?.id || load().householdId || ''}`;
  const cloud = () => HS.createCloud({
    url: DEFAULT_PROJECT_URL, anonKey: DEFAULT_PUBLISHABLE_KEY,
    getToken: async () => (await AUTH.ready())?.access_token || ''
  });
  const esc2 = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const code = () => String(syncConfig.householdCode || '').trim();

  async function accountSync({ manual = false, resolutions = {} } = {}) {
    syncIdentity();
    if (syncing || st.busy) return { status: 'busy' };
    if (!navigator.onLine) { if (manual) toast('Geen internetverbinding; wijzigingen blijven lokaal bewaard'); syncError = ''; st.message = 'Offline: lokale wijzigingen worden later gesynchroniseerd.'; return { status: 'offline' }; }
    if (!AUTH.session()?.user?.id) { syncError = 'Aanmelden vereist'; st.message = 'Meld je aan via Instellingen om te synchroniseren. Je lokale gegevens blijven bewaard.'; if (manual) toast(st.message); updateSyncBadge(); return { status: 'signed-out' }; }
    let outcome = 'error';
    syncing = true; syncError = ''; updateSyncBadge();
    try {
      if (!window.crypto?.subtle) throw new Error('Versleuteling vereist HTTPS');
      if (code().length < 12) throw new Error('Vul eerst de huishoudcode in (minimaal 12 tekens).');
      const c = cloud();
      if (!st.household) st.household = await c.membership();
      if (!st.household) throw new Error('Dit account is nog geen lid van een huishouden.');
      const cfg = load(), mine = (cfg.bases || {})[slot()] || {};
      const result = await HS.runAccountSync({
        cloud: c, householdId: st.household.id, local: data, base: mine.base || {},
        hold: !!localStorage.getItem(RESTORE_HOLD_KEY), resolutions,
        encrypt: v => encryptData(v, code()), decrypt: p => decryptData(p, code())
      });
      let base = result.base;
      const pulled = Object.keys(result.pulls);
      if (pulled.length) {
        try { localStorage.setItem(PRE_KEY, JSON.stringify({ at: new Date().toISOString(), data })); }
        catch (_) { throw new Error('Geen ruimte voor een veiligheidskopie; cloudgegevens zijn niet toegepast.'); }
        const previous = data;
        data = migrateData({ ...data, ...result.pulls });
        if (save({ touch: false, sync: false }) === false) { data = previous; throw new Error('Lokaal opslaan is geblokkeerd; synchronisatie niet afgerond'); }
        const now = HS.sectionsOf(data);
        pulled.forEach(k => { base[k] = { version: base[k].version, hash: HS.hashValue(now[k]) }; });
      }
      const next = load(); next.bases = { ...(next.bases || {}), [slot()]: { base, lastSyncedAt: new Date().toISOString() } };
      next.householdId = st.household.id; store(next);
      st.conflicts = result.conflicts;
      outcome = result.status;
      if (result.status === 'ok') {
        syncConfig.lastSyncedAt = new Date().toISOString(); localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
        try { localStorage.removeItem(RESTORE_HOLD_KEY); } catch (_) {}
        st.message = result.pushed.length || pulled.length ? `Bijgewerkt: ${result.pushed.length} verstuurd, ${pulled.length} ontvangen.` : 'Apparaten zijn gelijk.';
        if (manual) toast('Apparaten zijn bijgewerkt');
      } else if (result.status === 'conflict') {
        syncError = 'Wijzigingen op beide apparaten; kies per onderdeel welke versie je bewaart.';
        st.message = syncError; toast(syncError);
      } else {
        const f = result.failed[0].error; syncError = f.message; st.message = f.message;
        if (manual) toast(f.message);
      }
      if (current === 'settings' || pulled.length) render();
      return { status: outcome };
    } catch (error) {
      const c = HS.classifyError(error);
      console.error('Accountsynchronisatie mislukt', error);
      syncError = c.kind === 'network' ? '' : c.message; st.message = c.message;
      if (manual) toast(c.message);
      if (current === 'settings') render();
      return { status: HS.classifyError(error).kind };
    } finally { syncing = false; updateSyncBadge(); }
  }

  const legacySync = syncNow;
  syncNow = function (opts) { return accountMode() ? accountSync(opts) : legacySync(opts); };
  const legacyBadge = updateSyncBadge;
  updateSyncBadge = function (message) {
    legacyBadge(message);
    const badge = document.querySelector('#syncState');
    if (!badge || message || !accountMode()) return;
    badge.textContent = syncing ? 'Synchroniseren…' : !AUTH.session()?.user?.id ? 'Aanmelden vereist · lokaal bewaard' : !navigator.onLine ? 'Offline · later synchroniseren' : st.conflicts.length ? 'Conflict · kies versie' : syncError ? 'Sync controleren' : 'Account-sync gelijk';
    badge.classList.toggle('connected', !syncing && !syncError && !st.conflicts.length && !!AUTH.session()?.user?.id);
  };

  async function activate() {
    st.busy = true; st.message = '';
    try {
      if (code().length < 12) throw new Error('Vul eerst de huishoudcode in (minimaal 12 tekens); die blijft de versleutelingssleutel.');
      if (!AUTH.session()?.user?.id) throw new Error('Meld je eerst aan met je persoonlijke account.');
      const c = cloud(); st.household = await c.membership();
      if (!st.household) throw new Error('Maak eerst een huishouden aan of voeg je toe met de code van je huisgenoot.');
      let legacyNote = '';
      try { legacyNote = (await c.importLegacy(st.household.id, await sha256(code()))) ? ' Bestaande clouddata is veilig gekopieerd.' : ''; }
      catch (e) { const k = HS.classifyError(e); if (k.kind === 'migration' || k.kind === 'auth') throw new Error(k.message); legacyNote = ' Let op: oude clouddata kon niet worden gekopieerd (' + k.message + ').'; }
      st.busy = false;
      // Eerst één geslaagde ronde, pas dán inschakelen; bij fout/offline blijft de oude route onaangetast.
      const first = await accountSync({ manual: true });
      if (HS.shouldEnable(first.status)) {
        const cfg = load(); cfg.enabled = true; cfg.householdId = st.household.id; store(cfg);
        st.message = (st.message || '') + legacyNote;
      } else {
        st.message = 'Overstappen niet voltooid: ' + (st.message || 'controleer je verbinding en probeer opnieuw') + ' De oude code-sync blijft actief; er is niets gewijzigd.';
      }
    } catch (e) { st.message = e.message || 'Overstappen mislukt'; toast(st.message); }
    finally { st.busy = false; render(); }
  }
  async function household(kind, value) {
    try {
      const c = cloud();
      if (kind === 'create') await c.createHousehold(value); else await c.joinHousehold(value);
      st.household = null; st.message = kind === 'create' ? 'Huishouden aangemaakt.' : 'Je bent toegevoegd aan het huishouden.';
    } catch (e) { st.message = /maximaal twee/i.test(e.message) ? 'Dit huishouden heeft al twee accounts.' : HS.classifyError(e).message; }
    render();
  }

  async function storageContext() {
    if (!accountMode()) throw new Error('Bestandsopslag vereist actieve accountsynchronisatie.');
    const session = await AUTH.ready();
    if (!session?.user?.id) throw new Error('Meld je aan om Sport & Training-bestanden te gebruiken.');
    if (!st.household) st.household = await cloud().membership();
    if (!st.household?.id) throw new Error('Dit account is nog geen lid van een huishouden.');
    return { session, householdId: String(st.household.id) };
  }

  function storagePathForHousehold(path, householdId) {
    const value = String(path || '');
    if (!value.startsWith(`${householdId}/`) || value.split('/').length !== 3
      || value.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Ongeldig of niet-toegestaan huishoudbestandspad.');
    }
    return value;
  }

  function storageObjectUrl(path) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `${authBase25()}/storage/v1/object/sport-training/${encoded}`;
  }

  async function uploadSportFile(file, itemId) {
    if (!(file instanceof Blob) || !file.name) throw new Error('Selecteer een geldig bestand.');
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Bestanden moeten maximaal 10 MB zijn.');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Alleen PDF, JPG/JPEG, PNG en WebP zijn toegestaan.');
    const { session, householdId } = await storageContext();
    const safeName = file.name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'bestand';
    const path = `${householdId}/${String(itemId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)}/${safeName}`;
    const response = await fetch(storageObjectUrl(path), {
      method: 'POST',
      headers: { apikey: DEFAULT_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: file
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Bestand uploaden mislukt (${response.status}); controleer de Storage-migratie.`);
    }
    return { path, fileName: file.name, contentType: file.type, size: file.size };
  }

  async function signedSportFileUrl(path) {
    const { session, householdId } = await storageContext();
    const safePath = storagePathForHousehold(path, householdId);
    const encoded = safePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${authBase25()}/storage/v1/object/sign/sport-training/${encoded}`, {
      method: 'POST',
      headers: { apikey: DEFAULT_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 120 })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Bestand openen mislukt (${response.status}); controleer de Storage-migratie.`);
    }
    const result = await response.json();
    const signed = String(result.signedURL || '');
    if (!signed) throw new Error('Geen tijdelijke bestandslink ontvangen.');
    return signed.startsWith('http') ? signed : `${authBase25()}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`;
  }

  async function deleteSportFile(path) {
    const { session, householdId } = await storageContext();
    const safePath = storagePathForHousehold(path, householdId);
    const response = await fetch(`${authBase25()}/storage/v1/object/sport-training`, {
      method: 'DELETE',
      headers: { apikey: DEFAULT_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [safePath] })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Bestand verwijderen mislukt (${response.status}).`);
    }
    return true;
  }

  function card() {
    const signed = !!AUTH.session()?.user?.id, on = accountMode();
    const conflicts = st.conflicts.map(c => `<li class="list-item"><div class="item-main"><strong>${esc2(c.section)}</strong><small>Lokaal en cloud verschillen</small></div><button class="secondary" data-acct-resolve="${esc2(c.section)}:local">Mijn versie</button><button class="secondary" data-acct-resolve="${esc2(c.section)}:remote">Cloudversie</button></li>`).join('');
    const hh = st.household ? `<p class="muted">Huishouden <strong>${esc2(st.household.name)}</strong> · uitnodigingscode voor je partner: <code>${esc2(st.household.join_code)}</code> (maximaal 2 accounts)</p>` : '';
    const body = (!signed && !on) ? '<p class="muted">Meld je hierboven aan met je persoonlijke account om over te stappen.</p>'
      : on ? `${hh}<div class="button-row"><button class="primary" data-acct-sync>Nu synchroniseren</button><button class="secondary" data-acct-off>Terug naar oude code-sync</button></div>`
      : `${hh}<form class="form-grid compact-form" data-acct-create><label class="field">Nieuw huishouden<input name="name" maxlength="80" placeholder="Naam huishouden"></label><button class="secondary">Aanmaken</button></form>
         <form class="form-grid compact-form" data-acct-join><label class="field">Code van je partner<input name="code" maxlength="20" autocomplete="off"></label><button class="secondary">Toevoegen</button></form>
         <button class="primary" data-acct-on ${st.busy ? 'disabled' : ''}>Overstappen naar accountsync</button>`;
    return `<section class="card settings-card" data-acct-card><div class="card-head"><div><p class="eyebrow">VEILIGE SYNC</p><h2>Accountsynchronisatie per onderdeel</h2></div><span class="tag ${on ? 'green' : ''}">${on ? 'Actief' : 'Niet actief'}</span></div>
      <p class="muted">Alleen leden van jouw huishouden kunnen de versleutelde gegevens lezen of wijzigen. De oude code-sync blijft staan tot je overstapt en wordt daarna niet meer gebruikt. Er wordt eerst een veiligheidskopie van je lokale data gemaakt bij het overnemen van cloudgegevens.</p>
      ${body}<p role="status" aria-live="polite" class="small-note">${esc2(st.message)}</p>${conflicts ? `<ul class="list">${conflicts}</ul>` : ''}</section>`;
  }
  const baseRender = render;
  render = function (...a) {
    const r = baseRender.apply(this, a);
    if (current === 'settings') { const v = document.querySelector('#view'); if (v && !v.querySelector('[data-acct-card]')) v.insertAdjacentHTML('beforeend', card()); }
    return r;
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-acct-on],[data-acct-sync],[data-acct-off],[data-acct-resolve]'); if (!t) return;
    if (t.matches('[data-acct-on]')) activate();
    else if (t.matches('[data-acct-sync]')) accountSync({ manual: true });
    else if (t.matches('[data-acct-off]')) {
      try { localStorage.setItem(PRE_KEY + 'Off', JSON.stringify({ at: new Date().toISOString(), data })); } catch (_) {}
      // Herstelvlag: de oude sync overschrijft pas na een bewuste keuze, zodat wijzigingen van het partnerapparaat niet verloren gaan.
      try { localStorage.setItem(RESTORE_HOLD_KEY, '1'); } catch (_) {}
      const c = load(); c.enabled = false; store(c); st.conflicts = []; st.message = 'Oude code-sync is weer actief. Bij verschillen vraagt de app eerst welke versie je bewaart.'; render(); updateSyncBadge(); }
    else { const [s, ch] = t.dataset.acctResolve.split(':'); accountSync({ manual: true, resolutions: { [s]: ch } }); }
  });
  document.addEventListener('submit', e => {
    if (e.target.matches('[data-acct-create]')) { e.preventDefault(); household('create', e.target.elements.name.value); }
    else if (e.target.matches('[data-acct-join]')) { e.preventDefault(); household('join', e.target.elements.code.value); }
  });
  window.addEventListener('online', () => { if (accountMode()) accountSync(); });
  window.SamenThuisAccountSync = {
    active: accountMode, sync: accountSync, conflicts: () => st.conflicts,
    uploadSportFile, signedSportFileUrl, deleteSportFile
  };
})();
