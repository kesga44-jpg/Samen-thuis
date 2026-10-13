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

  async function fetchOffers({ query, url, headers = {}, fetchImpl = globalThis.fetch, signal } = {}) {
    const term = String(query || '').trim();
    if (!term) throw new Error('Vul een productnaam of merk in.');
    if (!url) throw new Error('De aanbiedingenbron is niet geconfigureerd.');
    if (typeof fetchImpl !== 'function') throw new Error('Aanbiedingen ophalen is niet beschikbaar in deze browser.');
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ search: term.slice(0, 100) }),
      ...(signal ? { signal } : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Aanbiedingen ophalen mislukt (${response.status}).`);
    if (!Array.isArray(payload.offers)) throw new Error('De aanbiedingenbron gaf geen geldig aanbod terug.');
    const offers = payload.offers.filter(item => item && String(item.name || '').trim() && finiteOrNull(item.price) != null)
      .map(item => ({
        ...item,
        name: String(item.name).trim(),
        brand: String(item.brand || ''),
        store: String(item.store || ''),
        price: finiteOrNull(item.price),
        originalPrice: finiteOrNull(item.originalPrice),
        discountPercent: finiteOrNull(item.discountPercent),
        validFrom: dateOnly(item.validFrom),
        validTo: dateOnly(item.validTo),
        source: String(item.source || payload.source || 'PrijsProfeet'),
        checkedAt: payload.checkedAt || new Date().toISOString()
      }));
    return { offers: dedupe(offers), source: String(payload.source || 'PrijsProfeet'), checkedAt: payload.checkedAt || new Date().toISOString() };
  }

  return { isActive, partition, dedupe, key, dayInTz, fetchOffers };
});
