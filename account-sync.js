/* Accountsynchronisatie per onderdeel (Supabase Auth + household_state). Legacy anon-sync blijft de standaard
   tot de gebruiker expliciet overstapt; daarna draait alleen de nieuwe route (geen dubbele schrijvers). */
(() => {
  'use strict';
  const HS = window.SamenThuisHouseholdSync, AUTH = window.SamenThuisAuth25;
  if (window.__ST_ACCOUNT_SYNC__ || !HS || !AUTH || !window.SamenThuisSyncMeta) return;
  window.__ST_ACCOUNT_SYNC__ = true;
  const KEY = 'samenThuisAccountSyncV1', PRE_KEY = 'samenThuisPreAccountSyncBackup';
  // Laatst door de server bevestigde waarde per onderdeel (per account + huishouden): basis voor automatisch samenvoegen.
  // Alleen op dit apparaat, in IndexedDB (sync-meta-store.js; fallback localStorage, daarna geheugen). Ontbreekt de basis,
  // dan valt de app terug op "kies per onderdeel" (geen dataverlies).
  const META = window.SamenThuisSyncMeta.shared();
  const TAB = window.SamenThuisTabSync;
  const LOCK = TAB ? TAB.createSyncLock({ name: 'samen-thuis-account-sync', locks: navigator.locks, storage: localStorage }) : null;
  const CHANNEL = TAB ? TAB.createChannel({ name: 'samen-thuis-account-sync', tabId: LOCK && LOCK.tabId }) : null;
  const loadBaseValues = async bases => { try { return await META.loadBaseValues(slot(), bases); } catch (_) { return {}; } };
  const storeBaseValues = async values => {
    try { await META.saveBaseValues(slot(), values); return true; }
    catch (_) { console.warn('Basis voor samenvoegen kon niet worden bewaard; bij gelijktijdige wijzigingen wordt om een keuze gevraagd.'); return false; }
  };
  let rerunRequested = false, retryTimer = null;
  function scheduleRetry(ms) {
    if (retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; if (accountMode()) accountSync(); }, ms);
  }
  const SECTION_LABELS = { groceries: 'boodschappen', meals: 'weekmenu', planning: 'agenda', chores: 'routines', tasks: 'taken', stock: 'voorraad', freezer: 'vriezer', ideas: 'date-ideeën', home: 'woning', trips: 'reizen', tripFolders: 'reizen', tripSections: 'reizen', budgetV23: 'financiën', nutrition: 'voeding', challengeDataV26: 'challenges', dailyAnswers: 'vraag van de dag' };
  const label = s => SECTION_LABELS[s] || s;
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
    // Al een ronde bezig in dit tabblad: niet parallel starten, wel direct daarna nog één ronde (niets gaat verloren).
    if (syncing || st.busy) { rerunRequested = true; return { status: 'busy' }; }
    if (!navigator.onLine) { if (manual) toast('Geen internetverbinding; wijzigingen blijven lokaal bewaard'); syncError = ''; st.message = 'Offline: lokale wijzigingen worden later gesynchroniseerd.'; return { status: 'offline' }; }
    if (!AUTH.session()?.user?.id) { syncError = 'Aanmelden vereist'; st.message = 'Meld je aan via Instellingen om te synchroniseren. Je lokale gegevens blijven bewaard.'; if (manual) toast(st.message); updateSyncBadge(); return { status: 'signed-out' }; }
    syncing = true;
    try {
      // Eén ronde tegelijk per apparaat (alle tabbladen). Bezet: een ander tabblad synchroniseert; later opnieuw proberen.
      const locked = LOCK ? await LOCK.run(() => accountSyncRound({ manual, resolutions })) : { acquired: true, value: await accountSyncRound({ manual, resolutions }) };
      if (!locked.acquired) { scheduleRetry(2500); return { status: 'busy' }; }
      return locked.value;
    } finally {
      syncing = false; updateSyncBadge();
      if (rerunRequested && accountMode() && navigator.onLine) { rerunRequested = false; scheduleRetry(300); }
    }
  }

  async function accountSyncRound({ manual, resolutions }) {
    let outcome = 'error';
    syncError = ''; updateSyncBadge();
    try {
      if (!window.crypto?.subtle) throw new Error('Versleuteling vereist HTTPS');
      if (code().length < 12) throw new Error('Vul eerst de huishoudcode in (minimaal 12 tekens).');
      const c = cloud();
      if (!st.household) st.household = await c.membership();
      if (!st.household) throw new Error('Dit account is nog geen lid van een huishouden.');
      const roundSlot = slot();
      const cfg = load(), mine = (cfg.bases || {})[roundSlot] || {};
      const prevBase = mine.base || {};
      const prevBaseValues = await loadBaseValues(prevBase);
      // Consistente momentopname: wijzigingen die tijdens de ronde binnenkomen raken deze ronde niet.
      const snapshot = structuredClone(data);
      const raw = await HS.runAccountSync({
        cloud: window.SamenThuisSyncMeta.trackUploads(c, META, roundSlot, HS.classifyError), householdId: st.household.id,
        local: snapshot, base: prevBase, baseValues: prevBaseValues,
        hold: !!localStorage.getItem(RESTORE_HOLD_KEY), resolutions,
        encrypt: v => encryptData(v, code()), decrypt: p => decryptData(p, code())
      });
      // Onderdelen die tijdens de ronde lokaal zijn gewijzigd: oudere cloudrespons niet toepassen (volgende ronde voegt samen).
      const result = HS.deferChangedPulls({ snapshot, current: data, result: raw, prevBase, prevBaseValues });
      if (result.deferred.length) rerunRequested = true;
      let base = result.base;
      const pulled = Object.keys(result.pulls);
      if (pulled.length) {
        try { localStorage.setItem(PRE_KEY, JSON.stringify({ at: new Date().toISOString(), data })); }
        catch (_) { throw new Error('Geen ruimte voor een veiligheidskopie; cloudgegevens zijn niet toegepast.'); }
        const previous = data;
        data = migrateData({ ...data, ...result.pulls });
        // Basis vastleggen vóór het opslaan: neemt save() een wijziging uit een ander tabblad mee, dan blijft die
        // als lokale wijziging herkenbaar (hash wijkt af van de basis) en gaat hij in de volgende ronde alsnog mee.
        const applied = HS.sectionsOf(data);
        const appliedHash = Object.fromEntries(pulled.map(k => [k, HS.hashValue(applied[k])]));
        const appliedValue = Object.fromEntries(pulled.map(k => [k, structuredClone(applied[k])]));
        if (save({ touch: false, sync: false }) === false) { data = previous; throw new Error('Lokaal opslaan is geblokkeerd; synchronisatie niet afgerond'); }
        const now = HS.sectionsOf(data);
        pulled.forEach(k => {
          base[k] = { version: base[k].version, hash: appliedHash[k] }; result.baseValues[k] = appliedValue[k];
          if (HS.hashValue(now[k]) !== appliedHash[k]) rerunRequested = true;
        });
      }
      // Volgorde voor crashbestendigheid: eerst basiswaarden (IndexedDB, met vorige waarde), dan de versie-administratie.
      await storeBaseValues(result.baseValues);
      const next = load(); next.bases = { ...(next.bases || {}), [roundSlot]: { base, lastSyncedAt: new Date().toISOString() } };
      next.householdId = st.household.id; store(next);
      st.conflicts = result.conflicts;
      try {
        await META.saveConflicts(roundSlot, result.conflicts);
        if (result.status === 'ok') await META.clearInflight(roundSlot);
      } catch (_) {}
      if (CHANNEL) CHANNEL.post('sync-finished', { slot: roundSlot, status: result.status });
      outcome = result.status;
      if (result.status === 'ok') {
        syncConfig.lastSyncedAt = new Date().toISOString(); localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
        try { localStorage.removeItem(RESTORE_HOLD_KEY); } catch (_) {}
        st.message = result.pushed.length || pulled.length
          ? `Synchronisatieronde afgerond: ${result.pushed.length} verstuurd, ${pulled.length} ontvangen.`
          : 'Geen wijzigingen gevonden in deze synchronisatieronde.';
        if (result.merged && result.merged.length) {
          const names = [...new Set(result.merged.map(label))].join(', ');
          st.message = `Wijzigingen van beide apparaten samengevoegd (${names}).`;
          toast(`Samengevoegd met de wijzigingen van je huisgenoot: ${names}`);
        }
        if (manual) toast('Synchronisatieronde afgerond');
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
    }
  }

  const legacySync = syncNow;
  syncNow = function (opts) { return accountMode() ? accountSync(opts) : legacySync(opts); };
  const legacyBadge = updateSyncBadge;
  updateSyncBadge = function (message) {
    legacyBadge(message);
    const badge = document.querySelector('#syncState');
    if (!badge || message || !accountMode()) return;
    badge.textContent = syncing ? 'Synchroniseren…' : !AUTH.session()?.user?.id ? 'Aanmelden vereist · lokaal bewaard' : !navigator.onLine ? 'Offline · later synchroniseren' : st.conflicts.length ? 'Conflict · kies versie' : syncError ? 'Sync controleren' : 'Laatst gesynchroniseerd · niet geverifieerd';
    badge.classList.remove('connected');
  };

  async function activate() {
    st.busy = true; st.message = '';
    try {
      if (code().length < 12) throw new Error('Vul eerst de huishoudcode in (minimaal 12 tekens); die blijft de versleutelingssleutel.');
      if (!AUTH.session()?.user?.id) throw new Error('Meld je eerst aan met je persoonlijke account.');
      const c = cloud(); st.household = await c.membership();
      if (!st.household) throw new Error('Maak eerst een huishouden aan of voeg je toe met de code van je huisgenoot.');
      st.busy = false;
      // Importing the opaque legacy payload would reintroduce SportCoach.
      const first = await accountSync({ manual: true });
      if (HS.shouldEnable(first.status)) {
        const cfg = load(); cfg.enabled = true; cfg.householdId = st.household.id; store(cfg);
        st.message = 'Accountsync is ingeschakeld. Oude code-syncdata is niet automatisch gekopieerd en blijft behouden op de oude route tot DB-1.';
      } else {
        st.message = 'Overstap niet voltooid: ' + (st.message || 'controleer je verbinding en probeer opnieuw') + ' Lokale gegevens zijn behouden; de oude serverroute blijft bestaan tot DB-1.';
      }
    } catch (e) { st.message = e.message || 'Overstappen mislukt'; toast(st.message); }
    finally { st.busy = false; render(); }
  }
  async function household(kind, value) {
    try {
      const c = cloud();
      if (kind === 'create') await c.createHousehold(value);
      else if (!await c.joinHousehold(value)) {
        throw new Error('De code is ongeldig of aanmelden is nu niet mogelijk. Probeer het later opnieuw.');
      }
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
    const conflicts = st.conflicts.map(c => `<li class="list-item"><div class="item-main"><strong>${esc2(label(c.section))}</strong><small>${c.fields && c.fields.length ? `Op beide apparaten anders gewijzigd: ${esc2(c.fields.slice(0, 3).join(', '))}${c.fields.length > 3 ? ' …' : ''}` : 'Lokaal en cloud verschillen'}</small></div><button class="primary" data-acct-resolve="${esc2(c.section)}:merge" title="Toevoegingen van beide blijven; is hetzelfde item op beide apparaten anders gewijzigd, dan wint de cloudversie">Beide samenvoegen</button><button class="secondary" data-acct-resolve="${esc2(c.section)}:local">Mijn versie</button><button class="secondary" data-acct-resolve="${esc2(c.section)}:remote">Cloudversie</button></li>`).join('');
    const hh = st.household ? `<p class="muted">Huishouden <strong>${esc2(st.household.name)}</strong> · uitnodigingscode voor je partner: <code>${esc2(st.household.join_code)}</code> (maximaal 2 accounts)</p>` : '';
    const body = (!signed && !on) ? '<p class="muted">Meld je hierboven aan met je persoonlijke account om over te stappen.</p>'
      : on ? `${hh}<div class="button-row"><button class="primary" data-acct-sync>Nu synchroniseren</button></div>`
      : `${hh}<form class="form-grid compact-form" data-acct-create><label class="field">Nieuw huishouden<input name="name" maxlength="80" placeholder="Naam huishouden"></label><button class="secondary">Aanmaken</button></form>
         <form class="form-grid compact-form" data-acct-join><label class="field">Code van je partner<input name="code" maxlength="20" autocomplete="off"></label><button class="secondary">Toevoegen</button></form>
         <button class="primary" data-acct-on ${st.busy ? 'disabled' : ''}>Overstappen naar accountsync</button>`;
    return `<section class="card settings-card" data-acct-card><div class="card-head"><div><p class="eyebrow">VEILIGE SYNC</p><h2>Accountsynchronisatie per onderdeel</h2></div><span class="tag ${on ? 'green' : ''}">${on ? 'Actief' : 'Niet actief'}</span></div>
      <p class="muted">SportCoach wordt niet gesynchroniseerd. De oude code-sync is in deze app gepauzeerd; oude clouddata wordt niet automatisch gekopieerd en blijft behouden tot DB-1. Een succesvolle accountsync bevestigt niet dat beide apparaten actueel gelijk zijn.</p>
      ${body}<p role="status" aria-live="polite" class="small-note">${esc2(st.message)}</p>${conflicts ? `<ul class="list">${conflicts}</ul>` : ''}</section>`;
  }
  const baseRender = render;
  render = function (...a) {
    const r = baseRender.apply(this, a);
    if (current === 'settings') { const v = document.querySelector('#view'); if (v && !v.querySelector('[data-acct-card]')) v.insertAdjacentHTML('beforeend', card()); }
    return r;
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-acct-on],[data-acct-sync],[data-acct-resolve]'); if (!t) return;
    if (t.matches('[data-acct-on]')) activate();
    else if (t.matches('[data-acct-sync]')) accountSync({ manual: true });
    else { const [s, ch] = t.dataset.acctResolve.split(':'); accountSync({ manual: true, resolutions: { [s]: ch } }); }
  });
  document.addEventListener('submit', e => {
    if (e.target.matches('[data-acct-create]')) { e.preventDefault(); household('create', e.target.elements.name.value); }
    else if (e.target.matches('[data-acct-join]')) { e.preventDefault(); household('join', e.target.elements.code.value); }
  });
  window.addEventListener('online', () => { if (accountMode()) accountSync(); });

  // Conflictstatus van een vorige sessie terughalen (tot de eerstvolgende ronde die ververst).
  (async () => {
    if (!accountMode()) return;
    try {
      const saved = await META.loadConflicts(slot());
      if (!st.conflicts.length && saved.length) { st.conflicts = saved; updateSyncBadge(); if (current === 'settings') render(); }
    } catch (_) {}
  })();
  // Een ander tabblad heeft een ronde afgerond: conflictstatus bijwerken (gegevens komen via het storage-event binnen).
  const offChannel = CHANNEL ? CHANNEL.on(msg => {
    if (msg.type !== 'sync-finished' || msg.slot !== slot()) return;
    META.loadConflicts(msg.slot).then(list => { st.conflicts = list; updateSyncBadge(); if (current === 'settings') render(); }).catch(() => {});
  }) : null;
  window.addEventListener('pagehide', event => {
    if (LOCK) LOCK.release();
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (!event.persisted && CHANNEL) { if (offChannel) offChannel(); CHANNEL.close(); }
  });

  // Onderdelen met lokale wijzigingen die de server nog niet heeft bevestigd (afgeleid uit duurzame gegevens + basis).
  function pendingSections() {
    const b = ((load().bases || {})[slot()] || {}).base || {};
    const S = HS.sectionsOf(data);
    return Object.keys(S).filter(k => b[k] ? b[k].hash !== HS.hashValue(S[k]) : !HS.isEmptyValue(S[k]));
  }

  window.SamenThuisAccountSync = {
    active: accountMode, sync: accountSync, conflicts: () => st.conflicts,
    pending: pendingSections, inflight: () => META.listInflight(slot()),
    uploadSportFile, signedSportFileUrl, deleteSportFile
  };
})();
