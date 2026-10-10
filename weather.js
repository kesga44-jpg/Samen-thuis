import { fetchWeatherForecast, isWeatherForecast, fetchWithRetry } from './api.js';
import { renderError } from './rendering.js';
import { escapeHtml as esc } from './utils.js';
import { getState } from './store.js';

const WEATHER_KEY = 'samenThuisV2-weather';
const $ = (s, r = document) => r.querySelector(s);

/* ---------- Weer ---------- */
const WEATHER_CODES = { 0: 'Helder', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Rijpmist', 51: 'Lichte motregen', 53: 'Motregen', 55: 'Zware motregen', 61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien', 95: 'Onweer', 96: 'Onweer met hagel', 99: 'Zwaar onweer met hagel' };
export const weatherLabel = c => WEATHER_CODES[c] || 'Onbekend';
export function weatherUrl() {
  const w = getState().weather;
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
export async function loadWeather() {
  const box = $('#weatherBody');
  if (!box) return;
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null'); } catch { cache = null; }
  const key = `${getState().weather.lat},${getState().weather.lon}`;
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
    try { localStorage.setItem(WEATHER_KEY, JSON.stringify({ key, data, savedAt: Date.now() })); } catch { /* cache niet beschikbaar */ }
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
export function renderWeather() {
  const w = getState().weather;
  return `<section class="panel weather-panel"><div class="panel-heading"><div><p class="eyebrow">${esc(w.place)}</p><h2>Weer</h2></div><span class="panel-icon">☀</span></div>
    <div id="weatherBody"><p class="muted">Weer laden…</p></div>
    <form class="inline-form" data-weather-form><input name="place" value="${esc(w.place)}" placeholder="Plaats" aria-label="Plaatsnaam" required><input name="lat" type="number" step="any" min="-90" max="90" value="${esc(w.lat)}" aria-label="Breedtegraad" required><input name="lon" type="number" step="any" min="-180" max="180" value="${esc(w.lon)}" aria-label="Lengtegraad" required><button class="button button-secondary">Locatie opslaan</button><button type="button" class="button button-secondary" data-weather-locate>Mijn locatie</button></form></section>`;
}

/* ---------- Dashboard-extra's: outfit, luchtkwaliteit/pollen, uurstrook ---------- */
const AIR_KEY = 'samenThuisV2-air';
const POLLEN_FIELDS = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];

/** Kledingadvies op basis van gevoelstemperatuur, regenkans en wind. */
export function outfitAdvice({ apparent, rainProb = 0, wind = 0 }) {
  let icon, headline;
  if (apparent <= 5) { icon = 'warm'; headline = 'Dikke jas, muts en handschoenen'; }
  else if (apparent <= 12) { icon = 'jacket'; headline = 'Jas aan'; }
  else if (apparent <= 18) { icon = 'layers'; headline = 'Laagjes: trui of vest'; }
  else { icon = 'light'; headline = 'Licht gekleed: t-shirt'; }
  const notes = [];
  if (rainProb >= 50) notes.push('Neem een regenjas of paraplu mee');
  else if (rainProb >= 30) notes.push('Kans op een bui: paraplu in de tas');
  if (wind >= 30) notes.push('Winderig: kies een windjack');
  return { icon, headline, notes };
}

export function aqiLabel(aqi) {
  if (!Number.isFinite(aqi)) return 'Onbekend';
  return aqi <= 20 ? 'Goed' : aqi <= 40 ? 'Redelijk' : aqi <= 60 ? 'Matig' : aqi <= 80 ? 'Slecht' : aqi <= 100 ? 'Zeer slecht' : 'Extreem slecht';
}

export function pollenLabel(level) {
  return !Number.isFinite(level) || level <= 0 ? 'Geen' : level < 10 ? 'Laag' : level < 50 ? 'Matig' : 'Hoog';
}

export function parseAirQuality(data) {
  const c = data?.current;
  if (!c || typeof c !== 'object') return null;
  const aqi = Number(c.european_aqi);
  const levels = POLLEN_FIELDS.map(k => Number(c[k])).filter(Number.isFinite);
  const pollen = levels.length ? Math.max(...levels) : null;
  if (!Number.isFinite(aqi) && pollen === null) return null;
  return { aqi: Number.isFinite(aqi) ? aqi : null, aqiLabel: aqiLabel(aqi), pollen, pollenLabel: pollen === null ? 'Onbekend' : pollenLabel(pollen) };
}

export function hourlyStrip(forecast, now = Date.now(), count = 12) {
  const h = forecast?.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  let start = h.time.findIndex(t => new Date(t).getTime() >= now - 3600e3);
  if (start < 0) start = 0;
  return h.time.slice(start, start + count).map((t, i) => ({ hour: `${t.slice(11, 13)}u`, temp: h.temperature_2m[start + i], rain: h.precipitation[start + i] }));
}

export function readWeatherCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
    const w = getState().weather;
    return cache && cache.key === `${w.lat},${w.lon}` && isWeatherForecast(cache.data) ? cache : null;
  } catch { return null; }
}

export function readAirCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(AIR_KEY) || 'null');
    const w = getState().weather;
    return cache && cache.key === `${w.lat},${w.lon}` ? cache.data : null;
  } catch { return null; }
}

/** Haalt weer en luchtkwaliteit op wanneer de cache ouder is dan 30 minuten; geeft true terug bij nieuwe data. */
export async function refreshDashboardWeather() {
  if (!navigator.onLine) return false;
  const w = getState().weather, key = `${w.lat},${w.lon}`;
  const cache = readWeatherCache();
  let changed = false;
  if (!cache || Date.now() - (cache.savedAt || 0) > 30 * 60e3) {
    try {
      const data = await fetchWeatherForecast(weatherUrl());
      localStorage.setItem(WEATHER_KEY, JSON.stringify({ key, data, savedAt: Date.now() }));
      changed = true;
    } catch (error) { console.warn('Weer laden mislukt', error); }
  }
  const air = readAirCache();
  if (!air || Date.now() - (air.savedAt || 0) > 30 * 60e3) {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(w.lat)}&longitude=${encodeURIComponent(w.lon)}&current=european_aqi,${POLLEN_FIELDS.join(',')}&timezone=auto`;
      const parsed = parseAirQuality(await (await fetchWithRetry(url, { timeout: 8000 })).json());
      if (parsed) { localStorage.setItem(AIR_KEY, JSON.stringify({ key, data: { ...parsed, savedAt: Date.now() } })); changed = true; }
    } catch (error) { console.warn('Luchtkwaliteit laden mislukt', error); }
  }
  return changed;
}

export function dashboardWeatherMarkup() {
  const cache = readWeatherCache();
  if (!cache) return '<p class="quote-note muted">Weer wordt geladen zodra er verbinding is…</p>';
  const d = cache.data, c = d.current;
  const advice = outfitAdvice({ apparent: c.apparent_temperature, rainProb: d.daily.precipitation_probability_max[0] ?? 0, wind: c.wind_speed_10m });
  const air = readAirCache();
  const strip = hourlyStrip(d).map(h => `<span class="hour"><small>${esc(h.hour)}</small><b>${Math.round(h.temp)}°</b><small>${h.rain > 0 ? `${h.rain}mm` : ''}</small></span>`).join('');
  return `<p class="weather-now"><strong>${Math.round(c.temperature_2m)}°C</strong> ${esc(weatherLabel(c.weather_code))} <small class="muted">voelt als ${Math.round(c.apparent_temperature)}°</small></p>
    <div class="outfit"><img src="${advice.icon}.svg" alt="" width="40" height="40"><div><strong>Wat trek je aan?</strong><p>${esc(advice.headline)}</p>${advice.notes.map(n => `<small>${esc(n)}</small>`).join('<br>')}</div></div>
    ${air ? `<p class="small-note">Luchtkwaliteit: ${esc(air.aqiLabel)}${air.aqi != null ? ` (${Math.round(air.aqi)})` : ''} · Pollen: ${esc(air.pollenLabel)}</p>` : ''}
    <div class="hour-strip" aria-label="Uur voor uur">${strip}</div>`;
}

