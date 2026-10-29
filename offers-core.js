(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisOffers = core;
})(globalThis, function () {
  const TZ = 'Europe/Amsterdam';
  const dayInTz = (now, tz = TZ) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const isDate = s => {
    const value = String(s || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const dateOnly = value => {
    const text = String(value || '');
    const date = text.slice(0, 10);
    return (text === date || /^\d{4}-\d{2}-\d{2}T/.test(text)) && isDate(date) ? date : '';
  };

  // Date-only validity is inclusive: an offer ending on 2026-10-12 is active the whole of that day (Amsterdam time).
  // Offers without a validTo are treated as "unknown end" and stay active; no deadline is invented.
  function isActive(offer, now = new Date(), tz = TZ) {
    const today = dayInTz(now, tz);
    if (isDate(offer.validFrom) && offer.validFrom > today) return false;
    if (isDate(offer.validTo) && offer.validTo < today) return false;
    return true;
  }
  function partition(offers, now, tz) {
    const active = [], archive = [], upcoming = [];
    const today = dayInTz(now || new Date(), tz || TZ);
    (offers || []).forEach(offer => {
      if (isActive(offer, now, tz)) active.push(offer);
      else if (isDate(offer.validFrom) && offer.validFrom > today) upcoming.push(offer);
      else archive.push(offer);
    });
    return { active, archive, upcoming };
  }
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const SUPPORTED_STORES = Object.freeze(['Lidl', 'PLUS', 'Jumbo', 'Dirk', 'Aldi', 'Albert Heijn (AH)', 'SPAR']);
  const storeNames = new Map([
    ['lidl', 'Lidl'], ['lidl nederland', 'Lidl'], ['lidl supermarkt', 'Lidl'],
    ['plus', 'PLUS'], ['plus supermarkt', 'PLUS'], ['plus retail', 'PLUS'],
    ['jumbo', 'Jumbo'], ['jumbo supermarkt', 'Jumbo'],
    ['dirk', 'Dirk'], ['dirk van den broek', 'Dirk'], ['dirk vd broek', 'Dirk'],
    ['aldi', 'Aldi'], ['aldi nederland', 'Aldi'],
    ['ah', 'Albert Heijn (AH)'], ['ah to go', 'Albert Heijn (AH)'], ['albert heijn', 'Albert Heijn (AH)'],
    ['albert heijn ah', 'Albert Heijn (AH)'],
    ['albert heijn to go', 'Albert Heijn (AH)'], ['albertheijn', 'Albert Heijn (AH)'],
    ['spar', 'SPAR'], ['spar city', 'SPAR'], ['spar express', 'SPAR'], ['spar university', 'SPAR'],
    ['spar market', 'SPAR'], ['spar enjoy', 'SPAR']
  ]);
  function normalizeStore(value) {
    const key = norm(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    return storeNames.get(key) || '';
  }
  function filterSupportedOffers(offers) {
    return (Array.isArray(offers) ? offers : []).flatMap(offer => {
      const store = normalizeStore(offer?.store);
      return store && SUPPORTED_STORES.includes(store) ? [{ ...offer, store }] : [];
    });
  }
  function normalizeOfferCategory(value, categories = [], fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const key = norm(raw);
    const canonical = categories.find(category => norm(category) === key);
    return canonical || raw;
  }
  function offerDiscountPercent(offer) {
    const reported = finiteOrNull(offer?.discountPercent);
    const price = finiteOrNull(offer?.price);
    const originalPrice = finiteOrNull(offer?.originalPrice);
    const validReported = reported != null && reported > 0 && reported <= 100 ? reported : null;
    if (price == null || originalPrice == null) return validReported;
    if (originalPrice <= 0 || originalPrice <= price) return null;
    const calculated = ((originalPrice - price) / originalPrice) * 100;
    return validReported != null && Math.abs(validReported - calculated) <= 1.5 ? validReported : calculated;
  }
  function matchesOfferFilters(offer, { stores = SUPPORTED_STORES, category = '', favoritesOnly = false, favorites = [], categories = [] } = {}) {
    const store = normalizeStore(offer.store);
    if (!store || !SUPPORTED_STORES.includes(store) || !stores.map(normalizeStore).includes(store)) return false;
    if (category && normalizeOfferCategory(offer.category, categories, 'Onbekend') !== normalizeOfferCategory(category, categories, category)) return false;
    return !favoritesOnly || favorites.includes(key(offer));
  }
  function offerCategoryCounts(offers, { stores = SUPPORTED_STORES, favoritesOnly = false, favorites = [], categories = [] } = {}) {
    const counts = {};
    (offers || []).forEach(offer => {
      if (!matchesOfferFilters(offer, { stores, favoritesOnly, favorites, categories })) return;
      const category = normalizeOfferCategory(offer.category, categories, 'Onbekend');
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }
  function groceryItemFromOffer(offer, idFactory, categories = []) {
    if (!offer || !String(offer.name || '').trim()) throw new Error('Deze aanbieding heeft geen productnaam.');
    if (typeof idFactory !== 'function') throw new Error('Er kan geen uniek boodschappen-ID worden gemaakt.');
    const discountPercent = offerDiscountPercent(offer);
    const category = categoryRecordForOffer(offer, categories);
    const originalPrice = finiteOrNull(offer.originalPrice);
    const price = finiteOrNull(offer.price);
    const details = [
      price != null ? `Prijs: ${formatMoney(price, offer.currency)}` : '',
      originalPrice != null && price != null && originalPrice > price ? `Normale prijs: ${formatMoney(originalPrice, offer.currency)}` : '',
      discountPercent != null ? `${Math.round(discountPercent)}% korting` : '',
      formatUnitPrice(offer),
      offer.promotionText || '',
      offer.validFrom ? `Geldig vanaf ${offer.validFrom}` : '',
      offer.validTo ? `geldig t/m ${offer.validTo}` : ''
    ].filter(Boolean);
    const mappedCategory = category?.name || 'Onbekend';
    return {
      id: idFactory(),
      title: String(offer.name).trim(),
      brand: String(offer.brand || ''),
      ean: String(offer.ean || ''),
      amount: 1,
      unit: String(offer.size || offer.packaging || ''),
      packaging: String(offer.packaging || ''),
      contents: String(offer.contents || ''),
      category: mappedCategory,
      categorySlug: category?.slug || String(offer.categorySlug || offer.unifiedCategory || ''),
      categoryGroup: category?.group || '',
      unifiedCategory: String(offer.unifiedCategory || offer.categorySlug || ''),
      store: normalizeStore(offer.store) || String(offer.store || ''),
      price,
      originalPrice: originalPrice != null && price != null && originalPrice > price ? originalPrice : null,
      discountPercent,
      savingsAmount: finiteOrNull(offer.savingsAmount),
      currency: String(offer.currency || 'EUR'),
      unitPrice: String(offer.unitPrice || ''),
      unitPriceUnit: String(offer.unitPriceUnit || ''),
      unitPriceValue: finiteOrNull(offer.unitPriceValue),
      promotionType: String(offer.promotionType || ''),
      promotionText: String(offer.promotionText || ''),
      promotionalKeywords: Array.isArray(offer.promotionalKeywords) ? offer.promotionalKeywords : [],
      multiBuyQuantity: finiteOrNull(offer.multiBuyQuantity),
      multiBuyPrice: finiteOrNull(offer.multiBuyPrice),
      promoGroupId: offer.promoGroupId ?? null,
      promoGroupMixable: offer.promoGroupMixable ?? null,
      promotionStatus: String(offer.promotionStatus || ''),
      validFrom: String(offer.validFrom || ''),
      validTo: String(offer.validTo || ''),
      validUntilEstimated: offer.validUntilEstimated === true,
      inStoreOnly: offer.inStoreOnly === true,
      onlineOnly: offer.onlineOnly === true,
      loyaltyPrice: finiteOrNull(offer.loyaltyPrice),
      loyaltyProgram: String(offer.loyaltyProgram || ''),
      maxPerCustomer: finiteOrNull(offer.maxPerCustomer),
      imageUrl: String(offer.imageUrl || ''),
      done: false,
      note: details.join(' · '),
      offerKey: key(offer),
      offerUrl: String(offer.sourceUrl || ''),
      providerData: offer.providerData && typeof offer.providerData === 'object' ? offer.providerData : undefined,
      source: 'offer'
    };
  }
  function offerAlreadyInGroceries(groceries, offer) {
    const offerKey = key(offer);
    return (Array.isArray(groceries) ? groceries : []).some(item => item?.offerKey === offerKey);
  }
  function createLatestRequestGuard() {
    let sequence = 0;
    return {
      begin() { sequence += 1; return sequence; },
      isCurrent(token) { return token === sequence; }
    };
  }
  function key(o) {
    const id = o.ean ? `ean:${o.ean}` : `n:${norm(o.brand)}|${norm(o.name)}|${norm(o.size)}`;
    return `${id}|${norm(o.store)}|${o.price ?? ''}|${o.validTo || ''}`;
  }
  // Keep one offer per key; prefer verified, then most recently checked.
  function dedupe(offers) {
    const map = new Map();
    (offers || []).forEach(o => {
      const k = key(o), prev = map.get(k);
      if (!prev || (!!o.verified > !!prev.verified) || (!!o.verified === !!prev.verified && String(o.checkedAt || '') > String(prev.checkedAt || ''))) map.set(k, o);
    });
    return [...map.values()];
  }

  function finiteOrNull(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatMoney(value, currency = 'EUR') {
    const code = String(currency || 'EUR').toUpperCase();
    try { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: code }).format(value).replace(/\u00a0/g, ' '); }
    catch (_) { return ''; }
  }

  // Officiële PrijsProfeet-indeling (GET /api/v1/categories). Alleen gebruikt als expliciete fallback
  // en voor de presentatievolgorde; de API-response blijft leidend voor naam, group en count.
  const CATEGORY_GROUPS = [
    { id: 'vers', name: 'Vers' }, { id: 'houdbaar', name: 'Houdbaar' }, { id: 'dranken', name: 'Dranken' },
    { id: 'verzorging', name: 'Verzorging' }, { id: 'overig', name: 'Overig' }
  ];
  const KNOWN_CATEGORIES = [
    ['groente-fruit', 'Groente & Fruit', 'vers'], ['zuivel-eieren', 'Zuivel & Eieren', 'vers'], ['vega', 'Vega & Plantaardig', 'vers'],
    ['kaas', 'Kaas & Vleeswaren', 'vers'], ['vlees', 'Vlees & Gevogelte', 'vers'], ['vis', 'Vis & Zeevruchten', 'vers'],
    ['brood-bakkerij', 'Brood & Bakkerij', 'vers'],
    ['ontbijt', 'Ontbijt & Beleg', 'houdbaar'], ['pasta-rijst-wereldkeuken', 'Pasta, Rijst & Wereldkeuken', 'houdbaar'],
    ['soepen-conserven-sauzen', 'Soepen, Conserven & Sauzen', 'houdbaar'], ['snoep-koek-chips', 'Snoep, Koek & Chips', 'houdbaar'],
    ['frisdrank', 'Frisdrank & Sappen', 'dranken'], ['koffie-thee', 'Koffie & Thee', 'dranken'], ['bier-wijn-sterke-drank', 'Bier, Wijn & Dranken', 'dranken'],
    ['baby-kind', 'Baby & Kind', 'verzorging'], ['huidverzorging', 'Huidverzorging', 'verzorging'], ['haarverzorging', 'Haarverzorging', 'verzorging'],
    ['deodorant', 'Deodorant', 'verzorging'], ['mondverzorging', 'Mondverzorging', 'verzorging'], ['gezondheid', 'Gezondheid & Vitamines', 'verzorging'],
    ['drogisterij', 'Drogisterij overig', 'verzorging'],
    ['diepvries', 'Diepvries', 'overig'], ['huisdier', 'Huisdieren', 'overig'], ['huishouden', 'Huishouden', 'overig'], ['overig', 'Overig', 'overig']
  ].map(([slug, name, group]) => ({ slug, name, group, count: null }));

  function normalizeCategoryList(list) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach(item => {
      const slug = String(item?.slug || '').trim();
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const count = finiteOrNull(item.count);
      out.push({ slug, name: String(item.name || slug).trim() || slug, group: String(item.group || '').trim().toLowerCase(), count });
    });
    return out;
  }
  // Bouwt de vijf hoofdgroepen op uit het veld `group`; onbekende of ontbrekende groepen vallen onder 'overig'.
  function buildCategoryGroups(apiCategories) {
    const categories = normalizeCategoryList(apiCategories);
    const order = new Map(KNOWN_CATEGORIES.map((c, i) => [c.slug, i]));
    const groups = CATEGORY_GROUPS.map(g => ({ ...g, categories: [] }));
    const byId = new Map(groups.map(g => [g.id, g]));
    categories.forEach(cat => {
      const id = byId.has(cat.group) ? cat.group : 'overig';
      byId.get(id).categories.push({ ...cat, group: id });
    });
    groups.forEach(g => g.categories.sort((a, b) => (order.has(a.slug) ? order.get(a.slug) : 1e6) - (order.has(b.slug) ? order.get(b.slug) : 1e6)));
    return categories.length ? groups : [];
  }
  function categoryBySlug(groups, slug) {
    for (const g of groups || []) { const c = g.categories.find(x => x.slug === slug); if (c) return c; }
    return null;
  }
  function categoryRecordForOffer(offer, categories = []) {
    const slug = String(offer?.unifiedCategory || offer?.unified_category || offer?.categorySlug || offer?.providerData?.unified_category || '').trim();
    const entries = (Array.isArray(categories) ? categories : []).flatMap(item => Array.isArray(item?.categories) ? item.categories : [item]);
    let category = slug ? entries.find(item => item?.slug === slug) : null;
    if (!category && slug) category = KNOWN_CATEGORIES.find(item => item.slug === slug) || null;
    if (!category && !slug) {
      const label = norm(offer?.category);
      category = entries.find(item => item?.name && norm(item.name) === label)
        || KNOWN_CATEGORIES.find(item => norm(item.name) === label)
        || null;
    }
    return category || null;
  }
  // Koppelt een product via de officiële slug (unified_category) aan naam + group. Geen fuzzy matching.
  function applyOfficialCategory(offer, groups) {
    const slug = String(offer?.unifiedCategory || offer?.unified_category || offer?.categorySlug || offer?.providerData?.unified_category || '').trim();
    const cat = slug ? categoryBySlug(groups, slug) : null;
    if (cat) return { ...offer, categorySlug: cat.slug, category: cat.name, categoryGroup: cat.group };
    const known = slug ? KNOWN_CATEGORIES.find(c => c.slug === slug) : null;
    if (known) return { ...offer, categorySlug: known.slug, category: known.name, categoryGroup: known.group };
    return { ...offer, categorySlug: slug, category: 'Onbekend', categoryGroup: '' };
  }
  // unit_price is door de API al per standaardhoeveelheid berekend; alleen formatteren, niet omrekenen.
  function formatUnitPrice(offer) {
    const value = finiteOrNull(offer?.unitPriceValue ?? offer?.unitPrice);
    const unit = String(offer?.unitPriceUnit || '').trim();
    if (value == null || value < 0 || !['kg', 'l', 'stuk'].includes(unit.toLowerCase())) return '';
    const amount = formatMoney(value, offer.currency);
    return amount ? `${amount}/${unit}` : '';
  }
  function matchesCategorySelection(offer, { group = '', categorySlug = '' } = {}) {
    if (categorySlug) return String(offer.categorySlug || offer.unifiedCategory || offer.unified_category || '') === categorySlug;
    if (group) return String(offer.categoryGroup || '') === group;
    return true;
  }
  function mergeOffers(existing, incoming) {
    return dedupe([...(existing || []), ...(incoming || [])]);
  }

  async function fetchOffers({ query, category = '', page = 1, url, headers = {}, fetchImpl = globalThis.fetch, signal } = {}) {
    const term = String(query || '').trim();
    if (!term) throw new Error('Vul een productnaam of merk in.');
    if (!url) throw new Error('De aanbiedingenbron is niet geconfigureerd.');
    if (typeof fetchImpl !== 'function') throw new Error('Aanbiedingen ophalen is niet beschikbaar in deze browser.');
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ search: term.slice(0, 100), ...(category ? { category: String(category) } : {}), ...(page > 1 ? { page: Number(page) } : {}) }),
      ...(signal ? { signal } : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Aanbiedingen ophalen mislukt (${response.status}).`);
    if (!Array.isArray(payload.offers)) throw new Error('De aanbiedingenbron gaf geen geldig aanbod terug.');
    const offers = filterSupportedOffers(payload.offers.filter(item => item && String(item.name || '').trim() && finiteOrNull(item.price) != null && Number(item.price) >= 0)
      .map(item => ({
        ...item,
        name: String(item.name).trim(),
        brand: String(item.brand || ''),
        store: normalizeStore(item.store || item.retailer),
        price: finiteOrNull(item.price),
        originalPrice: finiteOrNull(item.originalPrice),
        discountPercent: offerDiscountPercent({
          ...item,
          price: finiteOrNull(item.price),
          originalPrice: finiteOrNull(item.originalPrice)
        }),
        validFrom: dateOnly(item.validFrom),
        validTo: dateOnly(item.validTo),
        category: String(item.category || ''),
        unifiedCategory: String(item.unifiedCategory || item.unified_category || item.categorySlug || item.providerData?.unified_category || ''),
        categorySlug: String(item.unifiedCategory || item.unified_category || item.categorySlug || item.providerData?.unified_category || ''),
        source: String(item.source || payload.source || 'PrijsProfeet'),
        checkedAt: payload.checkedAt || new Date().toISOString()
      })));
    return { offers: dedupe(offers), hasMore: payload.hasMore === true, page: Number(payload.page) || page, source: String(payload.source || 'PrijsProfeet'), checkedAt: payload.checkedAt || new Date().toISOString() };
  }

  async function fetchCategories({ url, headers = {}, fetchImpl = globalThis.fetch, signal } = {}) {
    if (!url) throw new Error('De categoriebron is niet geconfigureerd.');
    if (typeof fetchImpl !== 'function') throw new Error('Categorieën ophalen is niet beschikbaar in deze browser.');
    const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ categories: true }), ...(signal ? { signal } : {}) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Categorieën ophalen mislukt (${response.status}).`);
    const categories = normalizeCategoryList(Array.isArray(payload) ? payload : payload.categories);
    if (!categories.length) throw new Error('De categoriebron gaf geen categorieën terug.');
    return { categories, checkedAt: payload.checkedAt || new Date().toISOString() };
  }

  return {
    CATEGORY_GROUPS, KNOWN_CATEGORIES, normalizeCategoryList, buildCategoryGroups, categoryBySlug, categoryRecordForOffer, applyOfficialCategory, formatUnitPrice,
    matchesCategorySelection, mergeOffers, fetchCategories,
    isActive, partition, dedupe, key, dayInTz, fetchOffers,
    SUPPORTED_STORES, normalizeStore, filterSupportedOffers, normalizeOfferCategory, offerDiscountPercent, offerCategoryCounts, matchesOfferFilters,
    groceryItemFromOffer, offerAlreadyInGroceries, createLatestRequestGuard
  };
});
