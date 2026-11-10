(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisBrainyQuote = core;
})(globalThis, function () {
  'use strict';

  const FEED_URL = 'https://www.brainyquote.com/link/quotebr.rss';
  const CACHE_KEY = 'samenThuisQuoteCacheV1';
  const MAX_FEED_BYTES = 32 * 1024;
  const MAX_QUOTE_LENGTH = 500;
  const MAX_AUTHOR_LENGTH = 120;
  const RETRY_AFTER_MS = 60 * 60 * 1000;

  function cleanText(value, maxLength) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function htmlText(value, Parser) {
    if (!value) return '';
    const doc = new Parser().parseFromString(String(value), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,template').forEach(node => node.remove());
    return cleanText(doc.body?.textContent || '', MAX_QUOTE_LENGTH + MAX_AUTHOR_LENGTH);
  }

  function parseFeed(xml, Parser = globalThis.DOMParser) {
    if (typeof xml !== 'string' || !xml.trim() || xml.length > MAX_FEED_BYTES) throw new Error('BrainyQuote-feed is leeg of te groot.');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('BrainyQuote-feed bevat niet-toegestane XML-declaraties.');
    if (typeof Parser !== 'function') throw new Error('Veilige XML-parser niet beschikbaar.');
    const doc = new Parser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('BrainyQuote-feed bevat ongeldige XML.');
    const item = doc.querySelector('rss > channel > item') || doc.querySelector('channel > item') || doc.querySelector('item');
    if (!item) throw new Error('BrainyQuote-feed bevat geen citaat.');

    const title = cleanText(item.querySelector('title')?.textContent, MAX_QUOTE_LENGTH + 40);
    const description = htmlText(item.querySelector('description')?.textContent, Parser);
    const genericTitle = /^(today'?s )?quote/i.test(title);
    const quote = cleanText(genericTitle || !title ? description : title, MAX_QUOTE_LENGTH);
    const author = genericTitle || !description || description === title ? '' : cleanText(description, MAX_AUTHOR_LENGTH);
    if (quote.length < 4) throw new Error('BrainyQuote-feed bevat geen geldig citaat.');
    return { quote, author };
  }

  function readCache(storage, Parser) {
    let value;
    try { value = JSON.parse(storage?.getItem(CACHE_KEY) || 'null'); } catch (_) { return null; }
    if (!value || typeof value !== 'object') return null;

    let quote = cleanText(value.quote, MAX_QUOTE_LENGTH);
    let author = cleanText(value.author, MAX_AUTHOR_LENGTH);
    if (!quote && typeof value.markup === 'string') {
      try {
        const doc = new Parser().parseFromString(value.markup, 'text/html');
        doc.querySelectorAll('script,style,iframe,object,embed,template').forEach(node => node.remove());
        quote = cleanText(doc.querySelector('blockquote')?.textContent, MAX_QUOTE_LENGTH);
        author = cleanText(doc.querySelector('blockquote')?.nextElementSibling?.textContent, MAX_AUTHOR_LENGTH);
      } catch (_) { return null; }
    }
    if (quote.length < 4) return null;
    return {
      quote,
      author,
      date: /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : '',
      checkedDate: /^\d{4}-\d{2}-\d{2}$/.test(value.checkedDate) ? value.checkedDate
        : /^\d{4}-\d{2}-\d{2}/.test(value.checkedAt || '') ? value.checkedAt.slice(0, 10) : '',
      checkedAt: Number.isFinite(Date.parse(value.checkedAt)) ? new Date(value.checkedAt).toISOString() : ''
    };
  }

  async function responseText(response, maxBytes = MAX_FEED_BYTES) {
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

  async function fetchFeed(fetchImpl = globalThis.fetch, timeoutMs = 10000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(FEED_URL, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9' },
        ...(controller ? { signal: controller.signal } : {})
      });
      return await responseText(response);
    } finally { if (timer) clearTimeout(timer); }
  }

  function createClient({
    fetchImpl = globalThis.fetch,
    fallbackFetchImpl = null,
    storage = null,
    Parser = globalThis.DOMParser,
    now = () => Date.now(),
    today = () => new Date(now()).toISOString().slice(0, 10),
    isOnline = () => globalThis.navigator?.onLine !== false
  } = {}) {
    let inFlight = null;
    let memoryCache = null;
    const getCache = () => readCache(storage, Parser) || memoryCache;
    const saveCache = value => {
      memoryCache = value;
      try { storage?.setItem(CACHE_KEY, JSON.stringify(value)); } catch (_) { /* geheugen blijft beschikbaar */ }
    };
    const current = () => {
      const cached = getCache();
      return cached && typeof cached.quote === 'string' && cached.quote.length >= 4 ? cached : null;
    };

    async function refresh() {
      if (inFlight) return inFlight;
      const date = today();
      const cached = getCache();
      if (current()?.date === date) return { status: 'checked-today', quote: cached };
      // Een mislukte poging wordt pas na een uur herhaald; een succesvolle quote geldt de hele dag.
      const lastAttempt = cached?.checkedDate === date ? Date.parse(cached.checkedAt) : NaN;
      if (Number.isFinite(lastAttempt) && now() - lastAttempt < RETRY_AFTER_MS) return { status: 'retry-later', quote: current() };
      if (!isOnline()) return { status: 'offline', quote: current() };

      const checkedAt = new Date(now()).toISOString();
      const attempted = { ...(cached || {}), checkedDate: date, checkedAt };
      saveCache(attempted);
      inFlight = (async () => {
        let lastError;
        try {
          const feed = await fetchFeed(fetchImpl);
          const quote = parseFeed(feed, Parser);
          const result = { ...quote, date, checkedDate: date, checkedAt };
          saveCache(result);
          return { status: 'updated', quote: result };
        } catch (error) {
          lastError = error;
        }
        if (typeof fallbackFetchImpl === 'function') {
          try {
            const feed = await fallbackFetchImpl();
            if (typeof feed === 'string') {
              const quote = parseFeed(feed, Parser);
              const result = { ...quote, date, checkedDate: date, checkedAt };
              saveCache(result);
              return { status: 'updated', quote: result, viaFallback: true };
            }
          } catch (error) { lastError = error; }
        }
        throw lastError;
      })();
      try { return await inFlight; } finally { inFlight = null; }
    }

    return { current, refresh };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  return { FEED_URL, CACHE_KEY, MAX_FEED_BYTES, parseFeed, readCache, responseText, fetchFeed, createClient, escapeHtml };
});
