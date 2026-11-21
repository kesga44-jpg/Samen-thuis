/* Accountsynchronisatie per onderdeel (Supabase Auth + household_state). Legacy anon-sync blijft de standaard
   tot de gebruiker expliciet overstapt; daarna draait alleen de nieuwe route (geen dubbele schrijvers). */
(() => {
  'use strict';
  const HS = window.SamenThuisHouseholdSync, AUTH = window.SamenThuisAuth25;
  if (window.__ST_ACCOUNT_SYNC__ || !HS || !AUTH || !window.SamenThuisSyncMeta || !window.SamenThuisIdentityStore || !window.SamenThuisIdentity) return;
  window.__ST_ACCOUNT_SYNC__ = true;
  const KEY = 'samenThuisAccountSyncV1';
  // Opdracht 6: identiteit ligt vast per paginalading; accountsync staat per account aan (accounts[uid]).
  const IDS = window.SamenThuisIdentityStore, IDENT = window.SamenThuisIdentity;
  const PRE_KEY = IDENT.keys().preSyncKey;
  const accountCfg = () => { const uid = AUTH.session()?.user?.id; return uid ? IDS.readConfig(localStorage).accounts[uid] || null : null; };
  // Fout rond de huishoudcode met een eigen, specifieke melding (niet de algemene sleutelmelding).
  const codeError = message => Object.assign(new Error(message), { name: 'HouseholdCodeError', codeError: true });
  class StaleIdentity extends Error { constructor(message) { super(message); this.name = 'StaleIdentity'; } }
  // Laatst door de server bevestigde waarde per onderdeel (per account + huishouden): basis voor automatisch samenvoegen.
  // Alleen op dit apparaat, in IndexedDB (sync-meta-store.js; fallback localStorage, daarna geheugen). Ontbreekt de basis,
  // dan valt de app terug op "kies per onderdeel" (geen dataverlies).
  const META = window.SamenThuisSyncMeta.shared();
  const TAB = window.SamenThuisTabSync;
  const LOCK = TAB ? TAB.createSyncLock({ name: 'samen-thuis-account-sync', locks: navigator.locks, storage: localStorage }) : null;
  const CHANNEL = TAB ? TAB.createChannel({ name: 'samen-thuis-account-sync', tabId: LOCK && LOCK.tabId }) : null;
  // Financiële conflicten (finance-conflict-core.js): blokkeren de upload van het betreffende onderdeel tot er gekozen is.
  const FINC = window.SamenThuisFinanceConflicts;
  const FIN = FINC ? FINC.shared() : null;
  const isFinancialSection = s => !!(FINC && FINC.isFinancialSection(s));
  // Financiële conflicten horen bij één identiteit: '<accountId>:<huishoudenId>' (zelfde notatie als slot()); zie ownScope.
  // Apparaatconflicten ('device') horen bij het lokale profiel waarin ze ontstonden (opdracht 7). Alleen zichtbaar en
  // herstelbaar (met waarden) in die lokale identiteit; in een account nooit. Records zonder localKey (van vóór
  // opdracht 7) worden eerst aan hun profiel gekoppeld (M1, classifyUntaggedDevice); lukt dat niet betrouwbaar, dan
  // tonen we nergens waarden, maar blokkeren ze in elke accountronde de upload van dat onderdeel (beforeRound).
  const deviceVisible = r => {
    const id = IDENT.current();
    if (id.mode !== 'local' || IDENT.switching()) return false;
    return !!r.localKey && r.localKey === id.key;
  };
  // Open apparaatconflict zonder vaststaand profiel dat in deze accountidentiteit nog niet bewust is vrijgegeven.
  const unknownGuard = (r, scope) => r.scope === FINC.DEVICE_SCOPE && r.status === 'open' && !r.localKey && !(Array.isArray(r.releasedFor) && r.releasedFor.includes(scope));
  const classifyLegacyDevice = async () => {
    if (!FIN) return;
    try { await FIN.classifyUntaggedDevice(r => IDS.legacyRecordOwner(localStorage, r.detectedAt)); }
    catch (error) { console.error('Oude financiële apparaatconflicten niet gekoppeld; ze blijven de upload blokkeren', error); }
  };
  const deviceRecords = async () => (FIN ? (await FIN.list(FINC.DEVICE_SCOPE)).filter(deviceVisible) : []);
  // Eigen financiële scope = de identiteit van deze paginalading (niet een later gelezen sessie of configuratie).
  const ownScope = () => { const id = IDENT.current(); return FINC && id.mode === 'account' && !IDENT.switching() ? FINC.scopeFor(id.accountId, id.householdId) : null; };
  const loadBaseValues = async bases => { try { return await META.loadBaseValues(slot(), bases); } catch (_) { return {}; } };
  // Versie-administratie per slot. Staat de basis alleen in het geheugen (durability 'session'), dan blijft ook de
  // administratie in het geheugen: na herladen geldt dan geen enkele versie als bevestigd zonder duurzame basis.
  const sessionBases = {};
  let metaDurability = 'unknown';
  const readBases = s => sessionBases[s] || (((load().bases || {})[s] || {}).base) || {};
  function writeBases(s, base, { durable }) {
    if (!durable) { sessionBases[s] = base; return; }
    const next = load(); next.bases = { ...(next.bases || {}), [s]: { base, lastSyncedAt: new Date().toISOString() } };
    if (!store(next)) throw new Error('Versie-administratie kon niet worden opgeslagen (opslag vol of geblokkeerd).');
    delete sessionBases[s];
  }
  let rerunRequested = false, retryTimer = null;
  function scheduleRetry(ms) {
    if (retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; if (accountMode()) accountSync(); }, ms);
  }
  const SECTION_LABELS = { groceries: 'boodschappen', meals: 'weekmenu', planning: 'agenda', chores: 'routines', tasks: 'taken', stock: 'voorraad', freezer: 'vriezer', ideas: 'date-ideeën', home: 'woning', trips: 'reizen', tripFolders: 'reizen', tripSections: 'reizen', budgetV23: 'financiën', nutrition: 'voeding', challengeDataV26: 'challenges', dailyAnswers: 'vraag van de dag' };
  const label = s => SECTION_LABELS[s] || s;
  const st = { household: null, conflicts: [], finance: [], finChoices: {}, message: '', busy: false, uid: AUTH.session()?.user?.id || '' };
  // Accountwissel: nooit huishouden/conflicten van het vorige account blijven gebruiken.
  function syncIdentity() {
    const uid = AUTH.session()?.user?.id || '';
    if (uid !== st.uid) { Object.assign(st, { uid, household: null, conflicts: [], finance: [], finChoices: {}, message: '' }); if (!IDENT.reevaluate()) refreshFinance(); }
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  const store = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const accountMode = () => !!(AUTH.session()?.user?.id && accountCfg()?.enabled);
  const slot = () => `${AUTH.session()?.user?.id || ''}:${st.household?.id || accountCfg()?.householdId || ''}`;
  const cloud = () => HS.createCloud({
    url: DEFAULT_PROJECT_URL, anonKey: DEFAULT_PUBLISHABLE_KEY,
    getToken: async () => (await AUTH.ready())?.access_token || ''
  });
  const esc2 = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
      const c = cloud();
      // Elke ronde opnieuw: is het lidmaatschap veranderd (ander huishouden), dan hoort er een andere dataset bij.
      st.household = await c.membership();
      if (!st.household) throw new Error('Dit account is nog geen lid van een huishouden.');
      // De dataset van deze paginalading moet precies bij dit account en huishouden horen. Is het huishouden nog onbekend
      // of gewijzigd, dan wordt het vastgelegd en de pagina opnieuw geladen; deze ronde verwerkt dan niets.
      const uid = AUTH.session()?.user?.id || '';
      if (accountCfg()?.householdId !== st.household.id) IDS.setAccount(localStorage, uid, { householdId: st.household.id });
      if (IDENT.reevaluate()) throw new StaleIdentity('De gegevens van dit account en huishouden worden geladen.');
      const ident = IDENT.current();
      if (ident.mode !== 'account' || ident.accountId !== uid || ident.householdId !== st.household.id) throw new StaleIdentity('Deze gegevens horen niet bij dit account en huishouden; er wordt niets gesynchroniseerd.');
      const roundKey = ident.key;
      const assertIdentity = () => {
        if (IDENT.switching() || IDENT.current().key !== roundKey || (AUTH.session()?.user?.id || '') !== uid) throw new StaleIdentity('Account of huishouden is tijdens de synchronisatie gewijzigd; er is niets opgeslagen.');
      };
      // Huishoudcode van precies dit account + huishouden (opdracht 7). Ontbreekt die, dan alleen de oude globale code
      // als kandidaat: die mag uitsluitend gebruikt worden als hij bestaande gegevens van dit huishouden ontsleutelt.
      const codeEntry = IDS.readCode(localStorage, ident);
      const candidate = codeEntry ? null : IDS.legacyCodeCandidate(localStorage, ident);
      const roundCode = codeEntry ? codeEntry.code : candidate;
      if (!roundCode || roundCode.length < 12) throw codeError('Vul eerst de huishoudcode van dit huishouden in (minimaal 12 tekens). Er is niets verstuurd.');
      const mayCreate = !candidate && IDS.codeTrustedForEmpty(codeEntry);
      const roundSlot = slot();
      const prevBase = readBases(roundSlot);
      const prevBaseValues = await loadBaseValues(prevBase);
      const actor = AUTH.session()?.user?.id || null;
      // Financieel: onderbroken keuzes afronden, herintroducties blokkeren, bevroren onderdelen bepalen.
      // Financiële conflicten uitsluitend van deze identiteit (account + huishouden) van de ronde.
      const scope = FINC ? FINC.scopeFor(actor || '', st.household.id) : null;
      const FS = FIN && scope ? FIN.scoped(scope) : null;
      await classifyLegacyDevice(); // idempotent; mislukt dit, dan blokkeren de oude records toch (geen localKey)
      const fin = FS ? await FS.beforeRound({ data, prevBase, prevBaseValues, actor, householdId: st.household.id }) : { records: [], frozen: [], fixes: [] };
      assertIdentity();
      if (fin.fixes.length) {
        const previous = data;
        data = { ...data, ...Object.fromEntries(fin.fixes.map(f => [f.section, f.value])) };
        if (save({ touch: false, sync: false }) === false) { data = previous; throw new Error('Lokaal opslaan is geblokkeerd; financiële keuze nog niet toegepast.'); }
      }
      // Consistente momentopname: wijzigingen die tijdens de ronde binnenkomen raken deze ronde niet.
      const snapshot = structuredClone(data);
      const encrypt = v => encryptData(v, roundCode);
      const uploads = window.SamenThuisSyncMeta.trackUploads(c, META, roundSlot, HS.classifyError, (step, error) => console.warn('Syncmetadata (' + step + ') niet bewaard', error));
      // Fail-closed vóór enig schrijven: leeg huishouden → alleen met een voor deze identiteit ingevulde of bewezen code;
      // bestaande gegevens → eerst aantonen dat de code ze ontsleutelt (anders wordt er niets verstuurd).
      const tracked = { ...uploads, async readState(hid) {
        const rows = await uploads.readState(hid);
        const own = (rows || []).filter(r => r && r.section !== 'sportCoach');
        if (!own.length) {
          if (!mayCreate) throw codeError('Dit huishouden heeft nog geen gegevens in de cloud. Vul de huishoudcode van dit huishouden in voordat er iets wordt verstuurd. Er is niets verstuurd.');
          return rows;
        }
        try { await decryptData(own[0].payload, roundCode); }
        catch (_) { throw codeError(candidate ? 'De opgeslagen huishoudcode hoort niet bij dit huishouden. Vul de huishoudcode van dit huishouden in. Er is niets verstuurd.' : 'De huishoudcode past niet bij de gegevens van dit huishouden. Er is niets verstuurd of overschreven.'); }
        assertIdentity();
        // Bewezen: de code hoort bij dit huishouden. Een kandidaat wordt pas nu de code van deze identiteit.
        if (candidate) IDS.setCode(localStorage, ident, roundCode, { source: 'legacy-verified', verified: true });
        else IDS.markCodeVerified(localStorage, ident, roundCode);
        syncConfig.householdCode = roundCode; syncConfig.codeCandidate = false;
        return rows;
      } };
      // Een financieel onderdeel wordt nooit via de algemene keuzeknoppen opgelost (alleen via een keuze per veld).
      const generalResolutions = Object.fromEntries(Object.entries(resolutions || {}).filter(([s]) => !isFinancialSection(s)));
      const rawRound = await HS.runAccountSync({
        cloud: tracked, householdId: st.household.id,
        local: snapshot, base: prevBase, baseValues: prevBaseValues,
        hold: !!localStorage.getItem(RESTORE_HOLD_KEY), resolutions: generalResolutions,
        encrypt, decrypt: p => decryptData(p, roundCode),
        frozen: fin.frozen, protectedSections: FINC ? [...FINC.FINANCIAL_SECTIONS] : []
      });
      const finRound = FS
        ? await FS.afterRound({ raw: rawRound, records: fin.records, snapshot, prevBase, prevBaseValues, cloud: tracked, householdId: st.household.id, encrypt, classify: HS.classifyError, actor })
        : { result: rawRound, outcomes: [] };
      const raw = finRound.result;
      assertIdentity(); // na alle netwerkverzoeken: oude antwoorden schrijven niets na een accountwissel
      // Onderdelen die tijdens de ronde lokaal zijn gewijzigd: oudere cloudrespons niet toepassen (volgende ronde voegt samen).
      const result = HS.deferChangedPulls({ snapshot, current: data, result: raw, prevBase, prevBaseValues });
      if (result.deferred.length) rerunRequested = true;
      let base = result.base;
      const pulled = Object.keys(result.pulls);
      if (pulled.length) {
        assertIdentity();
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
      // Vaste volgorde (sync-meta-store.js commitRound): basiswaarden → versie-administratie → conflicten → inflight.
      // Mislukt stap 1 of 2, dan wordt geen versie als bevestigd geregistreerd; de volgende ronde neemt de versies over
      // zodra lokaal en cloud gelijk zijn (zonder tweede upload). Lokale gegevens blijven ongewijzigd staan.
      assertIdentity();
      const commit = await window.SamenThuisSyncMeta.commitRound({
        store: META, slot: roundSlot, base, baseValues: result.baseValues, conflicts: result.conflicts,
        roundOk: result.status === 'ok', writeBases: (b, opts) => writeBases(roundSlot, b, opts)
      });
      st.conflicts = result.conflicts;
      // Financiële records pas afronden (verwijderen) als de versie-administratie duurzaam is vastgelegd.
      assertIdentity();
      if (FS && commit.committed && commit.durability !== 'session') {
        try { await FS.afterCommit({ outcomes: finRound.outcomes, actor }); } catch (error) { console.error('Financiële conflicten niet afgerond', error); }
      }
      await refreshFinance();
      if (!commit.committed) {
        console.error('Syncmetadata niet vastgelegd (' + commit.step + ')', commit.error);
        result.failed = [...(result.failed || []), { section: '(syncmetadata)', error: { kind: 'storage', message: 'De synchronisatiestatus kon niet op dit apparaat worden bewaard (' + commit.step + '). Je gegevens zijn veilig; de volgende ronde rondt het af.' } }];
        result.status = 'partial';
      } else {
        metaDurability = commit.durability;
        commit.warnings.forEach(w => console.warn('Syncmetadata (' + w.step + ') niet bijgewerkt', w.error));
      }
      if (CHANNEL) CHANNEL.post('sync-finished', { slot: roundSlot, status: result.status });
      outcome = result.status;
      if (result.status === 'ok') {
        syncConfig.lastSyncedAt = new Date().toISOString(); // per identiteit vastgelegd in de versie-administratie (writeBases)
        try { localStorage.removeItem(RESTORE_HOLD_KEY); } catch (_) {}
        st.message = result.pushed.length || pulled.length
          ? `Synchronisatieronde afgerond: ${result.pushed.length} verstuurd, ${pulled.length} ontvangen.`
          : 'Geen wijzigingen gevonden in deze synchronisatieronde.';
        if (result.merged && result.merged.length) {
          const names = [...new Set(result.merged.map(label))].join(', ');
          st.message = `Wijzigingen van beide apparaten samengevoegd (${names}).`;
          toast(`Samengevoegd met de wijzigingen van je huisgenoot: ${names}`);
        }
        if (metaDurability === 'session') st.message += ' Let op: syncstatus staat alleen in het geheugen van deze sessie (geen duurzame opslag beschikbaar).';
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
      if (error && error.name === 'StaleIdentity') { st.message = error.message; syncError = ''; return { status: 'identity-changed' }; }
      const c = error && error.codeError ? { kind: 'key', message: error.message } : HS.classifyError(error);
      if (!(error && error.codeError)) console.error('Accountsynchronisatie mislukt', error);
      syncError = c.kind === 'network' ? '' : c.message; st.message = c.message;
      if (manual) toast(c.message);
      if (current === 'settings') render();
      return { status: c.kind };
    }
  }

  const legacySync = syncNow;
  syncNow = function (opts) { return accountMode() ? accountSync(opts) : legacySync(opts); };
  const legacyBadge = updateSyncBadge;
  updateSyncBadge = function (message) {
    legacyBadge(message);
    const badge = document.querySelector('#syncState');
    if (!badge || message || !accountMode()) return;
    badge.textContent = syncing ? 'Synchroniseren…' : !AUTH.session()?.user?.id ? 'Aanmelden vereist · lokaal bewaard' : !navigator.onLine ? 'Offline · later synchroniseren' : st.finance.some(x => x.record.status === 'open' && x.record.scope !== FINC.LEGACY_SCOPE) ? 'Financieel conflict · kies waarde' : st.conflicts.length ? 'Conflict · kies versie' : syncError ? 'Sync controleren' : metaDurability === 'session' ? 'Gesynchroniseerd · status niet duurzaam bewaard' : 'Laatst gesynchroniseerd · niet geverifieerd';
    badge.classList.remove('connected');
  };

  async function activate() {
    st.busy = true; st.message = '';
    try {
      if (!AUTH.session()?.user?.id) throw new Error('Meld je eerst aan met je persoonlijke account.');
      const c = cloud(); st.household = await c.membership();
      if (!st.household) throw new Error('Maak eerst een huishouden aan of voeg je toe met de code van je huisgenoot.');
      st.busy = false;
      // Expliciete koppeling door de gebruiker: het lokale profiel gaat naar dit account + huishouden (alleen als daar nog
      // niets staat). Daarna accountsync aan voor dit account en opnieuw laden; de eerste ronde volgt na het laden.
      // Importing the opaque legacy payload would reintroduce SportCoach.
      const uid = AUTH.session().user.id;
      const localKey = IDENT.current().mode === 'local' ? IDENT.current().key : null;
      const bound = IDS.bindLocalToAccount(localStorage, { accountId: uid, householdId: st.household.id });
      // Open financiële apparaatconflicten van het zojuist gekoppelde lokale profiel gaan mee naar deze identiteit.
      if (bound.bound && FIN && localKey) {
        try { await FIN.adoptDevice({ localKey, scope: FINC.scopeFor(uid, st.household.id), includeUntagged: localKey === IDS.LEGACY_KEY }); }
        catch (error) { console.error('Financiële apparaatconflicten niet meegenomen; ze blijven bij het lokale profiel bewaard', error); }
      }
      IDS.setAccount(localStorage, uid, { enabled: true, householdId: st.household.id });
      st.message = bound.bound
        ? 'Accountsync is ingeschakeld. De gegevens van dit apparaat zijn aan dit account en huishouden gekoppeld; de oorspronkelijke kopie blijft bewaard.'
        : bound.reason === 'bestaat-al'
          ? 'Accountsync is ingeschakeld. Dit account heeft op dit apparaat al eigen gegevens; het lokale profiel is ongewijzigd bewaard.'
          : 'Accountsync is ingeschakeld. De gegevens van dit huishouden worden uit de cloud geladen.';
      toast(st.message);
      IDENT.reevaluate();
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

  // ---------- Financiële conflicten: verversen, kiezen, tonen ----------
  async function refreshFinance() {
    if (!FIN) return;
    try {
      const scope = ownScope();
      const own = scope ? await FIN.list(scope) : [];
      const device = (await deviceRecords()).filter(r => r.status === 'open');
      // M1: in een account ook de oude apparaatconflicten zonder vaststaand profiel (zonder waarden; upload geblokkeerd).
      const guards = scope ? (await FIN.list(FINC.DEVICE_SCOPE)).filter(r => unknownGuard(r, scope)) : [];
      // Oude records zonder vaststaande identiteit: alleen de naam van het onderdeel, en alleen in het lokale profiel.
      const legacy = IDENT.current().mode === 'local' ? (await FIN.list(FINC.LEGACY_SCOPE)).filter(r => r.status === 'open') : [];
      st.finance = [...own, ...device, ...legacy].map(r => ({ record: r, paths: r.status === 'open' && r.scope !== FINC.LEGACY_SCOPE ? FIN.view(r, data[r.section]) : [] }))
        .concat(guards.map(r => ({ record: r, paths: [], guard: true })));
    } catch (error) { console.error('Financiële conflicten laden mislukt', error); }
    updateSyncBadge();
  }
  // Expliciete keuze per veld: choices = { [pad]: 'local' | 'remote' }. Volgorde: keuze atomair vastleggen (IndexedDB) →
  // lokaal opslaan (bij een fout terugdraaien) → versturen in de volgende ronde → record pas weg na serverbevestiging.
  async function resolveFinance(section, choices) {
    if (!FIN || !isFinancialSection(section)) return { ok: false, reason: 'not-financial' };
    // Alleen de eigen identiteit of een apparaatconflict; nooit een record van een ander account/huishouden.
    if (IDENT.switching()) return { ok: false, reason: 'identity-changed' };
    const own = ownScope();
    const deviceRec = !own && await FIN.get(FINC.DEVICE_SCOPE, section);
    const scope = own && await FIN.get(own, section) ? own : (deviceRec && deviceVisible(deviceRec) ? FINC.DEVICE_SCOPE : null);
    if (!scope) return { ok: false, reason: 'not-found' };
    const identityKey = IDENT.current().key;
    const bases = readBases(slot());
    const pushBase = scope !== FINC.DEVICE_SCOPE && bases[section] ? { version: bases[section].version, value: (await loadBaseValues(bases))[section] } : null;
    const r = await FIN.resolve({ scope, section, choices, currentLocal: data[section], actor: AUTH.session()?.user?.id || null, pushBase });
    if (!r.ok) { await refreshFinance(); return r; }
    if (IDENT.switching() || IDENT.current().key !== identityKey) return { ok: false, reason: 'identity-changed' };
    if (HS.hashValue(data[section] ?? null) !== HS.hashValue(r.value ?? null)) {
      const previous = data[section];
      data[section] = structuredClone(r.value);
      if (save({ sync: false }) === false) {
        data[section] = previous;
        if (!r.idempotent) await FIN.rollback(scope, section, r.record.resolution.id);
        await refreshFinance();
        return { ok: false, reason: 'save-failed' };
      }
    }
    // Apparaatconflict: geen server die kan bevestigen; na lokaal opslaan de financiële waarden uit het record halen.
    if (scope === FINC.DEVICE_SCOPE && !r.idempotent) await FIN.completeLocal(scope, section, r.record.resolution.id);
    delete st.finChoices[section];
    if (CHANNEL) CHANNEL.post('finance-changed', { section });
    await refreshFinance();
    if (current === 'settings') render();
    if (accountMode()) scheduleRetry(300);
    return r;
  }
  const short = v => { const t = v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v); return t.length > 60 ? t.slice(0, 57) + '…' : t; };
  function financeList() {
    if (!st.finance.length) return '';
    const me = AUTH.session()?.user?.id || '';
    return `<p class="eyebrow">FINANCIËN · KEUZE NODIG</p><ul class="list" data-fin-list>${st.finance.map(({ record: r, paths, guard }) => {
      if (guard) return `<li class="list-item" data-fin-guard="${esc2(r.section)}"><div class="item-main"><strong>${esc2(label(r.section))}</strong><small>Ouder financieel conflict op dit apparaat waarvan niet vaststaat bij welk account of huishouden het hoort. Daarom wordt ${esc2(label(r.section))} niet verstuurd. Hoort het niet bij dit account, geef het dan vrij: je eigen gegevens blijven ongewijzigd en er wordt geen waarde gekozen. Het conflict blijft bewaard.</small></div><button class="secondary" data-fin-release="${esc2(r.section)}">Vrijgeven voor dit account</button></li>`;
      const who = r.origin === 'tab' ? 'in een ander tabblad op dit apparaat' : r.origin === 'reintroduction' ? 'een oude kopie op dit apparaat' : (r.remoteUpdatedBy && r.remoteUpdatedBy !== me ? 'door je huisgenoot' : 'op een ander apparaat');
      if (r.scope === FINC.LEGACY_SCOPE) return `<li class="list-item"><div class="item-main"><strong>${esc2(label(r.section))}</strong><small>Ouder conflict waarvan niet vaststaat bij welk account of huishouden het hoort. Het wordt bewaard maar niet automatisch verwerkt of verstuurd.</small></div></li>`;
      if (r.status !== 'open') return `<li class="list-item"><div class="item-main"><strong>${esc2(label(r.section))}</strong><small>Keuze bewaard · wordt pas afgerond als de server hem bevestigt. Dit onderdeel wordt tot dan niet anders verstuurd.</small></div></li>`;
      const chosen = st.finChoices[r.section] || {};
      return paths.map(p => `<li class="list-item" data-fin-row="${esc2(r.section)}"><div class="item-main"><strong>${esc2(label(r.section))} · ${esc2(p.path)}</strong><small>Ook gewijzigd ${esc2(who)}${r.remoteUpdatedAt ? ' (' + esc2(new Date(r.remoteUpdatedAt).toLocaleString('nl-NL')) + ')' : ''}. Eerder: ${esc2(short(p.base))}</small></div><button class="${chosen[p.path] === 'local' ? 'primary' : 'secondary'}" data-fin-choose="${esc2(r.section)}" data-fin-path="${esc2(p.path)}" data-fin-side="local">Deze waarde: ${esc2(short(p.local))}</button><button class="${chosen[p.path] === 'remote' ? 'primary' : 'secondary'}" data-fin-choose="${esc2(r.section)}" data-fin-path="${esc2(p.path)}" data-fin-side="remote">Andere waarde: ${esc2(short(p.remote))}</button></li>`).join('');
    }).join('')}</ul>`;
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
      ${body}<p role="status" aria-live="polite" class="small-note">${esc2(st.message)}</p>${conflicts ? `<ul class="list">${conflicts}</ul>` : ''}${financeList()}</section>`;
  }
  const baseRender = render;
  render = function (...a) {
    const r = baseRender.apply(this, a);
    if (current === 'settings') { const v = document.querySelector('#view'); if (v && !v.querySelector('[data-acct-card]')) v.insertAdjacentHTML('beforeend', card()); }
    return r;
  };
  async function releaseGuard(section) {
    const scope = ownScope();
    if (!FIN || !scope || IDENT.switching()) return { ok: false, reason: 'identity-changed' };
    const r = await FIN.releaseUnknown({ scope, section, actor: AUTH.session()?.user?.id || null });
    if (CHANNEL) CHANNEL.post('finance-changed', { section });
    await refreshFinance();
    if (current === 'settings') render();
    if (r.ok && accountMode()) scheduleRetry(300);
    return r;
  }
  document.addEventListener('click', e => {
    const rel = e.target.closest('[data-fin-release]');
    if (rel) { if (confirm('Dit oude conflict vrijgeven voor dit account? Er wordt geen waarde gekozen; je eigen gegevens blijven zoals ze zijn.')) releaseGuard(rel.dataset.finRelease); return; }
    const f = e.target.closest('[data-fin-choose]');
    if (f) {
      const section = f.dataset.finChoose, entry = st.finance.find(x => x.record.section === section);
      const chosen = st.finChoices[section] = { ...(st.finChoices[section] || {}), [f.dataset.finPath]: f.dataset.finSide };
      // Pas oplossen als voor elk conflicterend veld expliciet is gekozen.
      if (entry && entry.paths.every(p => chosen[p.path])) resolveFinance(section, chosen).then(r => { if (!r.ok) toast('Keuze niet verwerkt: ' + (r.reason === 'already-resolved' ? 'in een ander tabblad al anders gekozen.' : r.reason)); });
      else if (current === 'settings') render();
      return;
    }
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
    if (msg.type === 'finance-changed' || msg.type === 'sync-finished') refreshFinance().then(() => { if (current === 'settings') render(); });
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
    const b = readBases(slot());
    const S = HS.sectionsOf(data);
    return Object.keys(S).filter(k => b[k] ? b[k].hash !== HS.hashValue(S[k]) : !HS.isEmptyValue(S[k]));
  }

  // Financiële conflicten voor app.js (tabbladen) en voor tests: lijst, live weergave, expliciete keuze.
  window.SamenThuisFinanceSync = {
    scope: ownScope,
    list: async () => { if (!FIN) return []; const scope = ownScope(); return [...(scope ? await FIN.list(scope) : []), ...(await deviceRecords())]; },
    view: async section => {
      if (!FIN) return [];
      const scope = ownScope();
      const own = scope && await FIN.get(scope, section);
      const dev = !scope && await FIN.get(FINC.DEVICE_SCOPE, section);
      const r = own || (dev && deviceVisible(dev) ? dev : null);
      return r ? FIN.view(r, data[section]) : [];
    },
    resolve: resolveFinance, refresh: refreshFinance, release: releaseGuard,
    notify: () => { if (CHANNEL) CHANNEL.post('finance-changed', {}); return refreshFinance(); }
  };
  // Na een herstart: een keuze die al vastlag maar nog niet lokaal was opgeslagen (crash ertussen) alsnog toepassen.
  // Alleen voor de huidige identiteit en apparaatconflicten, nooit voor een ander account of huishouden.
  (async () => {
    if (!FIN) return;
    await classifyLegacyDevice();
    try {
      const scope = ownScope();
      const fixes = FIN.interrupted([...(scope ? await FIN.list(scope) : []), ...(await deviceRecords())], data);
      if (fixes.length) {
        const previous = data;
        data = { ...data, ...Object.fromEntries(fixes.map(f => [f.section, f.value])) };
        if (save({ touch: false, sync: false }) === false) data = previous;
      }
    } catch (error) { console.error('Onderbroken financiële keuze niet afgerond', error); }
    await refreshFinance();
    if (current === 'settings') render();
  })();

  window.SamenThuisAccountSync = {
    active: accountMode, sync: accountSync,
    conflicts: () => [...st.conflicts, ...st.finance.filter(x => x.record.status === 'open' && x.record.scope !== FINC.LEGACY_SCOPE).map(x => ({ section: x.record.section, fields: x.paths.map(p => p.path), financial: true }))],
    pending: pendingSections, inflight: () => META.listInflight(slot()), metaStatus: () => META.status(),
    uploadSportFile, signedSportFileUrl, deleteSportFile
  };
})();
