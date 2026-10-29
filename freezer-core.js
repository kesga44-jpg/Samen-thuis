(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.FreezerCore = core;
})(globalThis, function () {
  const LOCATIONS = ['Vriezer', 'Koelkast', 'Voorraadkast'];
  const KINDS = ['Mealprep', 'Zelfgemaakt gerecht', 'Ingrediënt', 'Restje', 'Los product'];
  const ACTIONS = { eaten: 'Opgegeten', thawed: 'Ontdooid', discarded: 'Weggegooid' };
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const newId = () => 'fz' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const addDaysISO = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  function normalize(raw, today) {
    const r = raw || {};
    const portions = Math.max(0, Math.floor(num(r.portions)));
    const log = Array.isArray(r.log) ? r.log : [];
    return {
      ...r,
      id: r.id || newId(), title: String(r.title || '').trim().slice(0, 120),
      kind: KINDS.includes(r.kind) ? r.kind : 'Mealprep',
      location: LOCATIONS.includes(r.location) ? r.location : 'Vriezer',
      category: String(r.category || '').trim().slice(0, 40), label: String(r.label || '').trim().slice(0, 40),
      note: String(r.note || '').trim().slice(0, 300), portions,
      batchPortions: Math.max(portions, Math.floor(num(r.batchPortions ?? portions))),
      prepared: r.prepared || today || '', frozen: r.frozen || '', bestBefore: r.bestBefore || '',
      recipe: r.recipe || '', log,
      processedRefs: Array.isArray(r.processedRefs) ? r.processedRefs : [],
      createdAt: r.createdAt || new Date().toISOString()
    };
  }
  function migrateLegacyStock(stock, freezer, today) {
    const source = Array.isArray(stock) ? stock : [];
    const batches = Array.isArray(freezer) ? freezer.slice() : [];
    const seenSources = new Map();
    const remaining = [];
    let migrated = 0;
    source.forEach(item => {
      const legacy = item || {};
      const isFreezer = legacy.location === 'Vriezer' || (!legacy.location && legacy.category === 'Vriezer');
      const title = String(legacy.title || '').trim();
      const amountText = legacy.amount == null ? '' : String(legacy.amount).trim();
      const amount = Number(amountText.replace(',', '.'));
      if (!isFreezer || !title || !amountText || !Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
        remaining.push(item);
        return;
      }

      const sourceValue = JSON.stringify(legacy);
      const key = legacy.id == null || legacy.id === ''
        ? `value:${sourceValue}`
        : `id:${String(legacy.id)}`;
      if (seenSources.has(key)) {
        if (seenSources.get(key) !== sourceValue) remaining.push(item);
        return;
      }
      seenSources.set(key, sourceValue);
      const existing = batches.find(batch => batch && batch.legacyStockKey === key);
      if (existing) {
        if (JSON.stringify(existing.legacyStock) !== sourceValue) remaining.push(item);
        return;
      }
      let id = `legacy-stock-${hash(key)}`, suffix = 0;
      while (batches.some(batch => batch && batch.id === id && batch.legacyStockKey !== key)) {
        id = `legacy-stock-${hash(key)}-${++suffix}`;
      }
      const legacyStock = JSON.parse(sourceValue);
      batches.push(normalize({
        id, title, kind: 'Los product', location: 'Vriezer',
        category: legacy.category === 'Vriezer' ? '' : legacy.category || '',
        label: legacy.label || '', note: legacy.note || legacy.notes || '',
        portions: amount, batchPortions: amount,
        prepared: legacy.prepared || legacy.preparedAt || '',
        frozen: legacy.frozen || legacy.frozenAt || '',
        bestBefore: legacy.bestBefore || legacy.expiry || legacy.expiresOn || '',
        legacyStockKey: key, legacyStock
      }, today));
      migrated += 1;
    });
    return { stock: remaining, freezer: batches, migrated };
  }
  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }
  // Add an item; merge with an identical batch (same title, location, dates) to prevent duplicates.
  function add(list, raw, today) {
    const item = normalize(raw, today);
    if (!item.title) return { ok: false, error: 'Geef een naam op.' };
    if (item.portions < 1) return { ok: false, error: 'Aantal moet minimaal 1 zijn.' };
    const same = list.find(x => x.title.toLowerCase() === item.title.toLowerCase() && x.location === item.location &&
      x.frozen === item.frozen && x.prepared === item.prepared && x.bestBefore === item.bestBefore && !raw.id);
    if (same) {
      same.batchPortions = Math.max(same.portions, num(same.batchPortions)) + item.batchPortions;
      same.portions += item.portions;
      return { ok: true, item: same, merged: true };
    }
    list.push(item); return { ok: true, item };
  }
  // Consume portions. `ref` makes the booking idempotent (no double stock deduction).
  function consume(item, action, qty, ref, when) {
    if (!ACTIONS[action]) return { ok: false, error: 'Onbekende actie.' };
    qty = Math.floor(num(qty) || 1);
    if (qty < 1) return { ok: false, error: 'Ongeldig aantal.' };
    item.log ||= [];
    item.processedRefs ||= [];
    if (ref && (item.processedRefs.includes(ref) || item.log.some(l => l.ref === ref))) return { ok: true, skipped: true };
    if (qty > item.portions) return { ok: false, error: 'Niet genoeg porties.' };
    item.portions -= qty;
    item.log.push({ id: newId(), action, qty, ref: ref || '', at: when || new Date().toISOString() });
    item.log = item.log.slice(-50);
    if (ref) item.processedRefs.push(ref);
    return { ok: true };
  }
  function move(list, item, location, qty) {
    if (!LOCATIONS.includes(location) || location === item.location) return { ok: false, error: 'Kies een andere plek.' };
    qty = Math.floor(num(qty) || item.portions);
    if (qty < 1 || qty > item.portions) return { ok: false, error: 'Ongeldig aantal.' };
    if (qty === item.portions) { item.location = location; return { ok: true, item }; }
    item.portions -= qty;
    return add(list, { ...item, id: '', log: [], location, portions: qty, batchPortions: qty });
  }
  const daysLeft = (item, today) => item.bestBefore ? Math.round((new Date(item.bestBefore + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 864e5) : null;
  function summary(list, today, soon) {
    soon = soon == null ? 14 : soon;
    const active = list.filter(x => x.portions > 0);
    const urgent = active.filter(x => { const d = daysLeft(x, today); return d !== null && d <= soon; });
    return { total: active.reduce((s, x) => s + x.portions, 0), items: active.length, urgent: urgent.length, expired: active.filter(x => { const d = daysLeft(x, today); return d !== null && d < 0; }).length };
  }
  function sortFilter(list, { query = '', location = '', sort = 'first' } = {}, today) {
    const q = query.trim().toLowerCase();
    const out = list.filter(x => x.portions > 0 && (!location || x.location === location) &&
      (!q || [x.title, x.category, x.label, x.note].join(' ').toLowerCase().includes(q)));
    const key = x => x.bestBefore || '9999-12-31';
    if (sort === 'name') out.sort((a, b) => a.title.localeCompare(b.title, 'nl'));
    else if (sort === 'portions') out.sort((a, b) => b.portions - a.portions);
    else out.sort((a, b) => key(a).localeCompare(key(b)) || (a.frozen || a.prepared).localeCompare(b.frozen || b.prepared));
    return out;
  }
  // Maaltijdplanning: koppel vriezeritem aan maaltijd; voorraad pas verlagen bij 'bereid/gegeten'.
  function bookMeal(item, meal) {
    if (!meal.freezerId) return { ok: false, error: 'Geen vriezergerecht gekoppeld.' };
    return consume(item, 'eaten', meal.persons ? Math.max(1, Math.floor(num(meal.persons))) : 1, 'meal:' + meal.id);
  }
  function wasProcessed(item, ref) {
    return Boolean(item && ref && ((item.processedRefs || []).includes(ref) || (item.log || []).some(entry => entry.ref === ref)));
  }
  function planMeal(meals, item, meal, today) {
    if (!item || !meal || !meal.id) return { ok: false, error: 'Maaltijd of vriezerbatch ontbreekt.' };
    const existing = meals.find(entry => entry.id === meal.id);
    if (existing) return { ok: true, meal: existing, skipped: true };
    const portions = Math.max(1, Math.floor(num(meal.persons) || 1));
    const consumed = new Set([...(item.processedRefs || []), ...(item.log || []).map(entry => entry.ref)].filter(Boolean));
    const reserved = meals.filter(entry => entry.freezerId === item.id
      && (!today || !entry.date || entry.date >= today)
      && !consumed.has(`meal:${entry.id}`))
      .reduce((sum, entry) => sum + Math.max(1, Math.floor(num(entry.persons) || 1)), 0);
    if (portions > item.portions - reserved) return { ok: false, error: 'Niet genoeg porties.' };
    const planned = { ...meal, title: meal.title || item.title, persons: portions, freezerId: item.id };
    meals.push(planned);
    return { ok: true, meal: planned };
  }
  function cancelMeal(meals, mealId) {
    const meal = meals.find(item => item.id === mealId);
    return { meals: meals.filter(item => item.id !== mealId), meal };
  }
  function matchMealTitle(title, meals) {
    const key = String(title || '').trim().toLocaleLowerCase('nl-NL');
    return key ? (meals || []).find(meal => String(meal.title || '').trim().toLocaleLowerCase('nl-NL') === key) || null : null;
  }
  // Ontbrekende ingrediënten (komma/regel-gescheiden tekst) t.o.v. voorraad + boodschappenlijst.
  function missingIngredients(text, stock, groceries) {
    const norm = s => String(s).toLowerCase().replace(/^[\d.,/\s]*(g|gr|kg|ml|l|el|tl|stuks?|st|teentjes?|blik(ken)?)?\s+/i, '').trim();
    const have = new Set((stock || []).filter(s => num(s.amount) > 0).map(s => norm(s.title)));
    const listed = new Set((groceries || []).filter(g => !g.done).map(g => norm(g.title)));
    const seen = new Set();
    return String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).filter(s => {
      const k = norm(s); if (!k || have.has(k) || listed.has(k) || seen.has(k)) return false; seen.add(k); return true;
    });
  }
  return { LOCATIONS, KINDS, ACTIONS, normalize, migrateLegacyStock, add, consume, move, daysLeft, summary, sortFilter, bookMeal, wasProcessed, planMeal, cancelMeal, matchMealTitle, missingIngredients, addDaysISO };
});
