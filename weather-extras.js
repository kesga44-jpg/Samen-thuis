/* Weerpagina-uitbreiding: kledingadvies (illustraties) en pollen/luchtkwaliteit met bron en tijdstip. */
(() => {
  'use strict';
  const W = window.SamenThuisWeatherAdvice;
  if (window.__ST_WX__ || !W) return;
  window.__ST_WX__ = true;
  const AIR_KEY = 'samenThuisAirV27', FC_KEY = 'samenThuisWeatherForecastV25';
  const e2 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };

  async function airData(loc) {
    const key = `${loc.lat},${loc.lon}`, c = json(AIR_KEY);
    if (c && c.key === key && Date.now() - c.t < 30 * 60 * 1000) return { q: c.q, stale: false };
    try {
      if (!navigator.onLine) throw new Error('offline');
      const u = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      u.searchParams.set('latitude', String(loc.lat)); u.searchParams.set('longitude', String(loc.lon));
      u.searchParams.set('current', 'european_aqi,pm2_5,pm10,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen');
      u.searchParams.set('timezone', 'Europe/Amsterdam');
      const r = await fetch(u); if (!r.ok) throw new Error(String(r.status));
      const q = await r.json(); localStorage.setItem(AIR_KEY, JSON.stringify({ t: Date.now(), key, q }));
      return { q, stale: false };
    } catch (_) { return c && c.key === key ? { q: c.q, stale: true } : null; }
  }
  async function paint() {
    const body = document.querySelector('[data-weather-page-body]');
    if (!body || body.querySelector('[data-wx-extras]') || !body.querySelector('.weather-current25')) return;
    const holder = document.createElement('div'); holder.dataset.wxExtras = '';
    body.querySelector('.weather-current25').after(holder);
    const fc = json(FC_KEY), adv = fc && fc.data ? W.advice(fc.data.current, fc.data.daily) : null;
    const clothes = adv ? `<section class="card weather-clothes27"><div class="card-head"><h2>Kledingadvies</h2><small class="muted">Voelt als ${adv.feels}° · regen ${Math.round(adv.rain)}%</small></div><ul class="clothes-list27" style="display:flex;flex-wrap:wrap;gap:14px;list-style:none;padding:0">${adv.items.map(i => `<li style="text-align:center;min-width:72px">${W.icon(i.id)}<div class="small-note">${e2(i.label)}</div></li>`).join('')}</ul></section>` : '';
    holder.innerHTML = clothes + '<section class="card"><div class="card-head"><h2>Pollen & luchtkwaliteit</h2></div><p class="muted">Laden…</p></section>';
    const loc = window.SamenThuisWeatherLocation25 ? window.SamenThuisWeatherLocation25() : { lat: 51.9225, lon: 4.47917 };
    const res = await airData(loc), s = res && W.airSummary(res.q);
    const air = s ? `<section class="card weather-air27"><div class="card-head"><h2>Pollen & luchtkwaliteit</h2><small class="muted">Bron: ${e2(s.source)}${s.time ? ' · peiltijd ' + e2(s.time.replace('T', ' ')) : ''}${res.stale ? ' · offline, laatst bekende waarden' : ''}</small></div><p><strong>AQI ${s.aqi}</strong> · ${e2(s.label)}</p><ul class="list">${s.pollen.map(p => `<li class="list-item"><span>${e2(p.name)}</span><strong>${e2(p.level)}</strong></li>`).join('') || '<li class="muted">Geen pollenmetingen beschikbaar.</li>'}</ul><p class="small-note">Indicatie; geen medisch advies.</p></section>`
      : '<section class="card"><div class="card-head"><h2>Pollen & luchtkwaliteit</h2></div><p class="muted">Gegevens niet beschikbaar (geen verbinding of geen metingen voor deze locatie).</p></section>';
    holder.innerHTML = clothes + air;
  }
  let timer; new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(paint, 150); }).observe(document.querySelector('#view') || document.body, { childList: true, subtree: true });
  paint();
})();
