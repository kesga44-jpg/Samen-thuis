import { fetchQuoteFeed } from './api.js';
import { renderError } from './rendering.js';
import { escapeHtml as esc, todayKey } from './utils.js';
import { getState } from './store.js';

const QUOTE_KEY = 'samenThuisV2-quote';
const QUOTE_RSS = 'https://www.brainyquote.com/link/quotebr.rss';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Quote ---------- */
export function readCachedQuote() {
  try {
    const c = JSON.parse(localStorage.getItem(QUOTE_KEY) || 'null');
    if (!c || typeof c.markup !== 'string') return null;
    const parsed = new DOMParser().parseFromString(c.markup, 'text/html');
    const text = parsed.querySelector('blockquote')?.textContent?.trim();
    const author = parsed.querySelector('blockquote + p')?.textContent?.replace(/^—\s*/, '').trim() || '';
    return text ? { date: typeof c.date === 'string' ? c.date : '', markup: quoteMarkup(text.slice(0, 500), author.slice(0, 100)) } : null;
  }
  catch { return null; }
}
function quoteMarkup(text, author = '') {
  return `<blockquote>${esc(text)}</blockquote>${author ? `<p class="muted">— ${esc(author)}</p>` : ''}`;
}
export function quoteBodyMarkup() {
  const c = readCachedQuote();
  if (!c) return renderError('De quote van vandaag is nu niet beschikbaar.', 'quote');
  const stale = c.date !== todayKey();
  return `<div class="quote-content">${c.markup}</div>${stale ? renderError('De laatst opgeslagen quote wordt getoond.', 'quote') : ''}`;
}
export function renderQuote() {
  if (!getState().showQuote) return '';
  return `<section class="panel quote-panel"><div class="panel-heading"><div><p class="eyebrow">Dagelijkse inspiratie</p><h2>Quote van de dag</h2></div><span class="panel-icon">✦</span></div><div id="quoteBody">${quoteBodyMarkup()}</div><p class="small-note"><a href="${QUOTE_RSS}" target="_blank" rel="noopener">Bron: BrainyQuote RSS</a></p></section>`;
}
function parseQuoteFromDom() {
  const src = $('#brainyQuoteSource');
  if (!src) return null;
  const clone = src.cloneNode(true);
  $$('script,a', clone).forEach(n => n.remove());
  const text = clone.textContent.replace(/\s+/g, ' ').trim();
  return text.length > 12 ? { text, author: '' } : null;
}
let quoteBusy = false;
export async function captureBrainyQuote() {
  const cached = readCachedQuote();
  if ((cached && cached.date === todayKey()) || quoteBusy) return !!cached;
  quoteBusy = true;
  try {
    let q = null;
    try {
      if (navigator.onLine) q = await fetchQuoteFeed(QUOTE_RSS);
    } catch (err) { console.warn('Quote ophalen via RSS mislukt', err); }
    if (!q) q = parseQuoteFromDom();
    if (!q || !q.text) {
      const box = $('#quoteBody');
      if (box) box.innerHTML = quoteBodyMarkup();
      return !!cached;
    }
    try { localStorage.setItem(QUOTE_KEY, JSON.stringify({ date: todayKey(), markup: quoteMarkup(q.text, q.author) })); }
    catch (err) { console.warn('Quote cache niet beschikbaar', err); }
    const box = $('#quoteBody');
    if (box) box.innerHTML = quoteBodyMarkup();
    return true;
  } finally { quoteBusy = false; }
}
