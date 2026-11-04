(function () {
  // Interface van het financiële systeem: tabbladen, inkomensbevestiging, maandverdeling, potjes, reserveringen.
  // Alle berekeningen komen uit finance-plan-core.js; deze module bevat alleen weergave en aanroepen naar Supabase.
  const F = globalThis.SamenThuisFinance;
  const L = globalThis.SamenThuisBudgetLedger;
  if (!F || !L) return;

  const state = {
    month: new Date().toISOString().slice(0, 7), ctx: null, busy: false, notice: '',
    remote: { status: 'idle', householdId: '', members: [], incomes: [], distributions: [], loadedAt: 0, error: '' },
    personal: { loaded: false, pots: [], expenses: [] }
  };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const eur = cents => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format((Number(cents) || 0) / 100);
  const stamp = value => value ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  const toCents = value => { try { return L.cents(String(value).trim() || '0'); } catch (_) { return NaN; } };
  const uid = () => state.ctx?.auth.session()?.user?.id || '';

  // ---- Netwerk -----------------------------------------------------------------------------------
  async function api(path, options = {}) {
    const auth = state.ctx.auth;
    const session = await auth.ready();
    if (!session?.access_token) throw Object.assign(new Error('Niet aangemeld'), { status: 401 });
    const response = await fetch(`${auth.base()}${path}`, { ...options, headers: { ...auth.headers(session.access_token), ...(options.headers || {}) } });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(body?.message || `Fout (${response.status})`), { status: response.status, code: body?.code });
    return body;
  }
  const rpc = (name, args) => api(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  const friendly = error => error.code === '40001' || /Versieconflict/.test(error.message)
    ? 'Er is ondertussen iets gewijzigd op een ander apparaat. De gegevens zijn ververst; controleer en probeer opnieuw.'
    : error.code === 'PGRST202' || error.code === 'PGRST205' || error.status === 404
      ? 'De financiële databasemigratie is nog niet toegepast. Er is niets opgeslagen.'
      : error.message;

  async function loadRemote(force = false) {
    const remote = state.remote, session = state.ctx.auth.session();
    if (!session?.user?.id) { remote.status = 'signedout'; return false; }
    if (remote.busy || (!force && remote.status === 'ready' && Date.now() - remote.loadedAt < 20000)) return false;
    remote.busy = true;
    const before = JSON.stringify([remote.members, remote.incomes, remote.distributions]);
    try {
      const own = await api(`/rest/v1/household_members?select=household_id&user_id=eq.${encodeURIComponent(session.user.id)}&order=joined_at.asc&limit=1`);
      const householdId = own?.[0]?.household_id;
      if (!householdId) { remote.status = 'nohousehold'; return false; }
      const hid = encodeURIComponent(householdId);
      const [members, incomes, distributions] = await Promise.all([
        api(`/rest/v1/household_members?select=user_id&household_id=eq.${hid}`),
        api(`/rest/v1/finance_income_months?select=*&household_id=eq.${hid}`),
        api(`/rest/v1/finance_distributions?select=*&household_id=eq.${hid}&order=month.asc,revision.asc`)
      ]);
      Object.assign(remote, { householdId, members: (members || []).map(item => item.user_id).sort(), incomes: incomes || [], distributions: distributions || [], status: 'ready', error: '', loadedAt: Date.now() });
      await loadPersonal();
      return JSON.stringify([remote.members, remote.incomes, remote.distributions]) !== before;
    } catch (error) {
      remote.status = error.code === 'PGRST205' || error.status === 404 ? 'migration' : 'error';
      remote.error = friendly(error);
      return false;
    } finally { remote.busy = false; }
  }

  async function loadPersonal() {
    if (state.personal.loaded) return;
    try {
      const rows = await api(`/rest/v1/personal_preferences?select=finance_config&user_id=eq.${encodeURIComponent(uid())}&limit=1`);
      const config = rows?.[0]?.finance_config || {};
      state.personal.pots = (config.pots || []).map(F.normalizePot);
      state.personal.expenses = Array.isArray(config.expenses) ? config.expenses : [];
      state.personal.loaded = true;
    } catch (_) { /* kolom ontbreekt zolang de migratie niet is toegepast */ }
  }
  async function savePersonal() {
    await api('/rest/v1/personal_preferences?on_conflict=user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: uid(), finance_config: { pots: state.personal.pots, expenses: state.personal.expenses } })
    });
  }

  // ---- Afgeleide gegevens ---------------------------------------------------------------------------
  function peopleList() {
    const ctx = state.ctx, remote = state.remote, me = uid();
    const names = ctx.names();
    if (remote.status !== 'ready') {
      const planned = ctx.budget().incomes || {};
      return ['Kees', 'Daphne'].map(key => ({ key, label: key, netCents: Math.round((Number(planned[key]) || 0) * 100), entered: false, confirmed: false }));
    }
    return remote.members.map(userId => {
      const row = remote.incomes.find(item => item.user_id === userId && item.month === state.month);
      return {
        key: userId, label: userId === me ? names.self : names.other, netCents: row ? Number(row.net_cents) : 0,
        entered: Boolean(row), confirmed: Boolean(row?.confirmed_at), row, own: userId === me
      };
    });
  }

  function evaluation() {
    const ctx = state.ctx, budget = ctx.budget(), ledger = ctx.ledger();
    const latest = state.remote.distributions.filter(row => row.month === state.month).sort((a, b) => b.revision - a.revision)[0];
    const bp = F.shareBp(Number.isFinite(Number(budget.contributionPct)) ? budget.contributionPct : 0);
    const people = peopleList();
    return {
      people, latest, evaluation: F.evaluateMonth({
        month: state.month, shareBp: bp, people, lines: F.allocationLines(budget, state.month, ledger),
        distribution: latest ? { revision: latest.revision, inputHash: latest.input_hash } : null
      }), reservations: F.reservationOverview(ledger, ledger.recurringBills, state.month, ctx.today())
    };
  }

  // ---- Weergave --------------------------------------------------------------------------------------
  const statusBox = e => `<div class="fin-status fin-status-${e.status}" role="status"><span class="fin-icon" aria-hidden="true">${F.STATUS_ICON[e.status]}</span>
    <div><strong>${F.STATUS_TEXT[e.status]}</strong>${e.reasons.length ? `<ul>${e.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p>Beide inkomens zijn bevestigd en de verdeling is definitief vastgelegd.</p>'}</div></div>`;

  function incomeCard(person) {
    const row = person.row;
    const state_ = !person.entered ? 'Nog niet ingevoerd' : person.confirmed ? `Bevestigd door ${esc(person.label)} op ${stamp(row.confirmed_at)}` : 'Ingevoerd, nog niet bevestigd';
    const entered = row ? `<small>Ingevoerd ${stamp(row.entered_at)}</small>` : '';
    const form = person.own ? `<form class="fin-income-form" data-fin-income-form>
        <label>Mijn netto-inkomen deze maand (€)<input name="net" inputmode="decimal" autocomplete="off" value="${person.entered ? (person.netCents / 100).toFixed(2) : ''}" required></label>
        <div class="fin-actions"><button type="submit" class="secondary">Bedrag opslaan</button>
        <button type="button" class="primary" data-fin-confirm-income ${person.entered && !person.confirmed ? '' : 'disabled'}>Ik bevestig mijn inkomen</button></div></form>`
      : `<p class="muted">Alleen ${esc(person.label)} kan dit inkomen invoeren en bevestigen.</p>`;
    return `<article class="fin-card fin-income ${person.confirmed ? 'is-confirmed' : ''}"><h3>${esc(person.label)}</h3><b>${person.entered ? eur(person.netCents) : '—'}</b>
      <p class="fin-pill ${person.confirmed ? 'ok' : 'wait'}">${person.confirmed ? '✔ ' : '○ '}${state_}</p>${entered}${form}</article>`;
  }

  function calcTable(e) {
    const rows = e.persons.map(p => `<tr><th scope="row">${esc(p.label)}</th><td>${eur(p.netCents)}</td><td>${eur(p.contributionCents)}</td><td>${eur(p.personalCents)}</td></tr>`).join('');
    return `<div class="fin-table-wrap"><table class="fin-table"><caption class="sr-only">Bijdrage per persoon</caption>
      <thead><tr><th>Persoon</th><th>Netto-inkomen</th><th>Gezamenlijke bijdrage (${(e.shareBp / 100).toLocaleString('nl-NL')}%)</th><th>Persoonlijk resterend</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th scope="row">Totaal gezamenlijk budget</th><td></td><td><b>${eur(e.totalContributionCents)}</b></td><td></td></tr></tfoot></table></div>`;
  }

  function allocationTable(e, reservations) {
    const rows = e.lines.map(line => `<tr><th scope="row">${esc(line.name)}<small> ${{ fixed: 'vast', saving: 'sparen', investment: 'beleggen', reservation: 'reservering' }[line.kind] || ''}</small></th><td>${eur(line.cents)}</td></tr>`).join('');
    return `<div class="fin-table-wrap"><table class="fin-table"><caption>Vaste gezamenlijke allocaties</caption><tbody>${rows || '<tr><td colspan="2">Nog geen vaste allocaties.</td></tr>'}</tbody>
      <tfoot><tr><th scope="row">Totaal vaste allocaties</th><td>${eur(e.fixedTotalCents)}</td></tr>
      <tr><th scope="row">Waarvan reserveringen</th><td>${eur(reservations.reservedCents)}</td></tr>
      <tr class="fin-remainder"><th scope="row">${esc(e.remainderName)} (restbedrag)</th><td><b>${eur(e.remainderCents)}</b></td></tr></tfoot></table></div>`;
  }

  function shortfallBox(e) {
    if (!e.shortfallCents) return '';
    return `<div class="fin-shortfall" role="alert"><strong>Tekort: ${eur(e.shortfallCents)}</strong>
      <p>De gezamenlijke bijdrage (${eur(e.totalContributionCents)}) dekt de vaste allocaties (${eur(e.fixedTotalCents)}) niet. Er wordt niets automatisch verlaagd of uit een buffer gehaald. Pas zelf bedragen of het percentage aan, of stel de verdeling uit.</p>
      <ul>${e.shortfallItems.map(item => `<li>${esc(item.name)}: ${eur(item.cents)}, daarvan niet gedekt ${eur(item.uncoveredCents)}</li>`).join('')}</ul></div>`;
  }

  function distributionPanel(data) {
    const e = data.evaluation, latest = data.latest;
    const history = state.remote.distributions.filter(row => row.month === state.month).map(row =>
      `<li>Revisie ${row.revision} (${row.kind === 'original' ? 'oorspronkelijk' : 'correctie'}) bevestigd door ${esc(row.confirmed_by === uid() ? state.ctx.names().self : state.ctx.names().other)} op ${stamp(row.confirmed_at)}${row.reason ? ` — ${esc(row.reason)}` : ''}</li>`).join('');
    const correction = latest && e.distributionState === 'stale';
    return `<section class="fin-card"><h3>Maandverdeling controleren en bevestigen</h3>
      <p class="muted">De verdeling rond de 26e is een verwachte datum, geen automatische verwerking. Eén van jullie bevestigt; de ander hoeft dat niet te herhalen.</p>
      ${correction ? '<label class="fin-reason">Reden van de correctie<input data-fin-reason maxlength="240" placeholder="Bijvoorbeeld: percentage aangepast" required></label>' : ''}
      <button type="button" class="primary" data-fin-confirm-distribution ${e.canConfirm && !state.busy ? '' : 'disabled'}>${correction ? 'Correctie definitief vastleggen' : 'Verdeling definitief bevestigen'}</button>
      ${!e.canConfirm && e.status === 'red' ? '<p class="muted">Definitief bevestigen is geblokkeerd zolang er een tekort is.</p>' : ''}
      ${history ? `<h4>Vastgelegd</h4><ul class="fin-history">${history}</ul>` : ''}</section>`;
  }

  function verdelingPane() {
    const ctx = state.ctx, remote = state.remote, data = evaluation(), e = data.evaluation;
    const notices = { signedout: 'Meld je aan via Instellingen om je inkomen te bevestigen. Zonder account zie je alleen een voorlopige berekening uit de verwachte inkomens.',
      nohousehold: 'Je account is nog niet gekoppeld aan een huishouden. Maak of koppel een huishouden in Instellingen.',
      migration: remote.error, error: remote.error, loading: 'Gegevens laden…' };
    const notice = notices[remote.status] || (remote.status === 'idle' ? notices.loading : '');
    const ordered = [...data.people].sort((a, b) => Number(Boolean(b.own)) - Number(Boolean(a.own)));
    const budget = ctx.budget();
    return `<div class="fin-grid">
      ${notice ? `<p class="fin-note" role="status">${esc(notice)}</p>` : ''}${state.notice ? `<p class="fin-note" role="status">${esc(state.notice)}</p>` : ''}
      <label class="fin-month">Maand<input type="month" data-fin-month value="${esc(state.month)}"></label>
      ${statusBox(e)}
      <section class="fin-card"><h3>Gezamenlijk afdraagpercentage</h3>
        <form class="fin-percent" data-fin-percent><label>Percentage van het eigen netto-inkomen voor beide personen<input name="pct" inputmode="decimal" value="${esc(String(budget.contributionPct ?? 0).replace('.', ','))}"></label>
        <button class="secondary" type="submit">Percentage opslaan</button></form>
        <p class="muted">Eén percentage voor beiden; de bedragen verschillen door het inkomen. Aanpassen herberekent alles direct en voert nooit zelf een verdeling uit.</p></section>
      <div class="fin-two">${ordered.map(incomeCard).join('')}</div>
      <section class="fin-card"><h3>Berekening</h3>${calcTable(e)}${shortfallBox(e)}${allocationTable(e, data.reservations)}</section>
      ${distributionPanel(data)}</div>`;
  }

  function potRow(pot, personal) {
    const flags = [pot.kind === 'saving' ? 'Sparen' : pot.kind === 'investment' ? 'Beleggen' : 'Vast', pot.scope === 'personal' || personal ? 'Persoonlijk' : 'Gezamenlijk', pot.active ? 'Actief' : 'Gepauzeerd'];
    return `<article class="fin-row"><div><strong>${esc(pot.name)}</strong><small>${flags.join(' · ')}${pot.startDate ? ` · vanaf ${esc(pot.startDate)}` : ''}${pot.endDate ? ` · t/m ${esc(pot.endDate)}` : ''}</small></div>
      <b>${eur(pot.monthlyCents)}<small>/mnd</small></b>
      <span class="fin-actions"><button type="button" class="secondary" data-fin-pot-edit="${esc(pot.id)}" ${personal ? 'data-personal="1"' : ''}>Wijzig</button>
      <button type="button" class="secondary" data-fin-pot-toggle="${esc(pot.id)}" ${personal ? 'data-personal="1"' : ''}>${pot.active ? 'Pauzeer' : 'Activeer'}</button></span></article>`;
  }

  function potForm(pot, personal) {
    const p = pot || { id: '', name: '', monthlyCents: 0, kind: 'fixed', scope: personal ? 'personal' : 'joint', active: true, startDate: '', endDate: '' };
    return `<form class="fin-form" data-fin-pot-form ${personal ? 'data-personal="1"' : ''}><input type="hidden" name="id" value="${esc(p.id)}">
      <label>Naam<input name="name" maxlength="80" required value="${esc(p.name)}"></label>
      <label>Maandelijks bedrag (€)<input name="amount" inputmode="decimal" required value="${(p.monthlyCents / 100).toFixed(2)}"></label>
      ${personal ? '' : `<label>Type<select name="kind"><option value="fixed" ${p.kind === 'fixed' ? 'selected' : ''}>Vast potje</option><option value="saving" ${p.kind === 'saving' ? 'selected' : ''}>Sparen</option><option value="investment" ${p.kind === 'investment' ? 'selected' : ''}>Beleggen</option></select></label>`}
      <label>Startdatum (optioneel)<input type="date" name="startDate" value="${esc(p.startDate)}"></label>
      <label>Einddatum (optioneel)<input type="date" name="endDate" value="${esc(p.endDate)}"></label>
      <label class="fin-check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Actief</label>
      <button class="primary" type="submit">${pot ? 'Wijzigingen bewaren' : 'Potje toevoegen'}</button></form>`;
  }

  function potjesPane() {
    const budget = state.ctx.budget(), data = evaluation(), e = data.evaluation;
    const pots = F.ensureRemainderPot((budget.finPots || []).map(F.normalizePot)).filter(pot => pot.kind !== 'remainder');
    const editId = state.editPot, editing = pots.find(pot => pot.id === editId && !state.editPersonal);
    const personalEdit = state.personal.pots.find(pot => pot.id === editId && state.editPersonal);
    return `<div class="fin-grid"><section class="fin-card"><h3>Gezamenlijke potjes</h3>
      <p class="muted">Vaste eurobedragen per maand; ze blijven gelijk totdat jullie ze aanpassen. Spaardoelen en vaste lasten uit het bestaande budget tellen automatisch mee in de verdeling.</p>
      <div class="fin-list">${pots.map(pot => potRow(pot, false)).join('') || '<p class="muted">Nog geen eigen potjes.</p>'}</div>${potForm(editing, false)}</section>
      <section class="fin-card fin-remainder-card"><h3>${esc(e.remainderName)}</h3><b>${eur(e.remainderCents)}</b>
      <p class="muted">Dit bijzondere potje ontvangt automatisch het restbedrag na alle vaste gezamenlijke allocaties in ${esc(state.month)}. Het restbedrag wordt nooit stilzwijgend over andere potjes verdeeld.</p></section>
      <section class="fin-card"><h3>Mijn persoonlijke potjes <span class="fin-pill ok">🔒 alleen voor jou zichtbaar</span></h3>
      ${state.remote.status === 'ready' && state.personal.loaded ? `<div class="fin-list">${state.personal.pots.map(pot => potRow(pot, true)).join('') || '<p class="muted">Nog geen persoonlijke potjes.</p>'}</div>${potForm(personalEdit, true)}`
        : '<p class="muted">Meld je aan en pas de databasemigratie toe om persoonlijke potjes privé te bewaren.</p>'}</section></div>`;
  }

  function vasteLastenPane() {
    const data = evaluation(), r = data.reservations;
    const rows = r.items.map(item => {
      const due = item.due.map(d => `${esc(d.date)} (${d.status})`).join(', ') || 'geen betaling deze maand';
      return `<tr><th scope="row">${esc(item.name)}<small>${item.scope === 'personal' ? 'persoonlijk' : 'gezamenlijk'}</small></th><td>${eur(item.reservedCents)}</td><td>${eur(item.reservedBalanceCents)}</td><td>${eur(item.spentCents)}</td><td>${due}</td></tr>`;
    }).join('');
    return `<div class="fin-grid" data-fin-slot="vastelasten"><section class="fin-card"><h3>Beschikbaar, gereserveerd en uitgegeven</h3>
      <p class="muted">Een reservering is geen uitgave. Een geregistreerde betaling verbruikt de reservering en telt één keer als uitgave. Zonder bankkoppeling blijft een betaling "gepland" totdat je hem zelf registreert.</p>
      <div class="fin-table-wrap"><table class="fin-table"><thead><tr><th>Vaste last</th><th>Gereserveerd deze maand</th><th>Reservering over</th><th>Uitgegeven deze maand</th><th>Betaling</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Nog geen terugkerende uitgaven.</td></tr>'}</tbody></table></div>
      <p><b>Beschikbaar budget (restbedrag):</b> ${eur(data.evaluation.remainderCents)} · <b>Gereserveerd:</b> ${eur(r.reservedCents)} · <b>Werkelijk uitgegeven:</b> ${eur(r.spentCents)}</p></section></div>`;
  }

  function transactiesPane() {
    const ctx = state.ctx, ledger = ctx.ledger();
    const mine = state.personal.expenses.filter(item => (item.month || item.date.slice(0, 7)) === state.month);
    const linkable = ledger.expenses.filter(item => item.scope !== 'personal').slice(0, 50);
    const targets = [...(ctx.trips() || []).map(trip => ({ module: 'trip', id: trip.id, label: `Reis: ${trip.name}` })), { module: 'auto', id: 'auto', label: 'Auto' }, { module: 'sport', id: 'sport', label: 'Sport' }, { module: 'household', id: 'household', label: 'Huishoudelijke aankoop' }];
    const linked = ledger.expenses.filter(item => (item.links || []).length).slice(0, 20).map(item =>
      `<li>${esc(item.description)} — ${eur(item.amountCents)} → ${(item.links || []).map(link => esc(targets.find(t => t.module === link.module && t.id === link.id)?.label || `${link.module}`)).join(', ')}</li>`).join('');
    return `<div class="fin-grid" data-fin-slot="transacties"><section class="fin-card"><h3>Eén transactieregister</h3>
      <p class="muted">Een uitgave wordt één keer geregistreerd (hieronder). Andere modules tonen dezelfde transactie via een koppeling, zonder duplicaat.</p>
      ${linkable.length ? `<form class="fin-form" data-fin-link-form><label>Transactie<select name="expenseId">${linkable.map(item => `<option value="${esc(item.id)}">${esc(item.date)} · ${esc(item.description)} · ${eur(item.amountCents)}</option>`).join('')}</select></label>
        <label>Koppel aan<select name="target">${targets.map(t => `<option value="${esc(t.module)}|${esc(t.id)}">${esc(t.label)}</option>`).join('')}</select></label><button class="secondary" type="submit">Koppelen</button></form>` : '<p class="muted">Nog geen uitgaven om te koppelen.</p>'}
      ${linked ? `<ul class="fin-history">${linked}</ul>` : ''}</section>
      <section class="fin-card"><h3>Mijn privé-uitgaven <span class="fin-pill ok">🔒 alleen voor jou zichtbaar</span></h3>
      ${state.remote.status === 'ready' && state.personal.loaded ? `<form class="fin-form" data-fin-personal-expense><label>Datum<input type="date" name="date" required value="${esc(ctx.today())}"></label><label>Bedrag (€)<input name="amount" inputmode="decimal" required></label>
        <label>Omschrijving<input name="description" maxlength="160" required></label><label>Persoonlijk potje<select name="potId"><option value="">Geen potje</option>${state.personal.pots.map(pot => `<option value="${esc(pot.id)}">${esc(pot.name)}</option>`).join('')}</select></label><button class="primary" type="submit">Toevoegen</button></form>
        <ul class="fin-history">${mine.map(item => `<li>${esc(item.date)} · ${esc(item.description)} · ${eur(item.amountCents)} <button type="button" class="secondary" data-fin-personal-remove="${esc(item.id)}">Verwijder</button></li>`).join('')}</ul>`
        : '<p class="muted">Meld je aan om privé-uitgaven te bewaren. Ze worden nooit gedeeld met je huisgenoot.</p>'}</section></div>`;
  }

  function beleggenPane() {
    const ctx = state.ctx, ledger = ctx.ledger(), budget = ctx.budget();
    const pots = ctx.pots();
    const deposits = ledger.expenses.filter(item => item.potId === 'pot:investing');
    const overview = F.investmentOverview(ledger, pots, Math.round((Number(budget.investing) || 0) * 100), deposits);
    return `<div class="fin-grid"><section class="fin-card"><h3>Beleggen (gescheiden van sparen)</h3>
      <div class="fin-two"><article class="fin-card"><small>Gepland per maand</small><b>${eur(overview.plannedCents)}</b></article><article class="fin-card"><small>Gereserveerd</small><b>${eur(overview.reservedCents)}</b></article><article class="fin-card"><small>Daadwerkelijk ingelegd</small><b>${eur(overview.investedCents)}</b></article></div>
      <p class="muted">Een geplande of gereserveerde allocatie is nog geen belegde waarde. Bevestig pas een inleg wanneer het geld echt is overgemaakt; er is geen koppeling met een broker.</p>
      <form class="fin-form" data-fin-invest><label>Ingelegd bedrag (€)<input name="amount" inputmode="decimal" required></label><label>Datum<input type="date" name="date" required value="${esc(ctx.today())}"></label><button class="primary" type="submit">Inleg bevestigen</button></form>
      <ul class="fin-history">${deposits.map(item => `<li>${esc(item.date)} · ${eur(item.amountCents)} bevestigde inleg</li>`).join('')}</ul></section></div>`;
  }

  // ---- Montage ---------------------------------------------------------------------------------------
  function mount(ctx) {
    state.ctx = ctx;
    const view = document.querySelector('#view');
    if (!view || view.querySelector('.fin-pane') || !view.querySelector('.budget23')) return;
    // Elk onderdeel is een eigen blok in de weergave; de bestaande subpagina-navigatie (nav-core/nav-groups) toont er één per keer.
    const panes = { verdeling: verdelingPane, potjes: potjesPane, vastelasten: vasteLastenPane, transacties: transactiesPane, beleggen: beleggenPane };
    Object.entries(panes).forEach(([key, build]) => {
      const section = document.createElement('section');
      section.className = 'fin-pane';
      section.dataset.finPane = key;
      section.innerHTML = build();
      view.append(section);
    });
    if (state.remote.status === 'idle' || Date.now() - state.remote.loadedAt > 20000) refresh(false);
  }

  async function refresh(force) {
    const changed = await loadRemote(force);
    const applied = state.ctx.applyDistributions(state.remote.distributions);
    if (changed || applied || state.remote.status !== 'idle' && !state.firstPaint) { state.firstPaint = true; if (!state.typing) state.ctx.render(); }
  }

  function repaint() { state.ctx.render(); }

  async function guarded(action, successNotice) {
    if (state.busy) return;
    state.busy = true; state.notice = '';
    try { await action(); if (successNotice) state.notice = successNotice; }
    catch (error) { state.notice = friendly(error); }
    finally { state.busy = false; await loadRemote(true); state.ctx.applyDistributions(state.remote.distributions); repaint(); }
  }

  document.addEventListener('click', event => {
    const ctx = state.ctx; if (!ctx || !document.querySelector('.fin-pane')) return;
    if (event.target.closest('[data-fin-confirm-income]')) {
      const person = peopleList().find(item => item.own);
      if (!person?.entered) return;
      guarded(() => rpc('finance_confirm_income', { p_household: state.remote.householdId, p_month: state.month, p_expected_net_cents: person.netCents }), 'Je inkomen is bevestigd.');
      return;
    }
    if (event.target.closest('[data-fin-confirm-distribution]')) {
      const data = evaluation(), e = data.evaluation;
      if (!e.canConfirm) return;
      const reason = document.querySelector('[data-fin-reason]')?.value || '';
      if (data.latest && !reason.trim()) { state.notice = 'Geef een reden voor de correctie.'; repaint(); return; }
      if (!confirm(`Maandverdeling ${state.month} definitief bevestigen? Totaal gezamenlijk budget ${eur(e.totalContributionCents)}, restbedrag ${e.remainderName} ${eur(e.remainderCents)}.`)) return;
      guarded(async () => {
        await rpc('finance_confirm_distribution', {
          p_household: state.remote.householdId, p_month: state.month, p_expected_revision: data.latest ? data.latest.revision : 0,
          p_share_bp: e.shareBp, p_input_hash: e.inputHash, p_snapshot: F.distributionSnapshot(e), p_reason: reason.trim()
        });
      }, 'De maandverdeling is definitief vastgelegd en eenmalig verwerkt.');
      return;
    }
    const toggle = event.target.closest('[data-fin-pot-toggle]');
    if (toggle) {
      const personal = Boolean(toggle.dataset.personal), list = personal ? state.personal.pots : ctx.budget().finPots || [];
      const pot = list.find(item => item.id === toggle.dataset.finPotToggle);
      if (pot) { pot.active = pot.active === false; personal ? savePersonal().then(repaint) : (ctx.save(), repaint()); }
      return;
    }
    const edit = event.target.closest('[data-fin-pot-edit]');
    if (edit) { state.editPot = edit.dataset.finPotEdit; state.editPersonal = Boolean(edit.dataset.personal); repaint(); return; }
    const remove = event.target.closest('[data-fin-personal-remove]');
    if (remove) { state.personal.expenses = state.personal.expenses.filter(item => item.id !== remove.dataset.finPersonalRemove); savePersonal().then(repaint); }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-fin-month]') && /^\d{4}-\d{2}$/.test(event.target.value)) { state.month = event.target.value; state.notice = ''; repaint(); }
  });
  document.addEventListener('focusin', event => { state.typing = event.target.matches?.('.fin-pane input'); });
  document.addEventListener('focusout', () => { state.typing = false; });

  document.addEventListener('submit', event => {
    const ctx = state.ctx; if (!ctx || !event.target.closest('.fin-pane')) return;
    const form = event.target, values = Object.fromEntries(new FormData(form));
    if (form.matches('[data-fin-income-form]')) {
      event.preventDefault();
      const cents = toCents(values.net);
      if (!Number.isFinite(cents) || cents < 0) { state.notice = 'Vul een geldig bedrag in, bijvoorbeeld 2450,00.'; repaint(); return; }
      guarded(() => rpc('finance_set_income', { p_household: state.remote.householdId, p_month: state.month, p_net_cents: cents }), 'Je inkomen is opgeslagen. Controleer het bedrag en bevestig het zelf.');
    } else if (form.matches('[data-fin-percent]')) {
      event.preventDefault();
      try { F.shareBp(values.pct); } catch (error) { state.notice = error.message; repaint(); return; }
      ctx.budget().contributionPct = Number(String(values.pct).replace(',', '.'));
      ctx.save(); state.notice = 'Percentage opgeslagen. Alles is opnieuw berekend; er is niets automatisch verwerkt.'; repaint();
    } else if (form.matches('[data-fin-pot-form]')) {
      event.preventDefault();
      const personal = Boolean(form.dataset.personal), cents = toCents(values.amount);
      if (!Number.isFinite(cents)) { state.notice = 'Vul een geldig bedrag in.'; repaint(); return; }
      const candidate = F.normalizePot({ ...values, id: values.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, monthlyCents: cents, active: values.active === 'on', scope: personal ? 'personal' : 'joint', kind: personal ? 'fixed' : values.kind });
      const list = personal ? state.personal.pots : (ctx.budget().finPots = Array.isArray(ctx.budget().finPots) ? ctx.budget().finPots : []);
      const next = list.some(pot => pot.id === candidate.id) ? list.map(pot => pot.id === candidate.id ? candidate : pot) : [...list, candidate];
      const check = F.validatePots(next);
      if (!check.ok) { state.notice = check.errors[0]; repaint(); return; }
      if (personal) { state.personal.pots = next; savePersonal().then(() => { state.editPot = ''; repaint(); }).catch(error => { state.notice = friendly(error); repaint(); }); }
      else { ctx.budget().finPots = next; state.editPot = ''; ctx.save(); repaint(); }
    } else if (form.matches('[data-fin-link-form]')) {
      event.preventDefault();
      const [module, id] = String(values.target).split('|');
      try { L.linkExpense(ctx.ledger(), values.expenseId, { module, id }); ctx.save(); state.notice = 'Transactie gekoppeld; er is geen duplicaat aangemaakt.'; } catch (error) { state.notice = error.message; }
      repaint();
    } else if (form.matches('[data-fin-personal-expense]')) {
      event.preventDefault();
      const cents = toCents(values.amount);
      if (!Number.isFinite(cents) || cents <= 0 || !L.validDate(values.date)) { state.notice = 'Vul een geldig bedrag en datum in.'; repaint(); return; }
      state.personal.expenses = [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: values.date, month: values.date.slice(0, 7), amountCents: cents, description: String(values.description).slice(0, 160), potId: values.potId || '' }, ...state.personal.expenses];
      savePersonal().then(repaint).catch(error => { state.notice = friendly(error); repaint(); });
    } else if (form.matches('[data-fin-invest]')) {
      event.preventDefault();
      try {
        const ledger = ctx.ledger();
        L.addExpense(ledger, { amount: values.amount, date: values.date, category: 'Beleggen', potId: 'pot:investing', description: 'Bevestigde inleg beleggen', externalId: `investment:${values.date}:${toCents(values.amount)}` }, ctx.pots());
        ctx.syncMirrors(); ctx.save(); state.notice = 'Inleg bevestigd.';
      } catch (error) { state.notice = error.code === 'INSUFFICIENT_FUNDS' ? 'Er is minder gereserveerd voor beleggen dan je wilt inleggen. Verdeel eerst de maand of verlaag het bedrag.' : error.message; }
      repaint();
    }
  });

  // Wijzigingen van de andere persoon (inkomen, bevestiging, verdeling) verschijnen zonder handmatig vernieuwen.
  setInterval(() => { if (state.ctx && document.querySelector('.fin-pane') && !document.hidden) refresh(true); }, 30000);

  globalThis.SamenThuisFinanceUi = { mount, state, refresh };
})();
