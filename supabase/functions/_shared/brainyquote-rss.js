(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SamenThuisBrainyQuoteEdge = api;
})(globalThis, function () {
  'use strict';

  const FEED_URL = 'https://www.brainyquote.com/link/quotebr.rss';
  const MAX_FEED_BYTES = 32 * 1024;

  async function responseText(response, maxBytes) {
    if (!response || !response.ok) throw new Error(`BrainyQuote-feed gaf HTTP ${response?.status || 0}.`);
    const declaredLength = Number(response.headers?.get?.('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('BrainyQuote-feed is te groot.');
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('BrainyQuote-feed is te groot.');
      return text;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('BrainyQuote-feed is te groot.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }

    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return new TextDecoder().decode(bytes);
  }

  async function fetchBrainyQuoteRSS(fetchImpl = globalThis.fetch, timeoutMs = 10000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(FEED_URL, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9' },
        ...(controller ? { signal: controller.signal } : {})
      });
      const type = response?.headers?.get?.('content-type') || '';
      if (type && !/xml|rss/i.test(type)) throw new Error('BrainyQuote-feed heeft geen XML-contenttype.');
      return await responseText(response, MAX_FEED_BYTES);
    } finally { if (timer) clearTimeout(timer); }
  }

  return { FEED_URL, MAX_FEED_BYTES, fetchBrainyQuoteRSS };
});
