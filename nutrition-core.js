(function (root, factory) {
  const core = factory(root.SamenThuisFoodFacts || (typeof require === 'function' ? require('./food-facts-core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisNutrition = core;
})(globalThis, function (FF) {
  'use strict';
  // Voedingsplanning voor het huishouden: producten, receptkopieën en het weekmenu.
  // Rolverdeling (ADR 0001 Samen Thuis, geaccepteerd 2026-11-08): Osta is de primaire plek voor recepten.
  // Samen Thuis bewaart alleen geïmporteerde receptkopieën. De receptinhoud (titel, porties, ingrediënten,
  // bereiding, opgegeven voedingswaarden) komt uit de bron en wordt hier niet bewerkt. Samen Thuis voegt alleen
  // voedingsannotaties toe: productkoppeling en grammen per ingrediënt, en optioneel porties voor de planning.
  // Opslag: data.nutrition = { version, products[], recipes[] } in de bestaande versleutelde huishoudgegevens
  // (samenThuisDataV2, gesynchroniseerd als onderdeel 'nutrition'). Geen persoonlijke inname-, lichaams- of
  // gezondheidsgegevens: die horen volgens DATA_OWNERSHIP bij de Sportapp. Waarden zijn per portie van een gerecht.
  //
  // Rekenregel: onbekend is nooit 0. Een totaal is alleen "volledig" als élk ingrediënt voor die voedingswaarde
  // een bekende waarde én een gewicht heeft. Anders tonen we een ondergrens ("minstens") en de dekking.

  const VERSION = 1;
  const NUTRIENTS = FF.NUTRIENTS;
  const KEYS = NUTRIENTS.map(n => n.key);
  const MAX_PRODUCTS = 500;
  const MAX_RECIPES = 500;
  const MAX_INGREDIENTS = 60;

  const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
  const fold = v => String(v ?? '').toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const genId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function emptyNutrients() { const o = {}; KEYS.forEach(k => { o[k] = null; }); return o; }
  function cleanNutrients(value) {
    const o = emptyNutrients();
    if (value && typeof value === 'object') KEYS.forEach(k => { o[k] = FF.num(value[k]); });
    return o;
  }

  // ---------- Hoeveelheden ----------
  // Herkent "250 g spinazie", "2 el olijfolie", "1,5 kg aardappelen", "3 eieren", "½ ui". Geeft grams=null als onbekend.
  const UNIT_GRAMS = {
    g: 1, gr: 1, gram: 1, grams: 1, kg: 1000, kilo: 1000, mg: 0.001,
    ml: 1, l: 1000, liter: 1000, dl: 100, cl: 10, // vloeistoffen: 1 ml ≈ 1 g (benadering, gemarkeerd)
    el: 15, eetlepel: 15, eetlepels: 15, tbsp: 15, tl: 5, theelepel: 5, theelepels: 5, tsp: 5
  };
  const APPROX_UNITS = new Set(['ml', 'l', 'liter', 'dl', 'cl', 'el', 'eetlepel', 'eetlepels', 'tbsp', 'tl', 'theelepel', 'theelepels', 'tsp']);
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

  function parseAmount(text) {
    const s = String(text || '').trim().replace(/^[-•*]\s*/, '');
    const m = /^((?:\d+(?:[.,]\d+)?)?\s*[½¼¾⅓⅔]?|\d+\/\d+)\s*([a-zA-Z]+\.?)?\s+(.*)$/.exec(s);
    if (!m || !m[1].trim()) return { quantity: null, unit: '', name: s, grams: null, approx: false };
    let raw = m[1].trim(); let quantity = 0;
    if (/^\d+\/\d+$/.test(raw)) { const [a, b] = raw.split('/').map(Number); quantity = b ? a / b : 0; }
    else {
      const frac = raw.match(/[½¼¾⅓⅔]/); if (frac) { quantity += FRACTIONS[frac[0]]; raw = raw.replace(frac[0], ''); }
      if (raw.trim()) quantity += Number(raw.trim().replace(',', '.'));
    }
    let unit = (m[2] || '').toLowerCase().replace(/\.$/, '');
    let name = m[3].trim();
    if (unit && !(unit in UNIT_GRAMS)) { name = `${m[2]} ${name}`.trim(); unit = ''; }
    const grams = unit && Number.isFinite(quantity) ? FF.round(quantity * UNIT_GRAMS[unit], 1) : null;
    return { quantity: Number.isFinite(quantity) && quantity > 0 ? FF.round(quantity, 2) : null, unit, name, grams, approx: APPROX_UNITS.has(unit) };
  }

  // ---------- Normaliseren (veilig voor oude/onbekende data) ----------
  function normalizeIngredient(raw) {
    if (typeof raw === 'string') raw = { text: raw };
    if (!raw || typeof raw !== 'object') return null;
    const text = str(raw.text || [raw.quantity, raw.unit, raw.name].filter(Boolean).join(' '), 200);
    const parsed = parseAmount(text);
    const grams = raw.grams !== undefined ? FF.num(raw.grams) : parsed.grams;
    const name = str(raw.name || parsed.name, 120);
    if (!name && !text) return null;
    return {
      id: str(raw.id, 40) || genId('ing-'),
      text: text || name,
      name,
      grams,
      gramsApprox: raw.gramsApprox !== undefined ? Boolean(raw.gramsApprox) : (raw.grams === undefined && parsed.approx),
      productId: str(raw.productId, 60) || null
    };
  }

  function normalizeRecipe(raw, now = new Date().toISOString()) {
    if (!raw || typeof raw !== 'object') return null;
    const title = str(raw.title || raw.name, 160);
    if (!title) return null;
    const servings = Math.min(50, Math.max(1, Math.round(FF.num(raw.servings) || 0) || 1));
    const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).slice(0, MAX_INGREDIENTS).map(normalizeIngredient).filter(Boolean);
    const declared = raw.declaredPerServing && typeof raw.declaredPerServing === 'object' ? cleanNutrients(raw.declaredPerServing) : null;
    const override = FF.num(raw.servingsOverride);
    return {
      id: str(raw.id, 60) || genId('rec-'),
      title,
      servings,
      servingsKnown: raw.servingsKnown !== undefined ? Boolean(raw.servingsKnown) : FF.num(raw.servings) >= 1,
      // Annotatie van Samen Thuis (niet uit de bron): aantal porties voor de planning als de bron het niet geeft of anders kookt.
      servingsOverride: override && override >= 1 ? Math.min(50, Math.round(override)) : null,
      ingredients,
      steps: (Array.isArray(raw.steps) ? raw.steps : []).map(s => str(s, 1000)).filter(Boolean).slice(0, 40),
      tags: (Array.isArray(raw.tags) ? raw.tags : []).map(t => str(t, 40)).filter(Boolean).slice(0, 12),
      notes: str(raw.notes, 2000),
      // Voedingswaarden zoals opgegeven door de bron (bijv. Osta of een recepten-website), per portie. Nooit overschreven door berekening.
      declaredPerServing: declared && FF.knownCount(declared) ? declared : null,
      // 'manual' bestaat alleen voor compatibiliteit met data uit de niet-gemergde testversie; nieuwe kopieën komen altijd uit een import.
      source: ['osta', 'import', 'schema.org', 'samen-thuis', 'manual'].includes(raw.source) ? raw.source : 'import',
      importedAt: str(raw.importedAt, 40) || null,
      externalRef: str(raw.externalRef, 200) || null,
      sourceUrl: /^https:\/\//i.test(String(raw.sourceUrl || '')) ? str(raw.sourceUrl, 500) : '',
      createdAt: str(raw.createdAt, 40) || now,
      updatedAt: str(raw.updatedAt, 40) || now
    };
  }

  function normalizeStore(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const products = (Array.isArray(src.products) ? src.products : []).filter(p => p && typeof p === 'object' && p.id && p.name).slice(0, MAX_PRODUCTS)
      .map(p => ({ ...p, per100g: cleanNutrients(p.per100g), perServing: cleanNutrients(p.perServing) }));
    const recipes = (Array.isArray(src.recipes) ? src.recipes : []).map(r => normalizeRecipe(r)).filter(Boolean).slice(0, MAX_RECIPES);
    // Onbekende velden van latere versies blijven behouden (zelfde principe als migrateData).
    const out = { ...src, version: VERSION, products, recipes };
    return out;
  }

  // ---------- Berekenen ----------
  const effectiveServings = recipe => recipe.servingsOverride || recipe.servings || 1;

  function recipeNutrition(recipe, products) {
    const byId = new Map((products || []).map(p => [p.id, p]));
    const totals = emptyNutrients();
    const coverage = {}; KEYS.forEach(k => { coverage[k] = { known: 0, missing: 0 }; });
    const missingReasons = [];
    let approx = false;
    for (const ing of recipe.ingredients || []) {
      const product = ing.productId ? byId.get(ing.productId) : null;
      let reason = '';
      if (!product) reason = 'geen product gekoppeld';
      else if (ing.grams == null) reason = 'hoeveelheid in gram onbekend';
      for (const k of KEYS) {
        const per100 = product && product.per100g ? product.per100g[k] : null;
        if (!reason && per100 != null) { totals[k] = (totals[k] || 0) + per100 * ing.grams / 100; coverage[k].known += 1; }
        else coverage[k].missing += 1;
      }
      if (reason) missingReasons.push({ ingredient: ing.name || ing.text, reason });
      if (!reason && ing.gramsApprox) approx = true;
    }
    const n = recipe.ingredients ? recipe.ingredients.length : 0;
    const complete = {}; const perServing = emptyNutrients(); const total = emptyNutrients();
    for (const k of KEYS) {
      complete[k] = n > 0 && coverage[k].missing === 0;
      total[k] = coverage[k].known ? FF.round(totals[k], k === 'salt' ? 2 : 1) : null;
      perServing[k] = total[k] == null ? null : FF.round(total[k] / effectiveServings(recipe), k === 'salt' ? 2 : 1);
    }
    const fullyComplete = KEYS.every(k => complete[k]);
    return {
      total, perServing, complete, coverage, missingReasons, approx, fullyComplete,
      // Opgegeven waarden van de bron blijven zichtbaar naast de berekening; nooit samengevoegd.
      declaredPerServing: recipe.declaredPerServing || null,
      status: n === 0 ? 'geen-ingredienten' : fullyComplete ? 'volledig' : KEYS.some(k => coverage[k].known) ? 'onvolledig' : 'onbekend'
    };
  }

  // Weergave: "540 kcal", "≥ 540 kcal (onvolledig)" of "onbekend". Nooit 0 bij ontbrekende gegevens.
  function formatValue(value, unit, isComplete) {
    if (value == null) return 'onbekend';
    const shown = (unit === 'kcal' ? Math.round(value) : FF.round(value, 1)).toLocaleString('nl-NL');
    return isComplete ? `${shown} ${unit}` : `≥ ${shown} ${unit}`;
  }

  // Maaltijden in het weekmenu koppelen aan recepten: expliciet via meal.recipeId, anders voorstel op (genormaliseerde) titel.
  function matchRecipe(meal, recipes) {
    if (!meal) return null;
    if (meal.recipeId) { const r = (recipes || []).find(x => x.id === meal.recipeId); if (r) return { recipe: r, linked: true }; }
    const key = fold(meal.title);
    if (!key) return null;
    const r = (recipes || []).find(x => fold(x.title) === key);
    return r ? { recipe: r, linked: false } : null;
  }

  // Weekoverzicht per dag: per maaltijd de voedingswaarde per portie (huishoudniveau, geen persoonlijke inname).
  function weekSummary(meals, store, weekDates) {
    const recipes = (store && store.recipes) || []; const products = (store && store.products) || [];
    return weekDates.map(date => {
      const items = (meals || []).filter(m => m && m.date === date).map(meal => {
        const match = matchRecipe(meal, recipes);
        return { meal, recipe: match ? match.recipe : null, linked: match ? match.linked : false, nutrition: match ? recipeNutrition(match.recipe, products) : null };
      });
      return { date, items, withRecipe: items.filter(i => i.recipe).length, total: items.length };
    });
  }

  // Ingrediënten van recepten → boodschappenlijst (titels). Dubbele namen worden samengevoegd op naam.
  function groceryItemsFor(recipes) {
    const seen = new Map();
    for (const r of recipes || []) for (const ing of r.ingredients || []) {
      const key = fold(ing.name || ing.text); if (!key) continue;
      if (!seen.has(key)) seen.set(key, { title: ing.text || ing.name, recipes: [r.title] });
      else seen.get(key).recipes.push(r.title);
    }
    return [...seen.values()];
  }

  // ---------- Producten opslaan zonder informatie te verliezen ----------
  // Bestaand product (zelfde barcode of id) wordt bijgewerkt; bekende waarden worden nooit vervangen door null.
  function upsertProduct(store, product) {
    const s = normalizeStore(store);
    const idx = s.products.findIndex(p => p.id === product.id || (product.barcode && p.barcode === product.barcode));
    if (idx < 0) { s.products.push(product); return { store: s, action: 'added', product }; }
    const prev = s.products[idx];
    const merged = { ...prev, ...product, id: prev.id, per100g: { ...prev.per100g }, perServing: { ...prev.perServing } };
    for (const k of KEYS) {
      if (product.per100g && product.per100g[k] != null) merged.per100g[k] = product.per100g[k];
      if (product.perServing && product.perServing[k] != null) merged.perServing[k] = product.perServing[k];
    }
    ['name', 'brand', 'quantity', 'servingSize', 'ingredientsText'].forEach(f => { if (!product[f] && prev[f]) merged[f] = prev[f]; });
    if (product.servingGrams == null && prev.servingGrams != null) merged.servingGrams = prev.servingGrams;
    if (FF.assessQuality) merged.quality = FF.assessQuality({ derived: [], ...merged });
    s.products[idx] = merged;
    return { store: s, action: 'updated', product: merged };
  }

  function productUsage(store, productId) {
    return ((store && store.recipes) || []).filter(r => (r.ingredients || []).some(i => i.productId === productId)).map(r => r.title);
  }

  // ---------- Regelgebaseerde controle (handmatig gestart, geen AI-dienst) ----------
  function weekChecks(summary) {
    const notes = [];
    const meals = summary.flatMap(d => d.items);
    const withoutRecipe = meals.filter(i => !i.recipe).length;
    if (!meals.length) notes.push({ level: 'info', text: 'Er staan deze week nog geen maaltijden in het weekmenu.' });
    if (withoutRecipe) notes.push({ level: 'info', text: `${withoutRecipe} maaltijd(en) zonder gekoppeld recept: daarvan is geen voedingsinformatie bekend.` });
    const incomplete = meals.filter(i => i.nutrition && i.nutrition.status !== 'volledig').length;
    if (incomplete) notes.push({ level: 'let-op', text: `${incomplete} gerecht(en) met onvolledige voedingsgegevens: totalen zijn een ondergrens.` });
    const noVeg = meals.filter(i => i.recipe && !(i.recipe.ingredients || []).some(g => /groente|spinazie|broccoli|paprika|tomaat|wortel|courgette|sla|ui\b|prei|bloemkool|boon|erwt|kool|aubergine|champignon/i.test(g.name || g.text))).length;
    if (noVeg) notes.push({ level: 'tip', text: `${noVeg} recept(en) zonder herkenbare groente in de ingrediënten (op naam herkend, kan onvolledig zijn).` });
    const daysEmpty = summary.filter(d => !d.items.length).length;
    if (meals.length && daysEmpty) notes.push({ level: 'info', text: `${daysEmpty} dag(en) zonder geplande maaltijd.` });
    return { notes, method: 'regelgebaseerd', generatedAt: new Date().toISOString() };
  }

  return {
    VERSION, KEYS, NUTRIENTS, UNIT_GRAMS, parseAmount, effectiveServings, normalizeIngredient, normalizeRecipe, normalizeStore, cleanNutrients, emptyNutrients,
    recipeNutrition, formatValue, matchRecipe, weekSummary, groceryItemsFor, upsertProduct, productUsage, weekChecks, fold
  };
});
