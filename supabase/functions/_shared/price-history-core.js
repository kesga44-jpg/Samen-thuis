(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisPriceHistory = core;
})(globalThis, function () {
  function validPrice(value) {
    if (value == null || typeof value === 'boolean' || !['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? price : null;
  }

  function clean(value) {
    return String(value ?? '').trim();
  }

  function identityKeys(item) {
    const keys = [];
    const baseProductId = clean(item?.baseProductId);
    const productId = clean(item?.productId);
    const ean = clean(item?.ean).replace(/\D/g, '');
    if (baseProductId) keys.push(`base:${baseProductId}`);
    if (productId) keys.push(`product:${productId}`);
    if (ean) keys.push(`ean:${ean}`);
    return keys;
  }

  function packageKey(item) {
    return clean(item?.packaging ?? item?.quantity ?? item?.size)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function isReliableObservation(item) {
    return item?.matchReliable === true
      && Boolean(clean(item.source))
      && identityKeys(item).length > 0
      && Boolean(packageKey(item))
      && validPrice(item.price) != null;
  }

  function sameProductAndPackage(a, b) {
    if (!isReliableObservation(a) || !isReliableObservation(b) || clean(a.source) !== clean(b.source)) return false;
    if (packageKey(a) !== packageKey(b)) return false;
    const identities = new Set(identityKeys(a));
    return identityKeys(b).some(identity => identities.has(identity));
  }

  function learnedThresholds(track) {
    const latest = track?.latest;
    if (!isReliableObservation(latest)) return { floor: null, good: null, count: 0 };
    const values = [...new Set((Array.isArray(track.history) ? track.history : [])
      .filter(item => sameProductAndPackage(item, latest))
      .map(item => validPrice(item.price))
      .filter(price => price != null)
      .map(price => price.toFixed(2)))]
      .map(Number)
      .sort((a, b) => a - b);
    if (values.length < 4) return { floor: null, good: null, count: values.length };
    const percentile = (p) => {
      const index = (values.length - 1) * p;
      const low = Math.floor(index), high = Math.ceil(index);
      return low === high ? values[low] : values[low] + (values[high] - values[low]) * (index - low);
    };
    return { floor: percentile(0.15), good: percentile(0.35), count: values.length };
  }

  function manualPrice(value) {
    return value == null || value === '' ? null : validPrice(value);
  }

  function priceStatus(track) {
    const latest = track?.latest;
    const price = validPrice(latest?.price);
    if (!latest || price == null) return { code: 'none', label: 'Geen actuele aanbieding', icon: '○' };
    const manualFloor = manualPrice(track.manualFloor);
    const manualGood = manualPrice(track.manualGood);
    if (!isReliableObservation(latest)) {
      if (manualFloor != null && price <= manualFloor + 0.001) return { code: 'floor', label: 'Bodemprijs', icon: '🔥', floor: manualFloor, good: manualGood };
      if (manualGood != null && price <= manualGood + 0.001) return { code: 'good', label: 'Goede prijs', icon: '🟢', floor: manualFloor, good: manualGood };
      return { code: 'unverified', label: 'Match controleren', icon: '⚪' };
    }
    const learned = learnedThresholds(track);
    const floor = manualFloor ?? learned.floor;
    const good = manualGood ?? learned.good;
    if (floor != null && price <= floor + 0.001) return { code: 'floor', label: 'Bodemprijs', icon: '🔥', floor, good };
    if (good != null && price <= good + 0.001) return { code: 'good', label: 'Goede prijs', icon: '🟢', floor, good };
    return { code: 'deal', label: 'Aanbieding', icon: '🟡', floor, good };
  }

  function isReliableSearchResponse(payload) {
    return payload?.approximate === false
      && Array.isArray(payload.unmatched_terms)
      && payload.unmatched_terms.length === 0;
  }

  function normalizeProviderProduct(product, response) {
    return {
      productId: clean(product?.product_id ?? product?.id),
      baseProductId: clean(product?.base_product_id),
      name: clean(product?.name),
      brand: clean(product?.brand),
      retailer: clean(product?.retailer),
      price: validPrice(product?.price),
      originalPrice: validPrice(product?.original_price),
      savingsPercentage: validPrice(product?.savings_percentage),
      ean: clean(product?.ean),
      packaging: clean(product?.quantity),
      quantity: clean(product?.quantity),
      unitPriceValue: validPrice(product?.unit_price),
      unitPriceUnit: clean(product?.unit),
      source: 'PrijsProfeet',
      matchReliable: isReliableSearchResponse(response)
    };
  }

  function observationDate(value) {
    const date = clean(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
  }

  function createObservation(result, observedAt = new Date().toISOString()) {
    const price = validPrice(result?.price);
    if (price == null) return null;
    const date = observationDate(result.checkedAt) || observationDate(observedAt) || new Date().toISOString().slice(0, 10);
    return {
      date,
      validFrom: observationDate(result.validFrom),
      validUntil: observationDate(result.validUntil),
      price,
      source: clean(result.source),
      retailer: clean(result.retailer),
      name: clean(result.name),
      productId: clean(result.productId),
      baseProductId: clean(result.baseProductId),
      ean: clean(result.ean),
      packaging: clean(result.packaging ?? result.quantity ?? result.size),
      unitPriceValue: validPrice(result.unitPriceValue),
      unitPriceUnit: clean(result.unitPriceUnit ?? result.unit),
      matchReliable: result.matchReliable === true
    };
  }

  return {
    validPrice,
    isReliableObservation,
    sameProductAndPackage,
    learnedThresholds,
    priceStatus,
    isReliableSearchResponse,
    normalizeProviderProduct,
    createObservation
  };
});
