(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisWeatherAdvice = core;
})(globalThis, function () {
  // Minimalistische lijnillustraties (24x24, currentColor).
  const ICONS = {
    coat: '<path d="M8 3l4 3 4-3 4 4-2 3v11H6V10L4 7z"/><path d="M12 6v15"/>',
    sweater: '<path d="M8 4l4 2 4-2 5 5-3 3-2-1v9H8v-9l-2 1-3-3z"/>',
    tshirt: '<path d="M8 4l4 2 4-2 5 4-3 3-2-1v9H8v-9l-2 1-3-3z"/>',
    pants: '<path d="M7 3h10l1 18h-5l-1-10-1 10H6z"/>',
    shorts: '<path d="M7 5h10l2 10h-6l-1-4-1 4H5z"/>',
    umbrella: '<path d="M3 12a9 9 0 0118 0z"/><path d="M12 12v7a2 2 0 004 0"/>',
    wind: '<path d="M3 9h11a3 3 0 10-3-3"/><path d="M3 14h15a3 3 0 11-3 3"/>',
    sunglasses: '<circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M10.5 14h3M3.5 14L5 8M20.5 14L19 8"/>',
    scarf: '<path d="M7 4h10v6a5 5 0 01-5 5 5 5 0 01-5-5z"/><path d="M12 15v6l3-2"/>'
  };
  const LABELS = { coat: 'Jas', sweater: 'Trui of vest', tshirt: 'T-shirt', pants: 'Lange broek', shorts: 'Korte broek', umbrella: 'Paraplu of regenjas', wind: 'Winddichte laag', sunglasses: 'Zonnebril', scarf: 'Sjaal en muts' };

  function advice(current, daily) {
    const feels = Math.round(Number(current && current.apparent_temperature != null ? current.apparent_temperature : current && current.temperature_2m));
    if (!Number.isFinite(feels)) return null;
    const rain = Number(daily && daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;
    const wind = Number(current && current.wind_speed_10m) || 0, code = current && current.weather_code != null ? Number(current.weather_code) : NaN;
    const ids = [];
    if (feels <= 5) ids.push('coat', 'sweater', 'pants', 'scarf');
    else if (feels <= 11) ids.push('coat', 'sweater', 'pants');
    else if (feels <= 16) ids.push('sweater', 'pants');
    else if (feels <= 22) ids.push('tshirt', 'pants');
    else ids.push('tshirt', 'shorts');
    if (rain >= 40) ids.push('umbrella');
    if (wind >= 30) ids.push('wind');
    if (Number.isFinite(code) && code <= 1 && feels >= 18) ids.push('sunglasses');
    return { feels, rain, wind, items: ids.map(id => ({ id, label: LABELS[id] })) };
  }
  const icon = id => ICONS[id] ? `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>` : '';
  function aqiLabel(v) { v = Number(v); return !Number.isFinite(v) ? 'Onbekend' : v <= 20 ? 'Zeer goed' : v <= 40 ? 'Goed' : v <= 60 ? 'Matig' : v <= 80 ? 'Slecht' : 'Zeer slecht'; }
  function pollenLevel(v) { v = Number(v); return !Number.isFinite(v) ? 'Onbekend' : v < 1 ? 'Geen' : v < 20 ? 'Laag' : v < 80 ? 'Matig' : 'Hoog'; }
  // Geeft null als er geen bruikbare metingen zijn (dan toont de UI "niet beschikbaar", geen verzonnen cijfers).
  function airSummary(q) {
    const c = q && q.current; if (!c || c.european_aqi == null) return null;
    const pollen = [['Gras', c.grass_pollen], ['Berk', c.birch_pollen], ['Els', c.alder_pollen], ['Bijvoet', c.mugwort_pollen], ['Ambrosia', c.ragweed_pollen]]
      .filter(p => p[1] != null).map(([name, v]) => ({ name, value: Number(v), level: pollenLevel(v) })).sort((a, b) => b.value - a.value);
    return { aqi: Math.round(Number(c.european_aqi)), label: aqiLabel(c.european_aqi), pm25: c.pm2_5, pm10: c.pm10, pollen, time: c.time || '', source: 'Open-Meteo Air Quality' };
  }
  return { ICONS, advice, icon, aqiLabel, pollenLevel, airSummary };
});
