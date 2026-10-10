import { fetchQuoteFeed, fetchWeatherForecast, isWeatherForecast } from './api.js';
import { bindHandlers } from './handlers.js';
import { renderCollection, renderError } from './rendering.js';
import { defaultState, loadState, mergeState, normalizeDashboard, persistState } from './state.js';
import { escapeHtml as esc, todayKey, uid } from './utils.js';

const QUOTE_KEY = 'samenThuisV2-quote';
const WEATHER_KEY = 'samenThuisV2-weather';
const SYNC_KEY = 'samenThuisV2-sync';
const QUOTE_RSS = 'https://www.brainyquote.com/link/quotebr.rss';
const Core = globalThis.SamenThuisCore;
const DEVICE_KEYS = ['currentPage', 'theme', 'appearance', 'minimalColor', 'weather', 'showQuote', 'dashboard'];
const DASH_WIDGETS = {
  tasks: 'Open taken', quote: 'Quote van de dag', question: 'Vraag van de dag', weather: 'Weer', agenda: 'Agenda', groceries: 'Boodschappen', challenges: 'Challenges'
};
const PEOPLE = ['Kees', 'Daphne', 'Samen'];
const PAGES = {
  today: 'Vandaag', weather: 'Weer', tasks: 'Taken', agenda: 'Agenda', challenges: 'Challenges', programs: "Programma's",
  mealplan: 'Weekmenu', groceries: 'Boodschappen', deals: 'Acties & aanbiedingen', stock: 'Voorraad',
  home: 'Woning', car: 'Auto', budget: 'Budget', dates: 'Date ideeën', travel: 'Reizen', extras: 'Extra', settings: 'Instellingen'
};
const person = { name: 'person', label: 'Voor wie', type: 'select', options: PEOPLE };
const SECTIONS = {
  tasks: { label: 'Taak', empty: 'Nog geen taken.', fields: [{ name: 'text', label: 'Taak', required: true }, person, { name: 'category', label: 'Categorie', value: 'Huishouden' }, { name: 'due', label: 'Deadline', type: 'date' }], title: i => i.text, meta: i => [i.person, i.category, i.due].filter(Boolean).join(' · '), check: true },
  agenda: { label: 'Afspraak', empty: 'Geen afspraken.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'date', label: 'Datum', type: 'date' }, person], title: i => i.title, meta: i => [i.date, i.person].filter(Boolean).join(' · ') },
  challenges: { label: 'Challenge', empty: 'Geen challenges.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'category', label: 'Categorie' }], title: i => i.title, meta: i => i.category || '', check: true },
  programs: { label: 'Programma', empty: 'Geen programma’s.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'notes', label: 'Notities' }], title: i => i.title, meta: i => i.notes || '' },
  mealplan: { key: 'meals', label: 'Maaltijd', empty: 'Plan je week.', fields: [{ name: 'name', label: 'Maaltijd', required: true }, { name: 'date', label: 'Datum', type: 'date' }], title: i => i.name, meta: i => i.date || '' },
  groceries: { label: 'Product', empty: 'Boodschappenlijst is leeg.', fields: [{ name: 'name', label: 'Product', required: true }, { name: 'quantity', label: 'Aantal' }], title: i => i.name, meta: i => i.quantity || '', check: true },
  deals: { label: 'Aanbieding', empty: 'Geen aanbiedingen.', fields: [{ name: 'title', label: 'Aanbieding', required: true }, { name: 'store', label: 'Winkel' }], title: i => i.title, meta: i => i.store || '' },
  stock: { label: 'Voorraad', empty: 'Geen voorraad.', fields: [{ name: 'name', label: 'Product', required: true }, { name: 'quantity', label: 'Aantal' }], title: i => i.name, meta: i => i.quantity || '' },
  home: { label: 'Woning', empty: 'Niets genoteerd.', fields: [{ name: 'title', label: 'Klus of notitie', required: true }, { name: 'notes', label: 'Details' }], title: i => i.title, meta: i => i.notes || '', check: true },
  dates: { label: 'Date idee', empty: 'Nog geen ideeën.', fields: [{ name: 'title', label: 'Idee', required: true }, { name: 'notes', label: 'Details' }], title: i => i.title, meta: i => i.notes || '' },
  travel: { label: 'Reis', empty: 'Nog geen reizen.', fields: [{ name: 'title', label: 'Bestemming', required: true }, { name: 'date', label: 'Datum', type: 'date' }], title: i => i.title, meta: i => i.date || '' },
  extras: { label: 'Extra', empty: 'Niets toegevoegd.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'notes', label: 'Details' }], title: i => i.title, meta: i => i.notes || '' }
};
const listOf = (page, st = state) => st[SECTIONS[page].key || page];
const CAR_FIELDS = [['model', 'Model'], ['plate', 'Kenteken'], ['year', 'Bouwjaar'], ['mileage', 'Kilometerstand'], ['apkDate', 'APK-datum', 'date'], ['insuranceDate', 'Verzekering tot', 'date']];

const $ = (s, r = document) => r.querySelector(s);
const refCache = {};
const $$cached = id => { const el = refCache[id]; if (el && el.isConnected) return el; return (refCache[id] = document.querySelector(id)); };
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let state = loadState();

let toastTimer;
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}
function saveState(message = '', { touch = true, sync = true } = {}) {
  try {
    if (touch) state.meta.updatedAt = new Date().toISOString();
    persistState(state);
    const s = $('#saveState'); if (s) s.textContent = 'Lokaal bewaard';
    if (message) toast(message);
    if (sync) scheduleSync();
    return true;
  } catch { toast('Opslag niet beschikbaar'); return false; }
}

/* ---------- Quote ---------- */
function readCachedQuote() {
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
function quoteBodyMarkup() {
  const c = readCachedQuote();
  if (!c) return renderError('De quote van vandaag is nu niet beschikbaar.', 'quote');
  const stale = c.date !== todayKey();
  return `<div class="quote-content">${c.markup}</div>${stale ? renderError('De laatst opgeslagen quote wordt getoond.', 'quote') : ''}`;
}
function renderQuote() {
  if (!state.showQuote) return '';
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
async function captureBrainyQuote() {
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

/* ---------- Weer ---------- */
const WEATHER_CODES = { 0: 'Helder', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Rijpmist', 51: 'Lichte motregen', 53: 'Motregen', 55: 'Zware motregen', 61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien', 95: 'Onweer', 96: 'Onweer met hagel', 99: 'Zwaar onweer met hagel' };
const weatherLabel = c => WEATHER_CODES[c] || 'Onbekend';
function weatherUrl() {
  const w = state.weather;
  return `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(w.lat)}&longitude=${encodeURIComponent(w.lon)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&hourly=temperature_2m,precipitation&timezone=auto&forecast_days=7`;
}
function weatherChart({ labels, temps, rain, title, tempLabel, rainLabel, tempLow }) {
  const n = labels.length;
  if (n < 2) return '';
  const W = 640, H = 300, L = 40, R = 40, T = 24, B = 40, iw = W - L - R, ih = H - T - B;
  const all = temps.concat(tempLow || []).filter(Number.isFinite);
  if (!all.length) return '';
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
  const rMax = Math.max(1, ...rain.map(v => Number(v) || 0));
  const x = i => L + (iw * (i + .5)) / n;
  const yT = v => T + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const yR = v => T + ih - ((Number(v) || 0) / rMax) * ih;
  const bw = Math.max(2, Math.min(28, (iw / n) * .6));
  const line = (arr, cls) => `<polyline class="${cls}" points="${arr.map((v, i) => `${x(i).toFixed(1)},${yT(v).toFixed(1)}`).join(' ')}"/>`;
  const step = Math.max(1, Math.ceil(n / 8));
  const bars = rain.map((v, i) => `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${yR(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(T + ih - yR(v)).toFixed(1)}" rx="2" fill="var(--blue)" opacity=".28"/>`).join('');
  const grid = [0, .5, 1].map(f => { const y = T + ih * f; return `<line class="weather-grid-line" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="weather-axis" x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(hi - (hi - lo) * f)}°</text><text class="weather-axis" x="${W - R + 6}" y="${y + 4}">${+(rMax * (1 - f)).toFixed(1)}</text>`; }).join('');
  const xl = labels.map((l, i) => i % step === 0 ? `<text class="weather-axis" x="${x(i).toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(l)}</text>` : '').join('');
  const dots = temps.length <= 8 ? temps.map((v, i) => `<circle class="weather-temp-dot" r="4" cx="${x(i).toFixed(1)}" cy="${yT(v).toFixed(1)}"/>`).join('') : '';
  return `<section class="panel weather-chart-panel"><div class="panel-heading"><div><p class="eyebrow">Temperatuur en neerslag</p><h3>${esc(title)}</h3></div></div>
    <div class="weather-svg-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${title}: ${tempLabel} en ${rainLabel}`)}">${grid}${bars}${tempLow ? line(tempLow, 'weather-min-line') : ''}${line(temps, 'weather-temp-line')}${dots}${xl}
    <text class="weather-legend" x="${L}" y="${H - 2}">— ${esc(tempLabel)} (°C)</text><text class="weather-legend" x="${W - R}" y="${H - 2}" text-anchor="end">▮ ${esc(rainLabel)}</text></svg></div></section>`;
}
function weatherCharts(d) {
  const day = d.daily, h = d.hourly;
  let out = weatherChart({
    title: 'Komende 7 dagen', tempLabel: 'max / min temperatuur', rainLabel: 'neerslag (mm)',
    labels: day.time.map(t => new Date(`${t}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short' })),
    temps: day.temperature_2m_max, tempLow: day.temperature_2m_min, rain: (day.precipitation_sum || day.time.map(() => 0))
  });
  if (h && Array.isArray(h.time) && h.time.length) {
    const now = Date.now();
    let start = h.time.findIndex(t => new Date(t).getTime() >= now - 3600e3);
    if (start < 0) start = 0;
    const idx = h.time.slice(start, start + 24).map((_, i) => start + i);
    out += weatherChart({
      title: 'Komende 24 uur (per uur)', tempLabel: 'temperatuur', rainLabel: 'neerslag (mm)',
      labels: idx.map(i => `${h.time[i].slice(11, 13)}u`), temps: idx.map(i => h.temperature_2m[i]), rain: idx.map(i => h.precipitation[i])
    });
  }
  return out;
}
function weatherMarkup(d) {
  const c = d.current, day = d.daily;
  const days = day.time.map((t, i) => `<li class="list-card"><div><strong>${esc(new Date(`${t}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }))}</strong><small>${esc(weatherLabel(day.weather_code[i]))} · ${Math.round(day.temperature_2m_min[i])}° – ${Math.round(day.temperature_2m_max[i])}° · neerslagkans ${day.precipitation_probability_max[i] ?? 0}%</small></div></li>`).join('');
  return `<p class="weather-now"><strong>${Math.round(c.temperature_2m)}°C</strong> ${esc(weatherLabel(c.weather_code))}</p>
    <p class="muted">Voelt als ${Math.round(c.apparent_temperature)}° · wind ${Math.round(c.wind_speed_10m)} km/u · luchtvochtigheid ${Math.round(c.relative_humidity_2m)}%</p>
    ${weatherCharts(d)}
    <ul class="data-list">${days}</ul>`;
}
async function loadWeather() {
  const box = $('#weatherBody');
  if (!box) return;
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null'); } catch { cache = null; }
  const key = `${state.weather.lat},${state.weather.lon}`;
  const hasCache = cache && cache.key === key && isWeatherForecast(cache.data);
  if (hasCache) box.innerHTML = weatherMarkup(cache.data);
  if (!navigator.onLine) {
    box.innerHTML = hasCache
      ? `${weatherMarkup(cache.data)}${renderError('Offline. De laatst opgeslagen verwachting wordt getoond.', 'weather')}`
      : renderError('Geen internetverbinding. Het weer wordt geladen zodra je weer online bent.', 'weather');
    return;
  }
  try {
    const data = await fetchWeatherForecast(weatherUrl());
    try { localStorage.setItem(WEATHER_KEY, JSON.stringify({ key, data })); } catch { /* cache niet beschikbaar */ }
    const target = $('#weatherBody');
    if (target) target.innerHTML = weatherMarkup(data);
  } catch (err) {
    console.warn('Weer laden mislukt', err);
    const target = $('#weatherBody');
    if (target) target.innerHTML = hasCache
      ? `${weatherMarkup(cache.data)}${renderError('De actuele verwachting kon niet worden opgehaald; de laatst opgeslagen gegevens worden getoond.', 'weather')}`
      : renderError('Het weer kan nu niet worden geladen. Controleer je verbinding; er wordt geen voorspelling verzonnen.', 'weather');
  }
}
function renderWeather() {
  const w = state.weather;
  return `<section class="panel weather-panel"><div class="panel-heading"><div><p class="eyebrow">${esc(w.place)}</p><h2>Weer</h2></div><span class="panel-icon">☀</span></div>
    <div id="weatherBody"><p class="muted">Weer laden…</p></div>
    <form class="inline-form" data-weather-form><input name="place" value="${esc(w.place)}" placeholder="Plaats" aria-label="Plaatsnaam" required><input name="lat" type="number" step="any" min="-90" max="90" value="${esc(w.lat)}" aria-label="Breedtegraad" required><input name="lon" type="number" step="any" min="-180" max="180" value="${esc(w.lon)}" aria-label="Lengtegraad" required><button class="button button-secondary">Locatie opslaan</button><button type="button" class="button button-secondary" data-weather-locate>Mijn locatie</button></form></section>`;
}

/* ---------- Synchronisatie (Supabase, optioneel) ---------- */
const MIN_CODE = 12;
function loadSyncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {};
    return { projectUrl: String(c.projectUrl || ''), anonKey: String(c.anonKey || ''), householdCode: String(c.householdCode || ''), lastSyncedAt: String(c.lastSyncedAt || '') };
  } catch { return { projectUrl: '', anonKey: '', householdCode: '', lastSyncedAt: '' }; }
}
let syncConfig = loadSyncConfig();
let syncing = false, syncError = '', syncTimer;
const validProjectUrl = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const syncConfigured = () => validProjectUrl(syncConfig.projectUrl) && !!syncConfig.anonKey && syncConfig.householdCode.length >= MIN_CODE;
function saveSyncConfig() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig)); } catch { toast('Opslag niet beschikbaar'); } }
function updateSyncBadge() {
  const b = $('#syncState');
  if (!b) return;
  b.textContent = !syncConfigured() ? 'Alleen dit apparaat' : !navigator.onLine ? 'Offline · later synchroniseren' : syncing ? 'Synchroniseren…' : syncError ? 'Sync controleren' : syncConfig.lastSyncedAt ? 'Apparaten gelijk' : 'Sync gereed';
  b.classList.toggle('connected', syncConfigured() && !syncing && !syncError);
}
const bytesToB64 = bytes => btoa(String.fromCharCode(...bytes));
const b64ToBytes = v => Uint8Array.from(atob(v), c => c.charCodeAt(0));
async function sha256(v) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function deriveKey(code, salt) {
  const m = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 }, m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptData(value, code) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(code, salt), new TextEncoder().encode(JSON.stringify(value)));
  return { version: 1, salt: bytesToB64(salt), iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(enc)) };
}
async function decryptData(p, code) {
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(p.iv) }, await deriveKey(code, b64ToBytes(p.salt)), b64ToBytes(p.ciphertext));
  return JSON.parse(new TextDecoder().decode(dec));
}
function supabaseHeaders() {
  const h = { apikey: syncConfig.anonKey, 'Content-Type': 'application/json' };
  if (!syncConfig.anonKey.startsWith('sb_publishable_')) h.Authorization = 'Bearer ' + syncConfig.anonKey;
  return h;
}
const syncPayload = st => { const o = { ...st }; DEVICE_KEYS.forEach(k => delete o[k]); return o; };
async function syncNow({ manual = false } = {}) {
  if (!syncConfigured() || syncing || !navigator.onLine) {
    if (manual) toast(!navigator.onLine ? 'Geen internetverbinding' : 'Vul eerst de synchronisatie-instellingen in');
    return;
  }
  syncing = true; syncError = ''; updateSyncBadge();
  try {
    if (!(window.crypto && crypto.subtle)) throw new Error('Versleuteling vereist HTTPS');
    const id = await sha256(syncConfig.householdCode);
    const base = syncConfig.projectUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/rest/v1/household_data?id=eq.${id}&select=payload,updated_at`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase gaf ${res.status}`);
    const rows = await res.json();
    const remote = rows[0]?.payload ? await decryptData(rows[0].payload, syncConfig.householdCode) : null;
    const localUpdated = state.meta.updatedAt, remoteUpdated = remote?.meta?.updatedAt || rows[0]?.updated_at || '';
    const first = !syncConfig.lastSyncedAt;
    const remoteNewer = remote && Date.parse(remoteUpdated) > (Date.parse(localUpdated) || 0);
    const local = syncPayload(state);
    if (remote && Core.hasConcurrentChanges(localUpdated, remoteUpdated, syncConfig.lastSyncedAt, local, syncPayload(mergeState(defaultState(), remote)))) toast('Op beide apparaten is gewijzigd; de nieuwste versie wordt gebruikt');
    if (remote && (first || remoteNewer)) {
      const device = Object.fromEntries(DEVICE_KEYS.map(k => [k, state[k]]));
      state = { ...mergeState(defaultState(), remote), ...device };
      saveState('', { touch: false, sync: false });
      renderPage(state.currentPage);
    } else if (!remote || !Core.sameData(local, syncPayload(mergeState(defaultState(), remote)))) {
      const up = await fetch(`${base}/rest/v1/household_data?on_conflict=id`, {
        method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id, payload: await encryptData(local, syncConfig.householdCode), updated_at: localUpdated || new Date().toISOString() })
      });
      if (!up.ok) throw new Error(`Opslaan gaf ${up.status}`);
    }
    syncConfig.lastSyncedAt = new Date().toISOString();
    saveSyncConfig();
    if (manual) toast('Apparaten zijn bijgewerkt');
  } catch (err) {
    console.error('Synchronisatie mislukt', err);
    syncError = err.message || 'Synchronisatie mislukt';
    if (manual) toast('Synchronisatie lukt nog niet. Controleer de instellingen.');
  } finally { syncing = false; updateSyncBadge(); }
}
function scheduleSync() {
  if (!syncConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 1200);
}
function handleSyncForm(data) {
  const next = { projectUrl: String(data.projectUrl || '').trim(), anonKey: String(data.anonKey || '').trim(), householdCode: String(data.householdCode || '').trim() };
  if (next.projectUrl && !validProjectUrl(next.projectUrl)) return toast('Gebruik een https-projecturl');
  if (next.householdCode && next.householdCode.length < MIN_CODE) return toast(`Kies een huishoudcode van minimaal ${MIN_CODE} tekens`);
  const changed = ['projectUrl', 'anonKey', 'householdCode'].some(k => next[k] !== syncConfig[k]);
  syncConfig = { ...syncConfig, ...next, lastSyncedAt: changed ? '' : syncConfig.lastSyncedAt };
  syncError = '';
  saveSyncConfig();
  toast(syncConfigured() ? 'Synchronisatie opgeslagen' : 'Opgeslagen; vul alle velden in om te synchroniseren');
  renderPage('settings'); updateSyncBadge();
  if (syncConfigured()) syncNow({ manual: true });
}

/* ---------- Pagina's ---------- */
function itemMarkup(page, item) {
  const s = SECTIONS[page];
  const check = s.check ? `<input class="task-check" type="checkbox" data-toggle="${page}" data-id="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="Afronden">` : '';
  return `<li class="list-card task-row ${item.done ? 'is-done' : ''}">${check}<div><strong>${esc(s.title(item))}</strong><small>${esc(s.meta(item))}</small></div><button class="icon-button task-delete" data-delete="${page}" data-id="${esc(item.id)}" aria-label="Verwijderen">×</button></li>`;
}
function listMarkup(page, items = listOf(page)) {
  return `<ul class="data-list task-list">${renderCollection(items, i => itemMarkup(page, i), esc(SECTIONS[page].empty))}</ul>`;
}
function weatherSummary() {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null'); } catch { cache = null; }
  const c = cache && cache.key === `${state.weather.lat},${state.weather.lon}` && cache.data && cache.data.current;
  return c
    ? `<p class="weather-now"><strong>${Math.round(c.temperature_2m)}°C</strong> ${esc(weatherLabel(c.weather_code))}</p><p class="small-note">Zie de pagina Weer voor grafieken.</p>`
    : '<p class="quote-note muted">Open eenmaal de pagina Weer om het weer hier te tonen.</p>';
}
function renderToday() {
  const today = todayKey();
  const open = state.tasks.filter(t => !t.done);
  const date = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayMeals = state.meals.filter(item => item.date === today);
  const dinner = todayMeals.find(item => /avond|diner/i.test(item.slot || '')) || todayMeals[0];
  const todayChores = state.chores.filter(item => {
    const completed = Array.isArray(item.completedDates) && item.completedDates.includes(today);
    return !completed && (!item.due || item.due <= today);
  }).slice(0, 5);
  const todayEvents = state.agenda.filter(item => !item.date || item.date >= today).sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 5);
  const groceries = state.groceries.filter(item => !item.done).slice(0, 6);
  const card = (eyebrow, title, page, body, icon = '') => `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h2><a href="#/${page}" data-page="${page}">${esc(title)}</a></h2></div>${icon ? `<span class="panel-icon" aria-hidden="true">${icon}</span>` : ''}</div>${body}</section>`;
  const stats = `<section class="stats-row" aria-label="Overzicht vandaag">
    <a class="stat" href="#/tasks" data-page="tasks"><strong>${open.length}</strong><small>Open taken</small></a>
    <a class="stat" href="#/chores" data-page="chores"><strong>${todayChores.length}</strong><small>Huishouden</small></a>
    <a class="stat" href="#/groceries" data-page="groceries"><strong>${state.groceries.filter(i => !i.done).length}</strong><small>Boodschappen</small></a>
    <a class="stat" href="#/stock" data-page="stock"><strong>${state.stock.filter(i => Number(i.quantity) <= Number(i.min) && i.min !== '').length}</strong><small>Voorraad check</small></a>
  </section>`;
  const taskCard = `<section class="panel tasks-panel"><div class="panel-heading"><div><p class="eyebrow">${esc(date)}</p><h2>Open taken (${open.length})</h2></div></div>
    <form class="inline-form" data-quick-task><input name="text" placeholder="Nieuwe taak…" required maxlength="120" aria-label="Nieuwe taak"><button class="button button-primary">Toevoegen</button></form>
    ${listMarkup('tasks', open.slice(0, 5))}</section>`;
  const agendaBody = `<ul class="data-list">${todayEvents.map(item => `<li class="list-card"><div><strong>${esc(item.title)}</strong><small>${esc([item.date, item.time, item.person].filter(Boolean).join(' · '))}</small></div></li>`).join('') || '<li class="empty-row">Geen afspraken gepland.</li>'}</ul><p class="small-note"><a href="#/agenda" data-page="agenda">Open volledige agenda →</a></p>`;
  const weatherBody = `<div id="todayWeatherSummary">${weatherSummary()}</div><p class="small-note"><a href="#/weather" data-page="weather">Bekijk de volledige weersverwachting →</a></p>`;
  const mealBody = `<p class="weather-now"><strong>${esc(dinner?.name || 'Nog geen avondeten gepland')}</strong></p><p class="small-note"><a href="#/mealplan" data-page="mealplan">Bekijk weekmenu →</a></p>`;
  const groceryBody = `<ul class="data-list">${groceries.map(item => `<li class="list-card"><div><strong>${esc(item.name)}</strong><small>${esc([item.quantity, item.category].filter(Boolean).join(' · '))}</small></div></li>`).join('') || '<li class="empty-row">Geen boodschappen open.</li>'}</ul><p class="small-note"><a href="#/groceries" data-page="groceries">Open boodschappenlijst →</a></p>`;
  const choresBody = `<ul class="data-list">${todayChores.map(item => `<li class="list-card"><div><strong>${esc(item.title)}</strong><small>${esc([item.person, item.due, item.repeat].filter(Boolean).join(' · '))}</small></div></li>`).join('') || '<li class="empty-row">Geen huishoudelijke taken die vandaag aandacht vragen.</li>'}</ul><p class="small-note"><a href="#/home" data-page="home">Bekijk huishoudelijke taken →</a></p>`;
  const a = state.dailyAnswers[today] || {};
  const who = ['Kees', 'Daphne'].map(p => a[p] ? `<span class="tag">${p} heeft geantwoord ✓</span>` : `<button class="button button-secondary button-small" data-answer="${p}">${p} beantwoordt</button>`).join(' ');
  const questionCard = `<section class="panel question-panel"><div class="panel-heading"><div><p class="eyebrow">Even samen stilstaan</p><h2>Vraag van de dag</h2></div><span class="panel-icon">♡</span></div><p>Wat zou vandaag voor jou een fijne dag maken?</p><div class="button-row">${who}</div></section>`;
  return `<div class="page-grid today-dashboard">
    ${stats}
    ${card(date, 'Agenda', 'agenda', agendaBody, '▦')}
    ${card(state.weather.place, 'Weer', 'weather', weatherBody, '☀')}
    ${taskCard}
    ${card('Weekmenu', 'Vanavond op tafel', 'mealplan', mealBody, '♨')}
    ${card('Boodschappenlijst', 'Nog te halen', 'groceries', groceryBody, '🛒')}
    ${card('Huishouden', 'Taken vandaag', 'home', choresBody, '⌂')}
    ${questionCard}
  </div>`;
}
function renderSection(page) {
  const items = listOf(page);
  const extra = page === 'tasks' ? `<form class="inline-form" data-quick-task><input name="text" placeholder="Nieuwe taak…" required maxlength="120"><button class="button button-primary">Toevoegen</button></form>` : '';
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${items.length} items</p><h2>${esc(PAGES[page])}</h2></div></div>${extra}${listMarkup(page, items)}</section>`;
}
function renderBudget() {
  const spent = state.budget.items.reduce((n, i) => n + (Number(i.amount) || 0), 0);
  const fmt = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Maandbudget</p><h2>${fmt(state.budget.monthly)} · uitgegeven ${fmt(spent)}</h2></div></div>
    <form class="inline-form" data-budget-form><input name="monthly" type="number" min="0" step="0.01" value="${esc(state.budget.monthly)}" aria-label="Maandbudget"><button class="button button-secondary">Budget opslaan</button></form>
    <form class="inline-form" data-budget-item><input name="name" placeholder="Uitgave" required><input name="amount" type="number" step="0.01" min="0" placeholder="Bedrag" required><button class="button button-primary">Toevoegen</button></form>
    <ul class="data-list">${state.budget.items.map(i => `<li class="list-card"><div><strong>${esc(i.name)}</strong><small>${fmt(Number(i.amount) || 0)}</small></div><button class="icon-button" data-delete="budget" data-id="${esc(i.id)}" aria-label="Verwijderen">×</button></li>`).join('') || '<li class="empty-row">Nog geen uitgaven.</li>'}</ul></section>`;
}
function renderCar() {
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Auto</p><h2>Autogegevens</h2></div></div><form class="stack-form form-grid" data-car-form>${CAR_FIELDS.map(([k, l, t]) => `<div class="field"><label>${l}<input name="${k}" type="${t || 'text'}" value="${esc(state.car[k] || '')}"></label></div>`).join('')}<button class="button button-primary">Opslaan</button></form></section>`;
}
function renderSettings() {
  const configured = syncConfigured();
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Weergave</p><h2>Instellingen</h2></div></div>
    <div class="setting-row"><label>Thema <select data-setting="theme">${opt('light', 'Licht', state.theme)}${opt('dark', 'Donker', state.theme)}</select></label></div>
    <div class="setting-row"><label>Uiterlijk <select data-setting="appearance">${opt('normal', 'Normaal', state.appearance)}${opt('minimal', 'Minimalistisch', state.appearance)}</select></label></div>
    <div class="setting-row"><label>Accentkleur <input type="color" data-setting="minimalColor" value="${esc(state.minimalColor)}"></label></div>
    <h3>Dashboard samenstellen</h3>
    ${normalizeDashboard(state.dashboard, state.showQuote).map((w, i, a) => `<div class="setting-row"><label><input type="checkbox" data-dash-toggle="${w.id}" ${w.visible ? 'checked' : ''}> ${esc(DASH_WIDGETS[w.id])}</label><span><button type="button" class="icon-button" data-dash-move="${w.id}" data-dir="-1" aria-label="Omhoog" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="icon-button" data-dash-move="${w.id}" data-dir="1" aria-label="Omlaag" ${i === a.length - 1 ? 'disabled' : ''}>↓</button></span></div>`).join('')}
    <div class="setting-row"><button type="button" class="button button-secondary button-small" data-dash-reset>Standaard dashboard herstellen</button></div>
    <p class="small-note">Gegevens worden lokaal in je browser bewaard. Gebruik de knoppen links voor een back-up.</p></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Apparaten</p><h2>Synchronisatie (optioneel)</h2></div><span class="panel-icon">${configured ? '✓' : '○'}</span></div>
    <p class="small-note">Standaard blijft alles alleen op dit apparaat. Vul je eigen Supabase-project en een gedeelde geheime huishoudcode in om te synchroniseren. Gegevens worden versleuteld met de huishoudcode voordat ze worden verstuurd.</p>
    <form id="syncForm" class="stack-form form-grid">
      <div class="field"><label>Project-URL<input name="projectUrl" type="url" value="${esc(syncConfig.projectUrl)}" placeholder="https://jouwproject.supabase.co" autocomplete="off"></label></div>
      <div class="field"><label>Publishable / anon key<input name="anonKey" type="password" value="${esc(syncConfig.anonKey)}" autocomplete="off"></label></div>
      <div class="field"><label>Huishoudcode (minimaal ${MIN_CODE} tekens)<input name="householdCode" type="password" value="${esc(syncConfig.householdCode)}" minlength="${MIN_CODE}" autocomplete="off"></label></div>
      <div class="button-row"><button class="button button-primary">Bewaren</button>${configured ? '<button type="button" class="button button-secondary" data-sync-now>Nu synchroniseren</button><button type="button" class="button button-secondary" data-sync-clear>Synchronisatie uitzetten</button>' : ''}</div>
    </form></section></div>`;
}
function renderPage(page = state.currentPage) {
  if (!PAGES[page]) page = 'today';
  state.currentPage = page;
  const view = $$cached('#view');
  const title = $$cached('#pageTitle');
  if (title && title.textContent !== PAGES[page]) title.textContent = PAGES[page];
  const eyebrow = $$cached('#eyebrow');
  if (eyebrow) { const h = new Date().getHours(); eyebrow.textContent = h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'; }
  const add = $$cached('#addBtn');
  if (add) add.hidden = !SECTIONS[page];
  renderNav();
  if (!view) return;
  view.innerHTML = page === 'today' ? renderToday() : page === 'weather' ? renderWeather() : page === 'budget' ? renderBudget() : page === 'car' ? renderCar() : page === 'settings' ? renderSettings() : renderSection(page);
  if (page === 'weather') loadWeather();
}
function renderNav() {
  const nav = $$cached('#nav');
  if (!nav) return;
  if (nav.childElementCount !== Object.keys(PAGES).length) {
    nav.innerHTML = Object.entries(PAGES).map(([k, l]) => `<button class="nav-item" data-page="${k}">${esc(l)}</button>`).join('');
  }
  for (const b of nav.children) b.classList.toggle('is-active', b.dataset.page === state.currentPage);
}
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.appearance = state.appearance;
  document.documentElement.style.setProperty('--accent-minimal', state.minimalColor);
}

/* ---------- Acties ---------- */
function addItem(page, values) {
  const key = SECTIONS[page].key || page;
  state[key].unshift({ id: uid(), done: false, ...values });
  saveState('Toegevoegd');
  renderPage(state.currentPage);
}
function addTask(text, values = {}) {
  text = String(text || '').trim();
  if (!text) return;
  addItem('tasks', { text, person: 'Samen', category: 'Huishouden', due: todayKey(), ...values });
}
function openItemDialog() {
  const page = state.currentPage;
  const s = SECTIONS[page] || SECTIONS.tasks;
  const dlg = $('#itemDialog');
  const fields = $('#formFields');
  if (!dlg || !fields || typeof dlg.showModal !== 'function') return;
  dlg.dataset.page = SECTIONS[page] ? page : 'tasks';
  $('#dialogTitle') && ($('#dialogTitle').textContent = `${s.label} toevoegen`);
  fields.innerHTML = s.fields.map(f => `<div class="field"><label>${esc(f.label)}${f.type === 'select'
    ? `<select name="${f.name}">${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`
    : `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value || '')}" ${f.required ? 'required' : ''}>`}</label></div>`).join('');
  dlg.showModal();
}
function closeDialog(id) { const d = $(id); if (d && d.open) d.close(); }
function openQuestion(p) {
  const dlg = $$cached('#questionDialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const qTitle = $$cached('#questionTitle'), qText = $$cached('#questionText'), qPerson = $$cached('#questionPerson'), qAnswer = $$cached('#questionAnswer');
  if (qTitle) qTitle.textContent = `${p}, jouw antwoord`;
  if (qText) qText.textContent = 'Wat zou vandaag voor jou een fijne dag maken?';
  if (qPerson) qPerson.value = p;
  if (qAnswer) qAnswer.value = '';
  dlg.showModal();
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() { download(`samen-thuis-backup-${todayKey()}.json`, JSON.stringify(state, null, 2), 'application/json'); toast('Back-up gemaakt'); }
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try { state = mergeState(defaultState(), JSON.parse(r.result)); applyTheme(); saveState('Back-up geladen'); renderPage(state.currentPage); }
    catch { toast('Back-up kon niet worden geladen'); }
  };
  r.readAsText(file);
}
function exportPrices() {
  const rows = [['product', 'winkel', 'prijs'], ...state.priceReferences.map(p => [p.product, p.store || '', p.price ?? ''])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  download(`prijzen-${todayKey()}.csv`, csv, 'text/csv');
  toast(state.priceReferences.length ? 'Prijzen geëxporteerd' : 'Nog geen prijzen, leeg bestand geëxporteerd');
}
function importPrices(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const text = String(r.result);
      let list;
      if (/\.json$/i.test(file.name)) {
        const d = JSON.parse(text);
        list = (Array.isArray(d) ? d : d?.products || [])
          .filter(p => p && typeof p === 'object')
          .map(p => ({ product: p.product || p.name, store: p.store || '', price: Number(p.price) }));
      }
      else {
        list = [];
        for (const line of text.split(/\r?\n/)) {
          if (!line) continue;
          const c = line.split(/[;,\t]/).map(x => x.replace(/^"|"$/g, '').trim());
          const price = parseFloat(c[c.length - 1].replace(',', '.'));
          if (c[0] && !isNaN(price)) list.push({ product: c[0], store: c.length > 2 ? c[1] : '', price });
        }
      }
      state.priceReferences = [];
      for (const p of list) if (p.product && isFinite(p.price)) state.priceReferences.push({ id: uid(), ...p });
      list = state.priceReferences;
      saveState(`${list.length} prijzen geïmporteerd`);
    } catch { toast('Prijsbestand kon niet worden gelezen'); }
  };
  r.onerror = () => toast('Prijsbestand kon niet worden gelezen');
  r.readAsText(file);
}

/* ---------- Events ---------- */
function handleClick(e) {
  const t = e.target.closest ? e.target : null;
  if (!t) return;
  const nav = t.closest('[data-page]');
  if (nav) { renderPage(nav.dataset.page); saveState(); return; }
  const action = t.closest('[data-action]');
  if (action) {
    const a = action.dataset.action;
    if (a === 'backup') exportData();
    else if (a === 'restore') $('#restoreInput')?.click();
    else if (a === 'export-prices') exportPrices();
    else if (a === 'import-prices') $('#priceFileInput')?.click();
    return;
  }
  const retry = t.closest('[data-retry]');
  if (retry) {
    if (retry.dataset.retry === 'weather') loadWeather();
    else if (retry.dataset.retry === 'quote') captureBrainyQuote();
    return;
  }
  const dm = t.closest('[data-dash-move]');
  if (dm) {
    const list = normalizeDashboard(state.dashboard, state.showQuote), i = list.findIndex(w => w.id === dm.dataset.dashMove), j = i + Number(dm.dataset.dir);
    if (i >= 0 && j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; state.dashboard = list; saveState('Opgeslagen'); renderPage('settings'); }
    return;
  }
  if (t.closest('[data-dash-reset]')) { state.dashboard = normalizeDashboard([], true); state.showQuote = true; saveState('Dashboard hersteld'); renderPage('settings'); return; }
  if (t.closest('[data-sync-now]')) { syncNow({ manual: true }); return; }
  if (t.closest('[data-sync-clear]')) { syncConfig = { projectUrl: '', anonKey: '', householdCode: '', lastSyncedAt: '' }; saveSyncConfig(); toast('Synchronisatie uitgezet'); renderPage('settings'); updateSyncBadge(); return; }
  if (t.closest('[data-weather-locate]')) {
    if (!navigator.geolocation) { toast('Locatie niet beschikbaar'); return; }
    navigator.geolocation.getCurrentPosition(p => { state.weather = { place: 'Mijn locatie', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }; saveState('Locatie opgeslagen'); renderPage('weather'); }, () => toast('Locatie niet toegestaan'));
    return;
  }
  if (t.closest('#addBtn')) { openItemDialog(); return; }
  if (t.closest('[data-close-dialog]')) { closeDialog('#itemDialog'); return; }
  if (t.closest('[data-close-question]')) { closeDialog('#questionDialog'); return; }
  const ans = t.closest('[data-answer]');
  if (ans) { openQuestion(ans.dataset.answer); return; }
  const del = t.closest('[data-delete]');
  if (del) {
    if (del.dataset.delete === 'budget') state.budget.items = state.budget.items.filter(i => i.id !== del.dataset.id);
    else { const key = SECTIONS[del.dataset.delete].key || del.dataset.delete; state[key] = state[key].filter(i => i.id !== del.dataset.id); }
    saveState('Verwijderd'); renderPage(state.currentPage);
  }
}
function handleChange(e) {
  const t = e.target;
  if (t.matches && t.matches('[data-toggle]')) {
    const item = listOf(t.dataset.toggle).find(i => i.id === t.dataset.id);
    if (item) { item.done = t.checked; saveState(); renderPage(state.currentPage); }
  } else if (t.matches && t.matches('[data-setting="theme"]')) { state.theme = t.value; applyTheme(); saveState('Opgeslagen'); }
  else if (t.matches && t.matches('[data-setting="appearance"]')) { state.appearance = t.value; applyTheme(); saveState('Opgeslagen'); }
  else if (t.matches && t.matches('[data-setting="minimalColor"]')) { state.minimalColor = t.value; applyTheme(); saveState('Opgeslagen'); }
  else if (t.matches && t.matches('[data-dash-toggle]')) {
    state.dashboard = normalizeDashboard(state.dashboard, state.showQuote).map(w => w.id === t.dataset.dashToggle ? { ...w, visible: t.checked } : w);
    if (t.dataset.dashToggle === 'quote') state.showQuote = t.checked;
    saveState('Opgeslagen');
  }
  else if (t.id === 'restoreInput') { importData(t.files && t.files[0]); t.value = ''; }
  else if (t.id === 'priceFileInput') { importPrices(t.files && t.files[0]); t.value = ''; }
}
function handleSubmit(e) {
  const f = e.target;
  if (!f.matches) return;
  const data = Object.fromEntries(new FormData(f));
  if (f.matches('[data-quick-task]')) { e.preventDefault(); addTask(data.text); }
  else if (f.matches('[data-budget-form]')) { e.preventDefault(); state.budget.monthly = Number(data.monthly) || 0; saveState('Budget opgeslagen'); renderPage('budget'); }
  else if (f.matches('[data-budget-item]')) { e.preventDefault(); state.budget.items.unshift({ id: uid(), name: data.name, amount: Number(data.amount) || 0 }); saveState('Toegevoegd'); renderPage('budget'); }
  else if (f.id === 'syncForm') { e.preventDefault(); handleSyncForm(data); }
  else if (f.matches('[data-weather-form]')) {
    e.preventDefault();
    const lat = Number(data.lat), lon = Number(data.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { toast('Ongeldige coördinaten'); return; }
    state.weather = { place: String(data.place || '').trim() || 'Mijn locatie', lat, lon };
    saveState('Locatie opgeslagen'); renderPage('weather');
  }
  else if (f.matches('[data-car-form]')) { e.preventDefault(); state.car = { ...state.car, ...data }; saveState('Autogegevens opgeslagen'); }
  else if (f.id === 'itemForm') {
    e.preventDefault();
    const page = $('#itemDialog')?.dataset.page || 'tasks';
    if (page === 'tasks') addTask(data.text, data); else addItem(page, data);
    closeDialog('#itemDialog');
  } else if (f.id === 'questionForm') {
    e.preventDefault();
    const answer = String(data.answer || '').trim();
    if (answer && data.person) {
      const day = state.dailyAnswers[todayKey()] = state.dailyAnswers[todayKey()] || {};
      day[data.person] = answer;
      saveState('Antwoord bewaard'); renderPage(state.currentPage);
    }
    closeDialog('#questionDialog');
  }
}

function init() {
  applyTheme();
  bindHandlers({ click: handleClick, change: handleChange, submit: handleSubmit });
  renderPage(state.currentPage);
  window.addEventListener('online', () => {
    captureBrainyQuote();
    if (state.currentPage === 'weather') loadWeather();
    updateSyncBadge();
    scheduleSync();
  });
  window.addEventListener('offline', updateSyncBadge);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker niet beschikbaar', error));
  }
  updateSyncBadge();
  captureBrainyQuote();
  scheduleSync();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
