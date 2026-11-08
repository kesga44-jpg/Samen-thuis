(function (root, factory) {
  const core = factory(root.SamenThuisNutrition || (typeof require === 'function' ? require('./nutrition-core.js') : null),
    root.SamenThuisFoodFacts || (typeof require === 'function' ? require('./food-facts-core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisRecipeExchange = core;
})(globalThis, function (NC, FF) {
  'use strict';
  // Gecontroleerde uitwisseling van recepten tussen Osta (primaire plek voor recepten) en Samen Thuis (voedingsplanning).
  // Samen Thuis is geen tweede receptenbeheer: het bewaart alleen geïmporteerde kopieën plus eigen voedingsannotaties.
  //
  // Feitelijke situatie (onderzocht 2026-11-08): Osta ("Save & Share Recipes", iOS/macOS) heeft geen gedocumenteerde
  // publieke API of exportbestand. Wel: delen als tekst en importeren van recepten-websites. Voedingswaarden zijn in
  // Osta een betaalde Premium-functie en dus nooit een vereiste. Daarom ondersteunen we drie open formaten:
  //   1. Gedeelde Osta-tekst (plakken): weekmenu-regels, "# Grocery List" én receptblokken met ingrediënten.
  //   2. schema.org/Recipe JSON(-LD): de open standaard die recepten-websites en veel receptenapps gebruiken.
  //   3. Samen Thuis-uitwisselbestand `samen-thuis.recipes` versie 1 (export én herimport, verliesvrij).
  // Elke import: eerst voorbeeld, dan bevestigen. Dubbele recepten worden herkend; voedingsinformatie gaat nooit verloren.

  const FORMAT = 'samen-thuis.recipes';
  const FORMAT_VERSION = 1;
  const MAX_TEXT = 500000;

  const ING_HEAD = /^\s*#*\s*(ingredi[eë]nten|ingredients)\s*:?\s*$/i;
  const STEP_HEAD = /^\s*#*\s*(bereiding|bereidingswijze|instructies|instructions|method|directions|steps)\s*:?\s*$/i;
  const RECIPE_HEAD = /^\s*#{1,3}\s*(?:recept|recipe)\s*:\s*(.+)$/i;
  const SERVINGS = /^\s*(?:porties|personen|servings|serves|yield)\s*:?\s*(\d{1,2})\b/i;
  const NUTRITION_LINE = /^\s*(?:voedingswaarde[n]?|nutrition)(?:\s*(?:per\s*(?:portie|serving)))?\s*:\s*(.+)$/i;

  // "520 kcal, eiwit 25 g, vet 18 g, koolhydraten 60 g, zout 1,2 g" → {energyKcal:520, proteins:25, ...}; onbekend blijft null.
  const NUTRIENT_WORDS = [
    ['energyKcal', /(\d+(?:[.,]\d+)?)\s*kcal|(?:calorie[eë]n|calories|energie)\s*:?\s*(\d+(?:[.,]\d+)?)/i],
    ['proteins', /(?:eiwit(?:ten)?|protein)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['fat', /(?:^|[^a-z])(?:vet(?:ten)?|fat)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['saturatedFat', /(?:verzadigd(?:\s*vet)?|saturated(?:\s*fat)?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['carbohydrates', /(?:koolhydraten|carbohydrates?|carbs)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['sugars', /(?:suikers?|sugars?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['fiber', /(?:vezels?|fib(?:er|re))\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i],
    ['salt', /(?:zout|salt)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i]
  ];
  function parseNutritionText(text) {
    const out = NC.emptyNutrients();
    for (const [key, re] of NUTRIENT_WORDS) {
      const m = re.exec(String(text || ''));
      if (m) out[key] = FF.num((m[1] || m[2] || '').replace(',', '.'));
    }
    return FF.knownCount(out) ? out : null;
  }

  // ---------- 1. Osta-tekst ----------
  function parseOstaText(text) {
    const lines = String(text || '').slice(0, MAX_TEXT).split(/\r?\n/);
    const recipes = []; let current = null; let mode = '';
    const flush = () => { if (current && current.title) recipes.push(current); current = null; mode = ''; };
    for (const line of lines) {
      const head = RECIPE_HEAD.exec(line);
      if (head) { flush(); current = { title: head[1].trim(), ingredients: [], steps: [], source: 'osta' }; continue; }
      if (!current) continue;
      if (/^\s*#*\s*grocery list\s*$/i.test(line)) { flush(); continue; }
      if (ING_HEAD.test(line)) { mode = 'ing'; continue; }
      if (STEP_HEAD.test(line)) { mode = 'step'; continue; }
      const sv = SERVINGS.exec(line); if (sv) { current.servings = Number(sv[1]); continue; }
      const nu = NUTRITION_LINE.exec(line); if (nu) { const d = parseNutritionText(nu[1]); if (d) current.declaredPerServing = d; continue; }
      const t = line.trim(); if (!t) continue;
      if (/^https:\/\/\S+$/i.test(t)) { current.sourceUrl = t; continue; }
      if (mode === 'ing') current.ingredients.push({ text: t.replace(/^[-•*]\s*/, '') });
      else if (mode === 'step') current.steps.push(t.replace(/^\d+[.)]\s*|^[-•*]\s*/, ''));
    }
    flush();
    return recipes;
  }

  // ---------- 2. schema.org/Recipe ----------
  function asArray(v) { return Array.isArray(v) ? v : v == null ? [] : [v]; }
  function findRecipesInJsonLd(value, out = [], depth = 0) {
    if (!value || typeof value !== 'object' || depth > 6 || out.length >= 200) return out;
    if (Array.isArray(value)) { value.forEach(v => findRecipesInJsonLd(v, out, depth + 1)); return out; }
    const types = asArray(value['@type']).map(String);
    if (types.includes('Recipe')) out.push(value);
    if (value['@graph']) findRecipesInJsonLd(value['@graph'], out, depth + 1);
    return out;
  }
  function stepsFrom(instr) {
    return asArray(instr).flatMap(s => typeof s === 'string' ? [s] : s && s['@type'] === 'HowToSection' ? stepsFrom(s.itemListElement) : s && s.text ? [s.text] : []);
  }
  function fromSchemaOrg(r) {
    const n = r.nutrition && typeof r.nutrition === 'object' ? r.nutrition : null;
    const g = v => FF.num(String(v ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
    const declared = n ? NC.cleanNutrients({
      energyKcal: g(n.calories), proteins: g(n.proteinContent), fat: g(n.fatContent), saturatedFat: g(n.saturatedFatContent),
      carbohydrates: g(n.carbohydrateContent), sugars: g(n.sugarContent), fiber: g(n.fiberContent),
      salt: n.sodiumContent != null && g(n.sodiumContent) != null ? FF.round(g(n.sodiumContent) * (/mg/i.test(String(n.sodiumContent)) ? 0.001 : 1) * 2.5, 2) : null
    }) : null;
    const yieldText = asArray(r.recipeYield).map(String).join(' ');
    return {
      title: r.name, servings: Number((/\d+/.exec(yieldText) || [])[0]) || undefined,
      ingredients: asArray(r.recipeIngredient || r.ingredients).map(String),
      steps: stepsFrom(r.recipeInstructions), tags: asArray(r.recipeCategory).concat(asArray(r.keywords).flatMap(k => String(k).split(','))).map(String),
      declaredPerServing: declared, source: 'schema.org', externalRef: r['@id'] || r.url || null, sourceUrl: r.url || ''
    };
  }

  // ---------- Herkennen ----------
  function parseAny(text) {
    const t = String(text || '').trim();
    if (!t) return { format: 'leeg', recipes: [], errors: ['Geen inhoud gevonden.'] };
    if (t.length > MAX_TEXT) return { format: 'te-groot', recipes: [], errors: ['Bestand is te groot (maximaal 500 kB).'] };
    if (/^[\[{]/.test(t)) {
      let json;
      try { json = JSON.parse(t); } catch (_) { return { format: 'json', recipes: [], errors: ['Ongeldige JSON.'] }; }
      if (json && json.format === FORMAT) {
        if (Number(json.version) > FORMAT_VERSION) return { format: FORMAT, recipes: [], errors: [`Bestand gebruikt versie ${json.version}; deze app ondersteunt t/m versie ${FORMAT_VERSION}. Werk Samen Thuis eerst bij.`] };
        return { format: FORMAT, recipes: asArray(json.recipes), products: asArray(json.products), errors: [] };
      }
      const found = findRecipesInJsonLd(json);
      if (found.length) return { format: 'schema.org', recipes: found.map(fromSchemaOrg), errors: [] };
      return { format: 'json', recipes: [], errors: ['Geen recepten gevonden in dit JSON-bestand.'] };
    }
    const recipes = parseOstaText(t);
    return { format: 'osta-tekst', recipes, errors: recipes.length ? [] : ['Geen receptblokken gevonden. Gebruik “# Recept: Naam” met “Ingrediënten:”. Weekmenu-regels en “# Grocery List” blijven via Osta importeren werken.'] };
  }

  // ---------- Dubbelen herkennen en samenvoegen ----------
  function fingerprint(recipe) {
    const ings = (recipe.ingredients || []).map(i => NC.fold(i.name || i.text)).filter(Boolean).sort().join('|');
    return NC.fold(recipe.title) + '#' + ings;
  }
  function checksum(recipe) {
    // Stabiele, niet-cryptografische controlesom over de inhoud (voor reconciliatie, geen beveiliging).
    const s = JSON.stringify([recipe.title, recipe.servings, (recipe.ingredients || []).map(i => [i.text, i.grams, i.productId]), recipe.steps, recipe.declaredPerServing]);
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function findDuplicate(existing, incoming) {
    if (incoming.externalRef) { const hit = existing.find(r => r.externalRef && r.externalRef === incoming.externalRef); if (hit) return { recipe: hit, by: 'bronverwijzing' }; }
    const byId = existing.find(r => r.id === incoming.id); if (byId) return { recipe: byId, by: 'id' };
    const fp = fingerprint(incoming); const exact = existing.find(r => fingerprint(r) === fp); if (exact) return { recipe: exact, by: 'titel+ingrediënten' };
    // Osta-tekst heeft geen vaste id: dezelfde titel uit dezelfde bron is dan de identiteit (precies één kandidaat).
    // Andere bron of meerdere recepten met die titel → twijfelgeval; de gebruiker kiest.
    const title = NC.fold(incoming.title); const sameTitle = existing.filter(r => NC.fold(r.title) === title);
    if (!sameTitle.length) return null;
    const sameSource = sameTitle.filter(r => r.source === incoming.source);
    if (sameTitle.length === 1 && sameSource.length === 1) return { recipe: sameSource[0], by: 'titel (zelfde bron)' };
    return { recipe: sameSource[0] || sameTitle[0], by: 'titel', uncertain: true };
  }

  // Bijwerken vanuit de bron (Osta is primair, ADR 0001 Samen Thuis):
  // - receptinhoud (titel, porties, ingrediënten, bereiding, tags, notities, opgegeven voedingswaarden) komt uit de nieuwe import;
  // - wat de bron niet (meer) levert, blijft behouden in plaats van te verdwijnen (geen verlies van informatie);
  // - voedingsannotaties van Samen Thuis (productkoppeling, zelf ingevulde grammen, porties voor planning) blijven staan
  //   zolang het ingrediënt in de bron bestaat; vervallen ingrediënten worden gemeld.
  function mergeRecipe(existing, incoming, now) {
    const changes = []; const kept = [];
    const merged = { ...existing, title: incoming.title, source: incoming.source || existing.source, importedAt: now, updatedAt: now };
    if (incoming.title !== existing.title) changes.push({ field: 'titel', from: existing.title, to: incoming.title });
    if (incoming.servingsKnown) {
      if (incoming.servings !== existing.servings) changes.push({ field: 'porties', from: existing.servings, to: incoming.servings });
      merged.servings = incoming.servings;
    } else if (existing.servings > 1) kept.push('porties');
    for (const f of ['steps', 'tags']) {
      if ((incoming[f] || []).length) { if (JSON.stringify(incoming[f]) !== JSON.stringify(existing[f])) changes.push({ field: f === 'steps' ? 'bereiding' : 'tags' }); merged[f] = incoming[f]; }
      else if ((existing[f] || []).length) kept.push(f === 'steps' ? 'bereiding' : 'tags');
    }
    for (const f of ['notes', 'sourceUrl', 'externalRef']) {
      if (incoming[f]) { if (incoming[f] !== existing[f]) changes.push({ field: f }); merged[f] = incoming[f]; }
      else if (existing[f]) kept.push(f);
    }
    // Ingrediënten in de volgorde van de bron; annotaties overnemen op (genormaliseerde) naam.
    const byName = new Map(existing.ingredients.map(i => [NC.fold(i.name || i.text), i]));
    const seen = new Set();
    let addedIngredients = 0;
    merged.ingredients = incoming.ingredients.map(inc => {
      const key = NC.fold(inc.name || inc.text); seen.add(key);
      const prev = byName.get(key);
      if (!prev) { addedIngredients += 1; return inc; }
      return { ...inc, id: prev.id, productId: prev.productId, grams: inc.grams != null ? inc.grams : prev.grams, gramsApprox: inc.grams != null ? inc.gramsApprox : prev.gramsApprox };
    });
    const removed = existing.ingredients.filter(i => !seen.has(NC.fold(i.name || i.text)));
    if (!incoming.ingredients.length && existing.ingredients.length) { merged.ingredients = existing.ingredients; kept.push('ingrediënten'); removed.length = 0; }
    // Opgegeven voedingswaarden: waarde uit de bron wint; ontbreekt die, dan blijft de vorige.
    const d = { ...(existing.declaredPerServing || NC.emptyNutrients()) };
    let keptNutrients = 0;
    for (const k of NC.KEYS) {
      const a = d[k], b = incoming.declaredPerServing ? incoming.declaredPerServing[k] : null;
      if (b != null) { if (a != null && Math.abs(a - b) > Math.max(0.5, a * 0.02)) changes.push({ field: k, from: a, to: b }); d[k] = b; }
      else if (a != null) keptNutrients += 1;
    }
    if (keptNutrients) kept.push(`${keptNutrients} opgegeven voedingswaarde(n)`);
    merged.declaredPerServing = FF.knownCount(d) ? d : null;
    return { merged, addedIngredients, removedIngredients: removed.map(i => i.name || i.text), changes, kept,
      lostAnnotations: removed.filter(i => i.productId || i.grams != null).map(i => i.name || i.text) };
  }

  // Voorbeeld: wat gebeurt er bij importeren? Wijzigt niets.
  function planImport(store, parsed, now = new Date().toISOString()) {
    const s = NC.normalizeStore(store);
    const plan = { format: parsed.format, errors: [...(parsed.errors || [])], items: [] };
    const batch = [];
    for (const raw of parsed.recipes || []) {
      const incoming = NC.normalizeRecipe({ ...raw, id: parsed.format === FORMAT ? raw.id : undefined, importedAt: now }, now);
      if (!incoming) { plan.items.push({ action: 'skip', title: String(raw && (raw.title || raw.name) || '(zonder titel)'), reason: 'Titel ontbreekt' }); continue; }
      const dupInBatch = batch.find(r => fingerprint(r) === fingerprint(incoming));
      if (dupInBatch) { plan.items.push({ action: 'skip', title: incoming.title, reason: 'Komt dubbel voor in het bestand' }); continue; }
      batch.push(incoming);
      const dup = findDuplicate(s.recipes, incoming);
      if (!dup) plan.items.push({ action: 'add', title: incoming.title, recipe: incoming });
      else {
        const m = mergeRecipe(structuredCloneSafe(dup.recipe), incoming, now);
        const changed = checksum(m.merged) !== checksum(dup.recipe) || JSON.stringify(m.merged.tags) !== JSON.stringify(dup.recipe.tags);
        plan.items.push({ action: changed ? 'merge' : 'same', title: incoming.title, existingId: dup.recipe.id, matchedBy: dup.by, uncertain: Boolean(dup.uncertain),
          recipe: changed ? m.merged : dup.recipe, incoming, addedIngredients: m.addedIngredients, removedIngredients: m.removedIngredients, lostAnnotations: m.lostAnnotations, changes: m.changes, kept: m.kept });
      }
    }
    plan.products = (parsed.products || []).filter(p => p && p.id && p.name);
    plan.counts = ['add', 'merge', 'same', 'skip'].reduce((o, a) => (o[a] = plan.items.filter(i => i.action === a).length, o), {});
    return plan;
  }

  function structuredCloneSafe(v) { return JSON.parse(JSON.stringify(v)); }

  // Toepassen na bevestiging. Twijfelgevallen (alleen gelijke titel) worden standaard als aparte kopie toegevoegd,
  // zodat een ander recept met dezelfde naam nooit wordt overschreven. `updateUncertain: true` werkt ze toch bij.
  function applyImport(store, plan, { updateUncertain = false, skipUncertain } = {}) {
    if (skipUncertain !== undefined) updateUncertain = !skipUncertain;
    let s = NC.normalizeStore(store);
    const result = { added: 0, merged: 0, unchanged: 0, skipped: 0, products: 0 };
    for (const item of plan.items) {
      if (item.action === 'add' || (item.action === 'merge' && item.uncertain && !updateUncertain)) {
        const fresh = item.action === 'add' ? item.recipe : { ...item.incoming, id: undefined };
        const r = NC.normalizeRecipe(fresh); s.recipes.push(r); result.added += 1;
      } else if (item.action === 'merge') {
        const idx = s.recipes.findIndex(r => r.id === item.existingId);
        if (idx >= 0) { s.recipes[idx] = NC.normalizeRecipe(item.recipe); result.merged += 1; } else result.skipped += 1;
      } else if (item.action === 'same') result.unchanged += 1;
      else result.skipped += 1;
    }
    for (const p of plan.products || []) { s = NC.upsertProduct(s, p).store; result.products += 1; }
    return { store: s, result };
  }

  // ---------- Exporteren ----------
  function exportBundle(store, { recipeIds = null, now = new Date().toISOString() } = {}) {
    const s = NC.normalizeStore(store);
    const recipes = recipeIds ? s.recipes.filter(r => recipeIds.includes(r.id)) : s.recipes;
    const productIds = new Set(recipes.flatMap(r => r.ingredients.map(i => i.productId).filter(Boolean)));
    return {
      format: FORMAT, version: FORMAT_VERSION, exportedAt: now, app: 'Samen Thuis',
      note: 'Bevat recepten en gekoppelde productgegevens (Open Food Facts: ODbL). Geen persoonlijke gegevens.',
      recipes: recipes.map(r => ({ ...r, checksum: checksum(r) })),
      products: s.products.filter(p => productIds.has(p.id))
    };
  }

  // schema.org/Recipe (JSON-LD) voor gebruik in andere apps; berekende waarden alleen als ze volledig zijn.
  function exportSchemaOrg(store) {
    const s = NC.normalizeStore(store);
    return s.recipes.map(r => {
      const calc = NC.recipeNutrition(r, s.products);
      const per = r.declaredPerServing || (calc.fullyComplete ? calc.perServing : null);
      const out = {
        '@context': 'https://schema.org', '@type': 'Recipe', name: r.title, recipeYield: `${r.servings} porties`,
        recipeIngredient: r.ingredients.map(i => i.text), recipeInstructions: r.steps.map(text => ({ '@type': 'HowToStep', text }))
      };
      if (r.sourceUrl) out.url = r.sourceUrl;
      if (per) {
        const n = { '@type': 'NutritionInformation' };
        if (per.energyKcal != null) n.calories = `${Math.round(per.energyKcal)} kcal`;
        [['proteins', 'proteinContent'], ['fat', 'fatContent'], ['saturatedFat', 'saturatedFatContent'], ['carbohydrates', 'carbohydrateContent'], ['sugars', 'sugarContent'], ['fiber', 'fiberContent']]
          .forEach(([k, f]) => { if (per[k] != null) n[f] = `${per[k]} g`; });
        out.nutrition = n;
      }
      return out;
    });
  }

  return { FORMAT, FORMAT_VERSION, parseNutritionText, parseOstaText, fromSchemaOrg, findRecipesInJsonLd, parseAny, fingerprint, checksum, findDuplicate, mergeRecipe, planImport, applyImport, exportBundle, exportSchemaOrg };
});
