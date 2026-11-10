const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const RSS = require('./brainyquote-rss-core.js');
const RSS_EDGE = require('./supabase/functions/_shared/brainyquote-rss.js');

const xml = `<rss version="2.0"><channel><item>
  <title>Stay curious &amp; kind.</title>
  <description><![CDATA[<p>Jane Doe</p><script>window.quoteXss = true</script>]]></description>
</item></channel></rss>`;

function decodeXml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

class FixtureParser {
  parseFromString(source, type) {
    if (type === 'application/xml') {
      const itemMatch = /<item>([\s\S]*?)<\/item>/i.exec(source);
      const itemBody = itemMatch?.[1] || '';
      const field = name => {
        const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(itemBody);
        return match ? decodeXml(match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')) : '';
      };
      return {
        querySelector(selector) {
          if (selector === 'parsererror') return /<rss[^>]*>[\s\S]*<\/rss>/i.test(source) ? null : {};
          if (!itemMatch) return null;
          return {
            querySelector(name) { return { textContent: field(name) }; }
          };
        }
      };
    }

    let html = String(source);
    const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)];
    return {
      querySelectorAll(selector) {
        return selector.includes('script') ? scripts.map(() => ({ remove() { html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/i, ''); } })) : [];
      },
      get body() {
        return { get textContent() { return decodeXml(html.replace(/<[^>]*>/g, ' ')); } };
      },
      querySelector(selector) {
        if (selector === 'p') {
          const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
          return paragraph ? { textContent: decodeXml(paragraph[1].replace(/<[^>]*>/g, ' ')) } : null;
        }
        if (selector !== 'blockquote') return null;
        const match = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i.exec(html);
        const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
        return match ? {
          textContent: decodeXml(match[1].replace(/<[^>]*>/g, ' ')),
          nextElementSibling: paragraph ? { textContent: decodeXml(paragraph[1].replace(/<[^>]*>/g, ' ')) } : null
        } : null;
      }
    };
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    raw: key => values.get(key)
  };
}

test('parses valid RSS as plain quote and author text, stripping markup and script content', () => {
  assert.deepEqual(RSS.parseFeed(xml, FixtureParser), { quote: 'Stay curious & kind.', author: 'Jane Doe' });
});

test('rejects malformed XML, empty feeds, missing quotes, and oversized input', () => {
  assert.throws(() => RSS.parseFeed('<rss><broken', FixtureParser), /ongeldige XML/);
  assert.throws(() => RSS.parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]><rss></rss>', FixtureParser), /niet-toegestane XML-declaraties/);
  assert.throws(() => RSS.parseFeed('<rss><channel></channel></rss>', FixtureParser), /geen citaat/);
  assert.throws(() => RSS.parseFeed('<rss><channel><item><title>Quote of the Day</title></item></channel></rss>', FixtureParser), /geen geldig citaat/);
  assert.throws(() => RSS.parseFeed('x'.repeat(RSS.MAX_FEED_BYTES + 1), FixtureParser), /leeg of te groot/);
});

test('renders quote and author as escaped text, never trusted HTML', () => {
  assert.equal(RSS.escapeHtml('<img src=x onerror=alert(1)> & "quote"'), '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot;');
});

test('retries through the authenticated existing Edge Function after direct fetch fails', async () => {
  const storage = memoryStorage();
  const client = RSS.createClient({
    fetchImpl: async () => { throw new TypeError('CORS/network failure'); },
    fallbackFetchImpl: async () => xml,
    storage,
    Parser: FixtureParser,
    today: () => '2026-11-10',
    now: () => Date.parse('2026-11-10T09:00:00Z')
  });
  const result = await client.refresh();
  assert.equal(result.status, 'updated');
  assert.equal(result.viaFallback, true);
  assert.deepEqual(client.current(), {
    quote: 'Stay curious & kind.', author: 'Jane Doe', date: '2026-11-10', checkedDate: '2026-11-10', checkedAt: '2026-11-10T09:00:00.000Z'
  });
  assert.equal(JSON.parse(storage.raw(RSS.CACHE_KEY)).markup, undefined);
});

test('retains the last successful quote after a network failure and does not retry that day', async () => {
  const storage = memoryStorage({
    [RSS.CACHE_KEY]: JSON.stringify({
      quote: 'Stay curious & kind.', author: 'Jane Doe', date: '2026-11-09',
      checkedDate: '2026-11-09', checkedAt: '2026-11-09T09:00:00.000Z'
    })
  });
  let requests = 0;
  const client = RSS.createClient({
    fetchImpl: async () => { requests++; throw new TypeError('offline'); },
    storage,
    Parser: FixtureParser,
    today: () => '2026-11-10',
    now: () => Date.parse('2026-11-10T09:00:00Z')
  });
  await assert.rejects(client.refresh(), /offline/);
  assert.deepEqual(client.current(), {
    quote: 'Stay curious & kind.', author: 'Jane Doe', date: '2026-11-09', checkedDate: '2026-11-10', checkedAt: '2026-11-10T09:00:00.000Z'
  });
  assert.equal((await client.refresh()).status, 'retry-later');
  assert.equal(requests, 1);
});

test('does not expose an empty attempted cache when the first daily fetch fails', async () => {
  const storage = memoryStorage();
  const client = RSS.createClient({
    fetchImpl: async () => { throw new TypeError('offline'); },
    storage,
    Parser: FixtureParser,
    today: () => '2026-11-10',
    now: () => Date.parse('2026-11-10T09:00:00Z')
  });
  await assert.rejects(client.refresh(), /offline/);
  assert.equal(client.current(), null);
  assert.equal((await client.refresh()).status, 'retry-later');
});

test('an offline start does not consume the daily attempt and refreshes once the network returns', async () => {
  const storage = memoryStorage();
  let online = false, requests = 0;
  const client = RSS.createClient({
    fetchImpl: async () => { requests++; return new Response(xml, { headers: { 'content-type': 'application/rss+xml' } }); },
    storage, Parser: FixtureParser, isOnline: () => online,
    today: () => '2026-11-10', now: () => Date.parse('2026-11-10T09:00:00Z')
  });
  assert.equal((await client.refresh()).status, 'offline');
  assert.equal(requests, 0);
  assert.equal(storage.raw(RSS.CACHE_KEY), undefined);
  online = true;
  assert.equal((await client.refresh()).status, 'updated');
  assert.equal(requests, 1);
});

test('a failed attempt is retried after the cooldown, but a successful quote is kept for the whole day', async () => {
  const storage = memoryStorage();
  let time = Date.parse('2026-11-10T09:00:00Z'), fail = true, requests = 0;
  const client = RSS.createClient({
    fetchImpl: async () => {
      requests++;
      if (fail) throw new TypeError('offline');
      return new Response(xml, { headers: { 'content-type': 'application/rss+xml' } });
    },
    storage, Parser: FixtureParser, isOnline: () => true,
    today: () => new Date(time).toISOString().slice(0, 10), now: () => time
  });
  await assert.rejects(client.refresh(), /offline/);
  time += 30 * 60 * 1000; fail = false;
  assert.equal((await client.refresh()).status, 'retry-later');
  time += 31 * 60 * 1000;
  assert.equal((await client.refresh()).status, 'updated');
  time += 5 * 60 * 60 * 1000;
  assert.equal((await client.refresh()).status, 'checked-today');
  assert.equal(requests, 2);
});

test('a generic title such as "Quote of the Day: Name" is not shown as the quote', () => {
  const generic = '<rss version="2.0"><channel><item><title>Quote of the Day: Gandhi</title><description>Be the change you wish to see.</description></item></channel></rss>';
  assert.deepEqual(RSS.parseFeed(generic, FixtureParser), { quote: 'Be the change you wish to see.', author: '' });
});

test('uses the browser direct fetch once a day, deduplicates concurrent calls, then refreshes on the next date', async () => {
  const storage = memoryStorage();
  let requests = 0, date = '2026-11-10';
  let release;
  const client = RSS.createClient({
    fetchImpl: async () => {
      requests++;
      await new Promise(resolve => { release = resolve; });
      return new Response(xml, { headers: { 'content-type': 'application/rss+xml' } });
    },
    storage, Parser: FixtureParser, today: () => date,
    now: () => Date.parse(`${date}T09:00:00Z`)
  });
  const first = client.refresh(), second = client.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  release();
  await Promise.all([first, second]);
  assert.equal((await client.refresh()).status, 'checked-today');
  date = '2026-11-11';
  const next = client.refresh();
  await new Promise(resolve => setImmediate(resolve));
  release();
  assert.equal((await next).status, 'updated');
  assert.equal(requests, 2);
});

test('keeps the previous RSS cache readable without trusting its stored markup', () => {
  const storage = memoryStorage({
    [RSS.CACHE_KEY]: JSON.stringify({
      date: '2026-11-09',
      markup: '<blockquote>Safe quote</blockquote><p>Author</p><script>alert(1)</script>'
    })
  });
  assert.equal(RSS.readCache(storage, FixtureParser).quote, 'Safe quote');
  assert.equal(RSS.readCache(storage, FixtureParser).author, 'Author');
});

test('bounds and validates the Edge Function BrainyQuote request to the fixed RSS origin', async () => {
  let requested;
  const result = await RSS_EDGE.fetchBrainyQuoteRSS(async (url, options) => {
    requested = { url, options };
    return new Response(xml, { headers: { 'content-type': 'application/rss+xml' } });
  });
  assert.equal(result, xml);
  assert.equal(requested.url, RSS_EDGE.FEED_URL);
  assert.equal(requested.options.credentials, 'omit');
  await assert.rejects(RSS_EDGE.fetchBrainyQuoteRSS(async () =>
    new Response('not rss', { headers: { 'content-type': 'text/html' } })
  ), /geen XML-contenttype/);
  await assert.rejects(RSS_EDGE.fetchBrainyQuoteRSS(async () =>
    new Response('x'.repeat(RSS_EDGE.MAX_FEED_BYTES + 1), { headers: { 'content-type': 'application/xml' } })
  ), /te groot/);
});

test('production entrypoint loads and invokes RSS safely; Edge route remains behind the shared JWT guard', () => {
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const edge = fs.readFileSync(__dirname + '/supabase/functions/data-sources/index.ts', 'utf8');
  assert.match(html, /brainyquote-rss-core\.js/);
  assert.match(app, /refreshBrainyQuoteRSS\(\);/);
  assert.match(app, /brainyQuoteRSS\.escapeHtml\(cached\.quote\)/);
  assert.doesNotMatch(app, /brainyQuoteSource|captureBrainyQuote/);
  assert.match(edge, /await guard\(req/);
  assert.match(edge, /b\.action==="brainyquote"/);
  assert.match(edge, /fetchBrainyQuoteRSS\(\)/);
});
