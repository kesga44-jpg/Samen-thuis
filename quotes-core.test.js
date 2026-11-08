const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./quotes-core.js');

test('quote feed refreshes on first load and no more than daily afterward', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(Q.shouldRefresh('', now), true);
  assert.equal(Q.shouldRefresh('not-a-date', now), true);
  assert.equal(Q.shouldRefresh('2026-10-11T11:59:59Z', now), true);
  assert.equal(Q.shouldRefresh('2026-10-11T12:00:01Z', now), false);
  assert.equal(Q.shouldRefresh('2026-10-13T12:00:00Z', now), true);
});

test('lokale gedachte van de dag: deterministisch per datum, altijd tekst, ook bij ongeldige datum (R4-vervanging)', () => {
  const a = Q.localQuoteFor('2026-11-08');
  assert.equal(a.text, Q.localQuoteFor('2026-11-08').text);
  assert.notEqual(a.text, Q.localQuoteFor('2026-11-09').text);
  assert.ok(Q.LOCAL_QUOTES.includes(a.text));
  assert.equal(a.source, 'Samen Thuis');
  assert.ok(Q.localQuoteFor('onzin').text.length > 10);
  assert.equal(new Set(Q.LOCAL_QUOTES).size, Q.LOCAL_QUOTES.length, 'geen dubbele teksten');
});

test('renderQuote toont een lokale gedachte zonder netwerk en verwijst niet meer naar het externe script', () => {
  const src = require('node:fs').readFileSync(__dirname + '/app.js', 'utf8');
  const body = src.slice(src.indexOf('function renderQuote()'), src.indexOf('function tripFolderById'));
  assert.match(body, /localQuoteFor\(todayISO\(\)\)/);
  assert.match(body, /esc\(local\.text\)/);
});

test('index.html laadt geen extern script meer (R4: BrainyQuote-script verwijderd)', () => {
  const html = require('node:fs').readFileSync(__dirname + '/index.html', 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /brainyquote\.com\/link\/quotebr\.js|brainyQuoteSource/);
});
