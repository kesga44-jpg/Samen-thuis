/* Voeding: producten (Open Food Facts), receptkopieën uit Osta (geen eigen receptenbeheer, ADR 0001) en voedingsinformatie bij het weekmenu.
   Pagina 'voeding' met subpagina's via NavCore.HUBS. Gegevens in data.nutrition (bestaande huishoudopslag + sync).
   Netwerk alleen na een klik op Opzoeken/Zoeken; nooit op de achtergrond. Geen AI-dienst: de controle is regelgebaseerd. */
(() => {
  'use strict';
  const FF = window.SamenThuisFoodFacts, NC = window.SamenThuisNutrition, RX = window.SamenThuisRecipeExchange;
  if (window.__ST_NUTRITION__ || !FF || !NC || !RX || typeof render !== 'function' || typeof data === 'undefined') return;
  window.__ST_NUTRITION__ = true;

  let client = null;
  const getClient = () => client || (client = FF.createClient({ storage: (() => { try { return window.localStorage; } catch (_) { return null; } })() }));
  const ui = { weekStart: startOfWeek(todayISO()), searchResults: [], searchQuery: '', busy: false, message: '', plan: null, checks: null, openRecipe: '', openProduct: '' };

  // Eén keer normaliseren per object: na synchronisatie of herstel (nieuw object) opnieuw. Zo blijven verwijzingen geldig.
  const normalized = new WeakSet();
  function store() {
    if (!data.nutrition || typeof data.nutrition !== 'object' || !normalized.has(data.nutrition)) {
      data.nutrition = NC.normalizeStore(data.nutrition);
      normalized.add(data.nutrition);
    }
    return data.nutrition;
  }
  function persist(message) {
    save();
    if (message) toast(message);
    render();
  }
  const productById = id => store().products.find(p => p.id === id);
  const recipeById = id => store().recipes.find(r => r.id === id);
  const fmt = (v, unit, complete = true) => NC.formatValue(v, unit, complete);
  const sourceNote = `<p class="nut-source">${esc(FF.ATTRIBUTION)} <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">openfoodfacts.org</a></p>`;

  function nutrientTable(values, { complete = null, caption = '' } = {}) {
    return `<table class="nut-table"><caption>${esc(caption)}</caption><tbody>${NC.NUTRIENTS.map(n => {
      const ok = complete ? complete[n.key] : true;
      return `<tr><th scope="row">${esc(n.label)}</th><td class="${values[n.key] == null ? 'nut-unknown' : ''}">${esc(fmt(values[n.key], n.unit, ok))}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  const sourceLabel = r => ({ osta: 'Osta', 'schema.org': 'receptbestand (schema.org)', 'samen-thuis': 'Samen Thuis-export', import: 'import', manual: 'handmatig (testversie)' }[r.source] || 'import');
  const statusBadge = status => {
    const map = { volledig: ['ok', 'Volledig'], onvolledig: ['warn', 'Onvolledig'], onbekend: ['muted', 'Onbekend'], 'geen-ingredienten': ['muted', 'Geen ingrediënten'] };
    const [cls, label] = map[status] || ['muted', status];
    return `<span class="nut-badge nut-${cls}">${esc(label)}</span>`;
  };

  /* ---------- Weekmenu ---------- */
  function renderWeek() {
    const dates = weekDates(ui.weekStart);
    const summary = NC.weekSummary(data.meals, store(), dates);
    const recipes = store().recipes;
    const options = sel => `<option value="">— geen recept —</option>${recipes.map(r => `<option value="${esc(r.id)}" ${r.id === sel ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}`;
    const days = summary.map(day => `<article class="nut-day"><h3>${esc(fmtDate(day.date, { weekday: 'long', day: 'numeric', month: 'short' }))}</h3>${day.items.length ? `<ul>${day.items.map(item => {
      const n = item.nutrition;
      const energy = n ? `${fmt(n.perServing.energyKcal, 'kcal', n.complete.energyKcal)} per portie` : 'Geen recept gekoppeld';
      const declared = n && n.declaredPerServing && n.declaredPerServing.energyKcal != null ? ` · bron: ${esc(fmt(n.declaredPerServing.energyKcal, 'kcal'))}` : '';
      return `<li data-id="${esc(item.meal.id)}"><div><strong>${esc(item.meal.title || '')}</strong><small>${esc(item.meal.type || '')}${item.recipe && !item.linked ? ' · voorgesteld op titel' : ''}</small></div>
        <div class="nut-meal-values"><span>${esc(energy)}${declared}</span>${n ? statusBadge(n.status) : ''}</div>
        <label class="nut-link">Recept<select data-nut-link-meal="${esc(item.meal.id)}">${options(item.linked ? item.recipe.id : (item.recipe ? item.recipe.id : ''))}</select></label></li>`;
    }).join('')}</ul>` : '<p class="muted">Niets gepland.</p>'}</article>`).join('');
    const checks = ui.checks ? `<div class="nut-checks"><h3>Voedingscontrole <small>(regelgebaseerd, ${esc(new Date(ui.checks.generatedAt).toLocaleTimeString('nl-NL'))})</small></h3><ul>${ui.checks.notes.map(c => `<li class="nut-check-${esc(c.level)}">${esc(c.text)}</li>`).join('') || '<li>Geen opmerkingen.</li>'}</ul></div>` : '';
    return `<section class="card nut-pane" data-nut="weekmenu"><div class="card-head"><div><p class="eyebrow">Weekmenu</p><h2>Voeding bij het weekmenu</h2></div>
      <div class="nut-weeknav" role="group" aria-label="Week kiezen"><button type="button" class="secondary" data-nut-week="-7" aria-label="Vorige week">‹</button><button type="button" class="secondary" data-nut-week="0">Deze week</button><button type="button" class="secondary" data-nut-week="7" aria-label="Volgende week">›</button></div></div>
      <p class="muted">Waarden per portie van het gekoppelde recept. “≥” betekent: niet alle ingrediënten zijn bekend, het werkelijke getal is hoger. Maaltijden beheer je in <a href="#/meals">Weekmenu</a>.</p>
      <div class="nut-week">${days}</div>
      <div class="button-row"><button type="button" class="primary" data-nut-run-checks>Voedingscontrole uitvoeren</button><button type="button" class="secondary" data-nut-week-groceries>Ingrediënten naar Boodschappen</button></div>${checks}</section>`;
  }

  /* ---------- Recepten ---------- */
  function renderRecipes() {
    const s = store();
    const list = s.recipes.slice().sort((a, b) => a.title.localeCompare(b.title, 'nl')).map(r => {
      const n = NC.recipeNutrition(r, s.products);
      const open = ui.openRecipe === r.id;
      const productOptions = sel => `<option value="">— niet gekoppeld —</option>${s.products.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}${p.brand ? ' · ' + esc(p.brand) : ''}</option>`).join('')}`;
      const details = open ? `<div class="nut-recipe-detail">
        <form class="nut-ingredients" data-nut-form="ingredients" data-recipe="${esc(r.id)}">
          <p class="muted nut-readonly">Receptinhoud uit ${esc(sourceLabel(r))}${r.importedAt ? ` · geïmporteerd ${esc(new Date(r.importedAt).toLocaleDateString('nl-NL'))}` : ''}. Wijzig het recept in Osta en importeer opnieuw; hier leg je alleen gewichten en productkoppelingen vast voor de voedingsberekening.</p>
          <label class="field nut-servings">Porties voor planning (optioneel; bron: ${r.servingsKnown ? r.servings : 'onbekend'})<input name="servingsOverride" type="number" min="1" max="50" value="${r.servingsOverride || ''}" placeholder="${r.servings}"></label>
          <table class="nut-ing-table"><thead><tr><th>Ingrediënt</th><th>Gram</th><th>Product</th></tr></thead><tbody>${r.ingredients.map(i => `<tr>
            <td>${esc(i.text)}</td>
            <td><input name="g_${esc(i.id)}" type="number" min="0" max="20000" step="any" inputmode="decimal" value="${i.grams == null ? '' : i.grams}" aria-label="Gram ${esc(i.name)}">${i.gramsApprox ? '<small title="Omgerekend uit ml of lepels">≈</small>' : ''}</td>
            <td><select name="p_${esc(i.id)}" aria-label="Product voor ${esc(i.name)}">${productOptions(i.productId)}</select></td></tr>`).join('')}</tbody></table>
          <div class="button-row"><button type="submit" class="primary">Bewaren</button><button type="button" class="secondary" data-nut-recipe-groceries="${esc(r.id)}">Naar Boodschappen</button><button type="button" class="danger secondary" data-nut-delete-recipe="${esc(r.id)}">Kopie uit Samen Thuis verwijderen</button></div>
        </form>
        <div class="nut-two">${nutrientTable(n.perServing, { complete: n.complete, caption: 'Berekend per portie' })}${n.declaredPerServing ? nutrientTable(n.declaredPerServing, { caption: `Opgegeven door bron (${r.source})` }) : ''}</div>
        ${n.missingReasons.length ? `<p class="muted">Ontbreekt: ${n.missingReasons.map(m => `${esc(m.ingredient)} (${esc(m.reason)})`).join(', ')}</p>` : ''}
        ${n.approx ? '<p class="muted">≈ Enkele hoeveelheden zijn omgerekend uit ml of lepels en daardoor benaderd.</p>' : ''}
        ${r.steps.length ? `<details><summary>Bereiding</summary><ol>${r.steps.map(st => `<li>${esc(st)}</li>`).join('')}</ol></details>` : ''}
        ${r.sourceUrl ? `<p class="muted">Bron: <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceUrl)}</a></p>` : ''}
      </div>` : '';
      return `<li class="nut-recipe" data-id="${esc(r.id)}"><button type="button" class="nut-row" data-nut-open-recipe="${esc(r.id)}" aria-expanded="${open}"><strong>${esc(r.title)}</strong><span>${esc(fmt(n.perServing.energyKcal, 'kcal', n.complete.energyKcal))} p.p. · ${NC.effectiveServings(r)} porties · ${esc(sourceLabel(r))}</span>${statusBadge(n.status)}</button>${details}</li>`;
    }).join('');
    return `<section class="card nut-pane" data-nut="recepten"><div class="card-head"><div><p class="eyebrow">Receptkopieën</p><h2>Recepten uit Osta en voedingswaarde</h2></div></div>
      <p class="muted">Osta is de plek voor je recepten. Samen Thuis bewaart alleen kopieën die je importeert, zodat je ze in het weekmenu kunt plannen en de voedingswaarde kunt berekenen. Nieuw of gewijzigd recept? Pas het aan in Osta en importeer het opnieuw via <a href="#/voeding/uitwisselen">Osta en recepten uitwisselen</a>; je productkoppelingen blijven behouden.</p>
      ${s.recipes.length ? `<ul class="nut-list">${list}</ul>` : '<div class="empty">Nog geen receptkopieën. Importeer recepten uit Osta via Uitwisselen.</div>'}</section>`;
  }

  /* ---------- Producten ---------- */
  function renderProducts() {
    const s = store();
    const results = ui.searchResults.length ? `<ul class="nut-results">${ui.searchResults.map(r => `<li><div><strong>${esc(r.name)}</strong><small>${esc([r.brand, r.quantity, r.barcode].filter(Boolean).join(' · '))}</small></div><button type="button" class="secondary" data-nut-fetch="${esc(r.barcode)}">Ophalen</button></li>`).join('')}</ul>` : '';
    const list = s.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'nl')).map(p => {
      const open = ui.openProduct === p.id;
      const used = NC.productUsage(s, p.id);
      const q = p.quality || FF.assessQuality({ derived: [], ...p });
      const allergens = p.allergensStatus === 'declared' ? p.allergens.join(', ') : p.allergensStatus === 'none-declared' ? 'Geen opgegeven (controleer het etiket)' : 'Onbekend';
      const details = open ? `<div class="nut-product-detail"><div class="nut-two">${nutrientTable(p.per100g, { caption: 'Per 100 g/ml' })}${p.servingGrams != null ? nutrientTable(p.perServing, { caption: `Per portie (${p.servingSize || p.servingGrams + ' g'})` }) : '<p class="muted">Portiegrootte onbekend.</p>'}</div>
        <p><strong>Allergenen:</strong> ${esc(allergens)}${p.traces && p.traces.length ? ` · <strong>Sporen:</strong> ${esc(p.traces.join(', '))}` : ''}</p>
        <p><strong>Ingrediënten:</strong> ${p.ingredientsText ? esc(p.ingredientsText) : '<span class="nut-unknown">onbekend</span>'}</p>
        <p class="muted">Kwaliteit: ${esc(q.level)} (${q.score}/100)${q.issues.length ? ' · ' + esc(q.issues.join(' · ')) : ''}</p>
        ${p.nutriscore ? `<p class="muted">Nutri-Score ${esc(p.nutriscore.toUpperCase())}${p.nova ? ` · NOVA ${p.nova}` : ''}</p>` : ''}
        <p class="muted">${p.source === 'openfoodfacts' ? `Bron: <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (${esc(p.license)}) · opgehaald ${esc(new Date(p.fetchedAt).toLocaleDateString('nl-NL'))}` : 'Handmatig ingevoerd'}${used.length ? ` · Gebruikt in: ${esc(used.join(', '))}` : ''}</p>
        <div class="button-row">${p.barcode && p.source === 'openfoodfacts' ? `<button type="button" class="secondary" data-nut-refresh="${esc(p.barcode)}">Opnieuw ophalen</button>` : ''}<button type="button" class="secondary" data-nut-product-grocery="${esc(p.id)}">Naar Boodschappen</button><button type="button" class="secondary danger" data-nut-delete-product="${esc(p.id)}">Verwijderen</button></div></div>` : '';
      return `<li class="nut-product" data-id="${esc(p.id)}"><button type="button" class="nut-row" data-nut-open-product="${esc(p.id)}" aria-expanded="${open}"><strong>${esc(p.name)}</strong><span>${esc([p.brand, p.quantity].filter(Boolean).join(' · '))}</span><span>${esc(fmt(p.per100g.energyKcal, 'kcal'))}/100 g</span></button>${details}</li>`;
    }).join('');
    return `<section class="card nut-pane" data-nut="producten"><div class="card-head"><div><p class="eyebrow">Producten</p><h2>Productinformatie</h2></div></div>
      <form data-nut-form="barcode" class="nut-inline"><label class="field">Barcode<input name="barcode" inputmode="numeric" autocomplete="off" pattern="[0-9 ]{6,20}" maxlength="20" placeholder="bijv. 8710400000006" required></label><button type="submit" class="primary" ${ui.busy ? 'disabled' : ''}>Opzoeken</button></form>
      <form data-nut-form="search" class="nut-inline"><label class="field">Zoeken op naam<input name="q" maxlength="80" minlength="3" value="${esc(ui.searchQuery)}" placeholder="bijv. volkoren pasta" required></label><button type="submit" class="secondary" ${ui.busy ? 'disabled' : ''}>Zoeken</button></form>
      <p class="muted">Opvragen gebeurt alleen als je op de knop drukt (max. ${FF.LIMITS.product.max} producten en ${FF.LIMITS.search.max} zoekopdrachten per minuut). Eerder opgehaalde producten werken offline.</p>
      ${ui.message ? `<p class="nut-message" role="status">${esc(ui.message)}</p>` : ''}${results}
      ${s.products.length ? `<ul class="nut-list">${list}</ul>` : '<div class="empty">Nog geen producten opgeslagen.</div>'}
      <details class="nut-add"><summary>Product handmatig toevoegen (van het etiket)</summary><form data-nut-form="manual" class="form-grid">
        <label class="field">Naam<input name="name" maxlength="160" required></label><label class="field">Merk<input name="brand" maxlength="80"></label>
        <label class="field">Barcode (optioneel)<input name="barcode" inputmode="numeric" maxlength="20"></label><label class="field">Portie (gram)<input name="servingGrams" type="number" min="0" step="any"></label>
        ${NC.NUTRIENTS.map(n => `<label class="field">${esc(n.label)} per 100 g (${esc(n.unit)})<input name="n_${n.key}" type="number" min="0" step="any" inputmode="decimal" placeholder="leeg = onbekend"></label>`).join('')}
        <label class="field nut-wide">Allergenen (komma-gescheiden)<input name="allergens" maxlength="300"></label>
        <label class="field nut-wide">Ingrediënten<textarea name="ingredientsText" rows="2" maxlength="4000"></textarea></label>
        <div class="button-row"><button type="submit" class="primary">Opslaan</button></div></form></details>${sourceNote}</section>`;
  }

  /* ---------- Uitwisselen ---------- */
  function renderExchange() {
    const plan = ui.plan;
    const labels = { add: 'Nieuwe kopie', merge: 'Bijwerken vanuit bron', same: 'Ongewijzigd', skip: 'Overslaan' };
    const detail = i => [
      i.changes && i.changes.length ? `gewijzigd: ${i.changes.map(c => esc(c.field) + (c.from != null && c.to != null ? ` ${esc(String(c.from))} → ${esc(String(c.to))}` : '')).join(', ')}` : '',
      i.kept && i.kept.length ? `behouden (niet in bron): ${i.kept.map(esc).join(', ')}` : '',
      i.removedIngredients && i.removedIngredients.length ? `vervallen ingrediënten: ${i.removedIngredients.map(esc).join(', ')}` : '',
      i.lostAnnotations && i.lostAnnotations.length ? `<strong>koppeling vervalt bij:</strong> ${i.lostAnnotations.map(esc).join(', ')}` : ''
    ].filter(Boolean).map(t => `<br><small>${t}</small>`).join('');
    const preview = plan ? `<div class="nut-plan"><h3>Voorbeeld (${esc(plan.format)})</h3>${plan.errors.length ? `<p class="nut-message">${plan.errors.map(esc).join('<br>')}</p>` : ''}
      ${plan.items.length ? `<ul>${plan.items.map(i => `<li><span class="nut-badge nut-${i.action === 'add' ? 'ok' : i.action === 'merge' ? 'warn' : 'muted'}">${esc(labels[i.action])}</span> <strong>${esc(i.title)}</strong>${i.matchedBy ? ` <small>(herkend op ${esc(i.matchedBy)}${i.uncertain ? ', twijfelgeval' : ''})</small>` : ''}${i.reason ? ` <small>${esc(i.reason)}</small>` : ''}${i.addedIngredients ? ` <small>+${i.addedIngredients} ingrediënt(en)</small>` : ''}${i.uncertain ? '<br><small>Twijfelgeval: wordt als aparte kopie toegevoegd, tenzij je hieronder kiest voor bijwerken.</small>' : ''}${detail(i)}</li>`).join('')}</ul>` : ''}
      ${plan.items.some(i => i.action === 'add' || i.action === 'merge') ? `${plan.items.some(i => i.uncertain) ? '<label class="nut-check"><input type="checkbox" data-nut-update-uncertain> Twijfelgevallen bijwerken in plaats van als aparte kopie toevoegen</label>' : ''}<div class="button-row"><button type="button" class="primary" data-nut-apply>Importeren</button><button type="button" class="secondary" data-nut-cancel>Annuleren</button></div>` : '<div class="button-row"><button type="button" class="secondary" data-nut-cancel>Sluiten</button></div>'}</div>` : '';
    return `<section class="card nut-pane" data-nut="uitwisselen"><div class="card-head"><div><p class="eyebrow">Osta en recepten</p><h2>Recepten uitwisselen</h2></div></div>
      <p class="muted">Osta is de primaire plek voor recepten en heeft geen openbare koppeling. Deel een recept vanuit Osta als tekst en plak het hier, of kies een JSON-bestand (schema.org/Recipe of een Samen Thuis-export). Je ziet eerst een voorbeeld. Bij opnieuw importeren wint de inhoud uit Osta; je productkoppelingen en gewichten blijven behouden en niets verdwijnt zonder melding.</p>
      <details><summary>Voorbeeld van Osta-tekst</summary><pre class="nut-pre"># Recept: Pasta pesto
Porties: 4
Ingrediënten:
- 400 g pasta
- 100 g Parmezaanse kaas
Bereiding:
1. Kook de pasta.
Voedingswaarde per portie: 610 kcal, eiwit 22 g</pre></details>
      <textarea id="nutImportText" rows="6" maxlength="500000" placeholder="Plak hier de gedeelde recepttekst of JSON"></textarea>
      <div class="button-row"><button type="button" class="primary" data-nut-preview>Voorbeeld bekijken</button><button type="button" class="secondary" data-nut-pick>Bestand kiezen</button><input type="file" id="nutImportFile" accept=".txt,.json,text/plain,application/json,application/ld+json" hidden></div>
      ${preview}
      <h3>Exporteren</h3><p class="muted">Bevat alleen recepten en gekoppelde productgegevens, geen persoonlijke gegevens.</p>
      <div class="button-row"><button type="button" class="secondary" data-nut-export="bundle">Samen Thuis-receptenbestand (.json)</button><button type="button" class="secondary" data-nut-export="schema">schema.org-recepten (.json)</button></div>
      <p class="muted">Weekmenu-regels (“Maandag: …”) en “# Grocery List” importeer je zoals voorheen via <a href="#/imports243">Importeren</a> → Osta.</p></section>`;
  }

  function renderNutrition() {
    return `<div class="nutrition-page"><p class="nut-disclaimer small-note">Voedingsinformatie voor het huishouden, per portie van een gerecht. Geen medisch of dieetadvies en geen persoonlijke inname: persoonlijke voeding hoort volgens de ecosysteemafspraken bij de Sportapp.</p>
      ${renderWeek()}${renderRecipes()}${renderProducts()}${renderExchange()}</div>`;
  }

  /* ---------- Acties ---------- */
  async function lookup(barcode, force = false) {
    ui.busy = true; ui.message = 'Bezig met opzoeken…'; render();
    try {
      const r = await getClient().product(barcode, { force });
      const { store: next, action, product } = NC.upsertProduct(store(), r.product);
      data.nutrition = next; normalized.add(next); ui.openProduct = product.id; ui.searchResults = [];
      ui.message = `${product.name || 'Product'} ${action === 'added' ? 'toegevoegd' : 'bijgewerkt'}${r.fromCache ? (r.stale ? ' (uit oudere cache: ' + (r.warning || 'offline') + ')' : ' (uit cache)') : ''}.`;
      save();
    } catch (e) {
      ui.message = e.message || 'Opzoeken mislukt.';
    } finally { ui.busy = false; render(); }
  }

  async function searchProducts(q) {
    ui.busy = true; ui.searchQuery = q; ui.message = 'Zoeken…'; render();
    try {
      ui.searchResults = await getClient().search(q);
      ui.message = ui.searchResults.length ? `${ui.searchResults.length} resultaten. Kies “Ophalen” voor voedingswaarden.` : 'Geen producten gevonden.';
    } catch (e) { ui.searchResults = []; ui.message = e.message || 'Zoeken mislukt.'; }
    finally { ui.busy = false; render(); }
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function preview(text) {
    ui.plan = RX.planImport(store(), RX.parseAny(text));
    render();
  }

  function toGroceries(items) {
    if (!items.length) return toast('Geen ingrediënten gevonden');
    const result = addGroceries(items.map(i => ({ title: i.title })));
    render();
    toast(`${result.added} boodschappen toegevoegd${result.updated ? `, ${result.updated} bijgewerkt` : ''}`);
  }

  document.addEventListener('click', event => {
    if (current !== 'voeding') return;
    const t = event.target;
    const q = sel => t.closest(sel);
    let el;
    if ((el = q('[data-nut-week]'))) { const d = Number(el.dataset.nutWeek); ui.weekStart = d ? addDays(ui.weekStart, d) : startOfWeek(todayISO()); ui.checks = null; render(); return; }
    if (q('[data-nut-run-checks]')) { ui.checks = NC.weekChecks(NC.weekSummary(data.meals, store(), weekDates(ui.weekStart))); render(); return; }
    if (q('[data-nut-week-groceries]')) {
      const recipes = NC.weekSummary(data.meals, store(), weekDates(ui.weekStart)).flatMap(d => d.items).map(i => i.recipe).filter(Boolean);
      toGroceries(NC.groceryItemsFor(recipes)); return;
    }
    if ((el = q('[data-nut-open-recipe]'))) { ui.openRecipe = ui.openRecipe === el.dataset.nutOpenRecipe ? '' : el.dataset.nutOpenRecipe; render(); return; }
    if ((el = q('[data-nut-open-product]'))) { ui.openProduct = ui.openProduct === el.dataset.nutOpenProduct ? '' : el.dataset.nutOpenProduct; render(); return; }
    if ((el = q('[data-nut-recipe-groceries]'))) { const r = recipeById(el.dataset.nutRecipeGroceries); if (r) toGroceries(NC.groceryItemsFor([r])); return; }
    if ((el = q('[data-nut-product-grocery]'))) { const p = productById(el.dataset.nutProductGrocery); if (p) toGroceries([{ title: p.name }]); return; }
    if ((el = q('[data-nut-delete-recipe]'))) {
      const r = recipeById(el.dataset.nutDeleteRecipe); if (!r) return;
      if (!confirm(`Kopie van “${r.title}” uit Samen Thuis verwijderen? Het recept in Osta blijft bestaan en maaltijden in het weekmenu blijven staan; alleen je productkoppelingen voor dit recept vervallen.`)) return;
      store().recipes = store().recipes.filter(x => x.id !== r.id);
      data.meals.forEach(m => { if (m.recipeId === r.id) delete m.recipeId; });
      ui.openRecipe = ''; persist('Kopie verwijderd uit Samen Thuis'); return;
    }
    if ((el = q('[data-nut-delete-product]'))) {
      const p = productById(el.dataset.nutDeleteProduct); if (!p) return;
      const used = NC.productUsage(store(), p.id);
      if (!confirm(used.length ? `“${p.name}” is gekoppeld aan ${used.length} recept(en). Verwijderen maakt die voedingswaarde onbekend. Doorgaan?` : `“${p.name}” verwijderen?`)) return;
      store().products = store().products.filter(x => x.id !== p.id);
      store().recipes.forEach(r => r.ingredients.forEach(i => { if (i.productId === p.id) i.productId = null; }));
      ui.openProduct = ''; persist('Product verwijderd'); return;
    }
    if ((el = q('[data-nut-fetch]'))) { lookup(el.dataset.nutFetch); return; }
    if ((el = q('[data-nut-refresh]'))) { lookup(el.dataset.nutRefresh, true); return; }
    if (q('[data-nut-preview]')) { preview(document.querySelector('#nutImportText')?.value || ''); return; }
    if (q('[data-nut-pick]')) { document.querySelector('#nutImportFile')?.click(); return; }
    if (q('[data-nut-cancel]')) { ui.plan = null; render(); return; }
    if (q('[data-nut-apply]')) {
      if (!ui.plan) return;
      const updateUncertain = Boolean(document.querySelector('[data-nut-update-uncertain]')?.checked);
      const { store: next, result } = RX.applyImport(store(), ui.plan, { updateUncertain });
      data.nutrition = next; normalized.add(next); ui.plan = null;
      persist(`${result.added} nieuwe kopie(ën) · ${result.merged} bijgewerkt vanuit bron · ${result.unchanged} ongewijzigd${result.products ? ` · ${result.products} producten` : ''}`);
      return;
    }
    if ((el = q('[data-nut-export]'))) {
      const day = todayISO();
      if (el.dataset.nutExport === 'bundle') download(`samen-thuis-recepten-${day}.json`, RX.exportBundle(store()));
      else download(`recepten-schema-org-${day}.json`, RX.exportSchemaOrg(store()));
    }
  });

  document.addEventListener('change', event => {
    if (current !== 'voeding') return;
    const sel = event.target.closest('[data-nut-link-meal]');
    if (sel) {
      const meal = data.meals.find(m => m.id === sel.dataset.nutLinkMeal); if (!meal) return;
      if (sel.value) meal.recipeId = sel.value; else delete meal.recipeId;
      persist(sel.value ? 'Recept gekoppeld' : 'Koppeling verwijderd'); return;
    }
    if (event.target.id === 'nutImportFile') {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      if (file.size > 500000) { toast('Bestand is te groot (maximaal 500 kB)'); return; }
      file.text().then(preview).catch(() => toast('Bestand kon niet worden gelezen'));
      event.target.value = '';
    }
  });

  document.addEventListener('submit', event => {
    if (current !== 'voeding') return;
    const form = event.target.closest('[data-nut-form]'); if (!form) return;
    event.preventDefault();
    const f = new FormData(form); const kind = form.dataset.nutForm;
    if (kind === 'barcode') { lookup(String(f.get('barcode') || '')); return; }
    if (kind === 'search') { searchProducts(String(f.get('q') || '')); return; }
    if (kind === 'manual') {
      try {
        const per100g = {}; NC.NUTRIENTS.forEach(n => { per100g[n.key] = f.get('n_' + n.key); });
        const product = FF.manualProduct({ name: f.get('name'), brand: f.get('brand'), barcode: f.get('barcode'), servingGrams: f.get('servingGrams'), per100g, allergens: f.get('allergens'), ingredientsText: f.get('ingredientsText') });
        const res = NC.upsertProduct(store(), product); data.nutrition = res.store; normalized.add(res.store); ui.openProduct = res.product.id;
        persist('Product opgeslagen');
      } catch (e) { toast(e.message || 'Opslaan mislukt'); }
      return;
    }
    if (kind === 'ingredients') {
      const r = recipeById(form.dataset.recipe); if (!r) return;
      // Alleen annotaties: porties voor planning, gewichten en productkoppelingen. Receptinhoud blijft zoals geïmporteerd.
      const ov = FF.num(f.get('servingsOverride'));
      r.servingsOverride = ov && ov >= 1 ? Math.min(50, Math.round(ov)) : null;
      r.ingredients.forEach(i => {
        const g = f.get('g_' + i.id); const num = FF.num(g);
        if (g === '' || g === null) { i.grams = null; } else if (num != null) { if (num !== i.grams) i.gramsApprox = false; i.grams = num; }
        const pid = String(f.get('p_' + i.id) || ''); i.productId = pid && productById(pid) ? pid : null;
      });
      r.updatedAt = new Date().toISOString();
      persist('Koppelingen bewaard');
    }
  });

  sections.voeding = { label: 'Voeding', icon: '🥗' };
  const baseNutritionRender = render;
  render = function renderWithNutrition(...args) {
    if (current === 'voeding') {
      document.querySelector('#view').innerHTML = renderNutrition();
      if (typeof updateSyncBadge === 'function') updateSyncBadge();
      return;
    }
    return baseNutritionRender(...args);
  };
  window.SamenThuisNutritionUi = { render: renderNutrition, state: ui };
})();
