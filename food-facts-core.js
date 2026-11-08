(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisFoodFacts = core;
})(globalThis, function () {
  'use strict';
  // Open Food Facts: productinformatie en voedingswaarden voor boodschappen en het weekmenu.
  // - Alleen op uitdrukkelijke actie van de gebruiker (knop/scan), nooit zoeken-tijdens-typen.
  // - Limieten volgens OFF-documentatie: product 15/min, zoeken 10/min per IP. Wij blijven ruim daaronder.
  // - Cache per barcode op dit apparaat; gegevens zijn geen persoonsgegevens.
  // - Ontbrekende waarde = null (onbekend), nooit 0. Een expliciete 0 van OFF blijft 0.
  // - Licentie: database ODbL, inhoud DbCL. Bronvermelding wordt bij elke weergave getoond.

  const BASE_URL = 'https://world.openfoodfacts.org';
  const PRODUCT_FIELDS = ['code', 'product_name', 'product_name_nl', 'generic_name_nl', 'brands', 'quantity', 'serving_size', 'serving_quantity',
    'nutriments', 'ingredients_text', 'ingredients_text_nl', 'allergens_tags', 'traces_tags', 'nutriscore_grade', 'nova_group',
    'nutrition_data_per', 'no_nutrition_data', 'states_tags', 'last_modified_t'];
  const SEARCH_FIELDS = ['code', 'product_name', 'product_name_nl', 'brands', 'quantity'];
  const LIMITS = { product: { max: 10, windowMs: 60000 }, search: { max: 6, windowMs: 60000 } };
  const CACHE_KEY = 'samenThuisFoodCacheV1';
  const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const CACHE_MAX = 200;
  const ATTRIBUTION = 'Gegevens: Open Food Facts (ODbL). Vrijwillig ingevoerd, niet gegarandeerd volledig of juist.';

  // Voedingswaarden die Samen Thuis bijhoudt (eenheid per 100 g/ml of per portie).
  const NUTRIENTS = [
    { key: 'energyKcal', off: 'energy-kcal', label: 'Energie', unit: 'kcal' },
    { key: 'fat', off: 'fat', label: 'Vet', unit: 'g' },
    { key: 'saturatedFat', off: 'saturated-fat', label: 'Waarvan verzadigd', unit: 'g' },
    { key: 'carbohydrates', off: 'carbohydrates', label: 'Koolhydraten', unit: 'g' },
    { key: 'sugars', off: 'sugars', label: 'Waarvan suikers', unit: 'g' },
    { key: 'fiber', off: 'fiber', label: 'Vezels', unit: 'g' },
    { key: 'proteins', off: 'proteins', label: 'Eiwit', unit: 'g' },
    { key: 'salt', off: 'salt', label: 'Zout', unit: 'g' }
  ];

  const ALLERGENS_NL = {
    'en:gluten': 'Gluten', 'en:crustaceans': 'Schaaldieren', 'en:eggs': 'Ei', 'en:fish': 'Vis', 'en:peanuts': 'Pinda',
    'en:soybeans': 'Soja', 'en:milk': 'Melk', 'en:nuts': 'Noten', 'en:celery': 'Selderij', 'en:mustard': 'Mosterd',
    'en:sesame-seeds': 'Sesam', 'en:sulphur-dioxide-and-sulphites': 'Sulfiet', 'en:lupin': 'Lupine', 'en:molluscs': 'Weekdieren'
  };

  function cleanBarcode(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 6 && digits.length <= 14 ? digits : '';
  }

  // GTIN-8/12/13/14 controlecijfer. Andere lengtes (interne codes) worden niet afgewezen, maar als 'niet gecontroleerd' gemeld.
  function barcodeCheck(code) {
    const c = cleanBarcode(code);
    if (!c) return { valid: false, checked: false };
    if (![8, 12, 13, 14].includes(c.length)) return { valid: true, checked: false };
    const digits = c.split('').map(Number);
    const check = digits.pop();
    const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
    return { valid: (10 - (sum % 10)) % 10 === check, checked: true };
  }

  // null/undefined/''/NaN → null (onbekend). Getallen (ook 0) blijven behouden. Negatieven zijn ongeldig → null.
  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const round = (value, digits = 1) => value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

  function nutrientsFrom(nutriments, suffix) {
    const out = {}; const derived = [];
    const src = nutriments && typeof nutriments === 'object' ? nutriments : {};
    for (const n of NUTRIENTS) out[n.key] = num(src[`${n.off}${suffix}`]);
    // Energie alleen in kJ opgegeven: omrekenen en markeren als afgeleid (1 kcal = 4,184 kJ).
    if (out.energyKcal == null) {
      const kj = num(src[`energy-kj${suffix}`]) ?? (src[`energy${suffix}`] != null && String(src['energy_unit'] || 'kJ').toLowerCase() === 'kj' ? num(src[`energy${suffix}`]) : null);
      if (kj != null) { out.energyKcal = round(kj / 4.184, 0); derived.push('energyKcal'); }
    }
    // Zout ontbreekt maar natrium is bekend: zout ≈ natrium × 2,5 (afgeleid).
    if (out.salt == null) {
      const sodium = num(src[`sodium${suffix}`]);
      if (sodium != null) { out.salt = round(sodium * 2.5, 2); derived.push('salt'); }
    }
    return { values: out, derived };
  }

  function knownCount(values) { return NUTRIENTS.filter(n => values && values[n.key] != null).length; }

  function tagsToLabels(tags) {
    return (Array.isArray(tags) ? tags : []).filter(t => typeof t === 'string' && t).map(t => ALLERGENS_NL[t] || t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
  }

  // Kwaliteit en volledigheid: wat weten we wel en niet? Gebruikt in de UI en bij het rekenen.
  function assessQuality(product) {
    const issues = [];
    const known = knownCount(product.per100g);
    if (!product.name) issues.push('Productnaam ontbreekt');
    if (product.noNutritionData) issues.push('Fabrikant geeft geen voedingswaarden op');
    else if (known === 0) issues.push('Geen voedingswaarden per 100 g bekend');
    else if (known < NUTRIENTS.length) issues.push(`${NUTRIENTS.length - known} van ${NUTRIENTS.length} voedingswaarden onbekend`);
    if (!product.ingredientsText) issues.push('Ingrediëntenlijst ontbreekt');
    if (product.allergensStatus === 'unknown') issues.push('Allergenen onbekend (niet gelijk aan “geen allergenen”)');
    if (product.servingGrams == null) issues.push('Portiegrootte onbekend');
    const derivedLabel = k => k === 'perServing' ? 'waarden per portie (uit per 100 g)' : ((NUTRIENTS.find(n => n.key === k) || { label: k }).label.toLowerCase());
    if ((product.derived || []).length) issues.push('Afgeleid: ' + product.derived.map(derivedLabel).join(', '));
    const score = Math.round(((known / NUTRIENTS.length) * 0.6 + (product.ingredientsText ? 0.2 : 0) + (product.allergensStatus !== 'unknown' ? 0.1 : 0) + (product.servingGrams != null ? 0.1 : 0)) * 100);
    return { score, level: score >= 85 ? 'goed' : score >= 50 ? 'gedeeltelijk' : 'beperkt', issues, knownNutrients: known };
  }

  // Zet een OFF-product (v2-respons) om naar het Samen Thuis-productmodel. Geeft null als er geen product is.
  function normalizeProduct(payload, fetchedAt = new Date().toISOString()) {
    const p = payload && (payload.product || (payload.code && payload));
    if (!p || typeof p !== 'object') return null;
    const code = cleanBarcode(p.code || payload.code);
    const per100 = nutrientsFrom(p.nutriments, '_100g');
    const perServ = nutrientsFrom(p.nutriments, '_serving');
    const servingGrams = num(p.serving_quantity);
    // Per portie ontbreekt maar per 100 g en portiegewicht zijn bekend: berekenen (afgeleid, alleen bekende waarden).
    let perServing = perServ.values; const servingDerived = [...perServ.derived];
    if (knownCount(perServing) === 0 && servingGrams != null && knownCount(per100.values) > 0) {
      perServing = scaleNutrients(per100.values, servingGrams);
      servingDerived.push('perServing');
    }
    const ingredientsText = String(p.ingredients_text_nl || p.ingredients_text || '').trim().slice(0, 4000);
    const allergens = tagsToLabels(p.allergens_tags);
    const traces = tagsToLabels(p.traces_tags);
    const states = Array.isArray(p.states_tags) ? p.states_tags : [];
    // Lege allergenenlijst betekent alleen "niets opgegeven" als de ingrediënten bekend zijn; anders "onbekend".
    const allergensStatus = allergens.length ? 'declared' : (ingredientsText && !states.includes('en:ingredients-to-be-completed') ? 'none-declared' : 'unknown');
    const product = {
      id: 'off-' + code,
      barcode: code,
      name: String(p.product_name_nl || p.product_name || p.generic_name_nl || '').trim().slice(0, 160),
      brand: String(p.brands || '').split(',')[0].trim().slice(0, 80),
      quantity: String(p.quantity || '').trim().slice(0, 40),
      servingSize: String(p.serving_size || '').trim().slice(0, 40),
      servingGrams,
      per100g: per100.values,
      perServing,
      derived: [...new Set([...per100.derived, ...servingDerived])],
      noNutritionData: p.no_nutrition_data === 'on' || p.no_nutrition_data === true,
      ingredientsText,
      allergens, traces, allergensStatus,
      nutriscore: /^[a-e]$/i.test(String(p.nutriscore_grade || '')) ? String(p.nutriscore_grade).toLowerCase() : null,
      nova: [1, 2, 3, 4].includes(Number(p.nova_group)) ? Number(p.nova_group) : null,
      source: 'openfoodfacts',
      sourceUrl: code ? `${BASE_URL}/product/${code}` : BASE_URL,
      license: 'ODbL 1.0 / DbCL 1.0',
      fetchedAt,
      offModifiedAt: Number.isFinite(Number(p.last_modified_t)) ? new Date(Number(p.last_modified_t) * 1000).toISOString() : null
    };
    product.quality = assessQuality(product);
    return product;
  }

  function scaleNutrients(values, grams) {
    const out = {};
    for (const n of NUTRIENTS) out[n.key] = values && values[n.key] != null && grams != null ? round(values[n.key] * grams / 100, n.key === 'salt' ? 2 : 1) : null;
    return out;
  }

  // Handmatig ingevoerd product (bijv. van het etiket): zelfde model, bron 'manual'. Lege velden blijven null.
  function manualProduct(input, now = new Date().toISOString()) {
    const per100g = {};
    for (const n of NUTRIENTS) per100g[n.key] = num(input && input.per100g ? input.per100g[n.key] : undefined);
    const servingGrams = num(input && input.servingGrams);
    const product = {
      id: String(input && input.id || 'man-' + Math.random().toString(36).slice(2, 10)),
      barcode: cleanBarcode(input && input.barcode),
      name: String(input && input.name || '').trim().slice(0, 160),
      brand: String(input && input.brand || '').trim().slice(0, 80),
      quantity: String(input && input.quantity || '').trim().slice(0, 40),
      servingSize: servingGrams != null ? `${servingGrams} g` : '',
      servingGrams,
      per100g,
      perServing: servingGrams != null ? scaleNutrients(per100g, servingGrams) : scaleNutrients({}, null),
      derived: servingGrams != null ? ['perServing'] : [],
      noNutritionData: false,
      ingredientsText: String(input && input.ingredientsText || '').trim().slice(0, 4000),
      allergens: (Array.isArray(input && input.allergens) ? input.allergens : String(input && input.allergens || '').split(','))
        .map(x => String(x).trim()).filter(Boolean).slice(0, 20),
      traces: [],
      allergensStatus: 'unknown',
      nutriscore: null, nova: null,
      source: 'manual', sourceUrl: '', license: '', fetchedAt: now, offModifiedAt: null
    };
    product.allergensStatus = product.allergens.length ? 'declared' : 'unknown';
    if (!product.name) throw new Error('Geef het product een naam.');
    product.quality = assessQuality(product);
    return product;
  }

  function normalizeSearch(payload) {
    const list = Array.isArray(payload && payload.products) ? payload.products : [];
    return list.map(p => ({
      barcode: cleanBarcode(p.code),
      name: String(p.product_name_nl || p.product_name || '').trim().slice(0, 160),
      brand: String(p.brands || '').split(',')[0].trim().slice(0, 80),
      quantity: String(p.quantity || '').trim().slice(0, 40)
    })).filter(p => p.barcode && p.name).slice(0, 20);
  }

  // Schuivend venster: max verzoeken per minuut per soort, gedeeld over tabbladen via storage.
  function createRateLimiter({ storage = null, now = () => Date.now(), limits = LIMITS } = {}) {
    const mem = { product: [], search: [] };
    const key = kind => `samenThuisFoodRate_${kind}`;
    function read(kind) {
      if (!storage) return mem[kind];
      try { const v = JSON.parse(storage.getItem(key(kind)) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; }
    }
    function write(kind, list) {
      mem[kind] = list;
      if (storage) try { storage.setItem(key(kind), JSON.stringify(list)); } catch (_) { /* opslag vol: geheugen blijft gelden */ }
    }
    return {
      take(kind) {
        const limit = limits[kind]; const t = now();
        const recent = read(kind).filter(x => t - x < limit.windowMs);
        if (recent.length >= limit.max) {
          write(kind, recent);
          return { ok: false, retryInSeconds: Math.max(1, Math.ceil((limit.windowMs - (t - recent[0])) / 1000)) };
        }
        recent.push(t); write(kind, recent);
        return { ok: true };
      }
    };
  }

  function createCache({ storage = null, now = () => Date.now(), ttl = CACHE_TTL_MS, max = CACHE_MAX } = {}) {
    let mem = {};
    const load = () => { if (!storage) return mem; try { const v = JSON.parse(storage.getItem(CACHE_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
    const store = all => { mem = all; if (storage) try { storage.setItem(CACHE_KEY, JSON.stringify(all)); } catch (_) { /* vol: alleen geheugen */ } };
    return {
      get(code, { allowStale = false } = {}) {
        const entry = load()[code];
        if (!entry) return null;
        const stale = now() - entry.t > ttl;
        return stale && !allowStale ? null : { product: entry.p, stale };
      },
      set(code, product) {
        const all = load(); all[code] = { t: now(), p: product };
        const keys = Object.keys(all);
        if (keys.length > max) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - max).forEach(k => delete all[k]);
        store(all);
      },
      size() { return Object.keys(load()).length; }
    };
  }

  class FoodFactsError extends Error {
    constructor(kind, message, extra = {}) { super(message); this.kind = kind; Object.assign(this, extra); }
  }

  // Client met cache, limiet, time-out en duidelijke foutsoorten: invalid | rate-limit | not-found | network | server | timeout.
  function createClient({ fetchImpl = (...a) => globalThis.fetch(...a), storage = null, now = () => Date.now(), timeoutMs = 10000 } = {}) {
    const cache = createCache({ storage, now });
    const limiter = createRateLimiter({ storage, now });
    async function getJson(url) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      let res;
      try { res = await fetchImpl(url, { headers: { Accept: 'application/json' }, credentials: 'omit', ...(controller ? { signal: controller.signal } : {}) }); }
      catch (e) {
        if (e && e.name === 'AbortError') throw new FoodFactsError('timeout', 'Open Food Facts reageert niet (time-out). Probeer het later opnieuw.');
        throw new FoodFactsError('network', 'Geen verbinding met Open Food Facts. Eerder opgehaalde producten blijven beschikbaar.');
      } finally { if (timer) clearTimeout(timer); }
      if (res.status === 429) throw new FoodFactsError('rate-limit', 'Open Food Facts vraagt om even te wachten (te veel verzoeken).', { retryInSeconds: 60 });
      if (res.status === 404) return { status: 0 };
      if (res.status >= 500) throw new FoodFactsError('server', `Open Food Facts is tijdelijk niet beschikbaar (${res.status}).`);
      if (!res.ok) throw new FoodFactsError('server', `Open Food Facts gaf een fout (${res.status}).`);
      try { return await res.json(); }
      catch (_) { throw new FoodFactsError('server', 'Open Food Facts gaf geen geldige gegevens terug.'); }
    }
    return {
      cache,
      async product(barcode, { force = false } = {}) {
        const code = cleanBarcode(barcode);
        if (!code) throw new FoodFactsError('invalid', 'Vul een geldige barcode in (6 tot 14 cijfers).');
        const check = barcodeCheck(code);
        if (check.checked && !check.valid) throw new FoodFactsError('invalid', 'Deze barcode klopt niet (controlecijfer). Controleer de cijfers.');
        if (!force) { const hit = cache.get(code); if (hit) return { product: hit.product, fromCache: true, stale: false }; }
        const slot = limiter.take('product');
        if (!slot.ok) {
          const stale = cache.get(code, { allowStale: true });
          if (stale) return { product: stale.product, fromCache: true, stale: true };
          throw new FoodFactsError('rate-limit', `Even wachten: maximaal ${LIMITS.product.max} productopvragingen per minuut. Probeer over ${slot.retryInSeconds} s opnieuw.`, { retryInSeconds: slot.retryInSeconds });
        }
        try {
          const payload = await getJson(`${BASE_URL}/api/v2/product/${code}.json?fields=${PRODUCT_FIELDS.join(',')}`);
          if (!payload || payload.status === 0 || !payload.product) throw new FoodFactsError('not-found', 'Product niet gevonden in Open Food Facts. Je kunt het handmatig toevoegen.');
          const product = normalizeProduct(payload, new Date(now()).toISOString());
          cache.set(code, product);
          return { product, fromCache: false, stale: false };
        } catch (e) {
          const stale = e.kind !== 'not-found' && cache.get(code, { allowStale: true });
          if (stale) return { product: stale.product, fromCache: true, stale: true, warning: e.message };
          throw e;
        }
      },
      async search(query, { page = 1 } = {}) {
        const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (q.length < 3) throw new FoodFactsError('invalid', 'Typ minstens 3 tekens en druk op Zoeken.');
        const slot = limiter.take('search');
        if (!slot.ok) throw new FoodFactsError('rate-limit', `Even wachten: maximaal ${LIMITS.search.max} zoekopdrachten per minuut. Probeer over ${slot.retryInSeconds} s opnieuw.`, { retryInSeconds: slot.retryInSeconds });
        const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '10', page: String(Math.min(10, Math.max(1, page | 0))), fields: SEARCH_FIELDS.join(',') });
        return normalizeSearch(await getJson(`${BASE_URL}/cgi/search.pl?${params}`));
      }
    };
  }

  return {
    BASE_URL, PRODUCT_FIELDS, LIMITS, CACHE_KEY, CACHE_TTL_MS, ATTRIBUTION, NUTRIENTS, ALLERGENS_NL,
    cleanBarcode, barcodeCheck, num, round, normalizeProduct, manualProduct, scaleNutrients, assessQuality, knownCount,
    normalizeSearch, createRateLimiter, createCache, createClient, FoodFactsError
  };
});
