/* Samen Thuis – kern van de universele importer (zuivere logica, geen DOM).
   Wordt door de bestaande universele importlaag in app.js gebruikt en is met node:test te testen.
   Stroom: bestanden/tekst -> segmenten (tekst of tabel) -> herkende items (voorbeeld) -> pas na bevestiging opslaan. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisImport = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TARGETS = {
    planning: 'Agenda', trips: 'Reizen', chores: 'Huishouden', stock: 'Voorraad',
    home: 'Woning', meals: 'Weekmenu', groceries: 'Boodschappen', ideas: 'Samen doen'
  };

  // Vaste kolomvolgorde per bestemming (bestaand v14-formaat, uitgebreid aan het eind).
  const SCHEMAS = {
    planning: ['title', 'startDate', 'startTime', 'endDate', 'endTime', 'allDay', 'location', 'description', 'repeat', 'person'],
    meals: ['date', 'mealType', 'title', 'persons', 'ingredients', 'note'],
    groceries: ['title', 'amount', 'unit', 'category', 'store', 'forMeal', 'done', 'note'],
    chores: ['title', 'category', 'repeat', 'person', 'startDate', 'nextDate', 'priority', 'done', 'notes'],
    stock: ['title', 'category', 'amount', 'unit', 'minimum', 'bestBefore', 'location', 'note'],
    ideas: ['title', 'category', 'description', 'person', 'priority', 'status', 'date', 'note'],
    home: ['title', 'category', 'description', 'kind', 'priority', 'startDate', 'deadline', 'status', 'cost', 'done', 'note'],
    trips: ['trip', 'section', 'title', 'kind', 'description', 'startDate', 'endDate', 'deadline', 'location', 'cost', 'priority', 'checkable', 'done', 'note']
  };
  const DATE_KEYS = ['date', 'startDate', 'endDate', 'deadline', 'nextDate', 'bestBefore'];
  const TIME_KEYS = ['startTime', 'endTime'];
  const NUM_KEYS = ['amount', 'cost', 'minimum'];
  const BOOL_KEYS = ['done', 'checkable', 'allDay'];
  const PRIMARY_DATE = { planning: 'startDate', meals: 'date', chores: 'startDate', stock: 'bestBefore', ideas: 'date', home: 'startDate', trips: 'startDate' };
  const NOTE_KEY = { planning: 'description', meals: 'note', groceries: 'note', chores: 'notes', stock: 'note', ideas: 'note', home: 'note', trips: 'note' };

  const ALIASES = {
    agenda: 'planning', planning: 'planning', kalender: 'planning', afspraak: 'planning', afspraken: 'planning',
    weekmenu: 'meals', menu: 'meals', maaltijd: 'meals', maaltijden: 'meals', eten: 'meals', recept: 'meals', recepten: 'meals',
    boodschappen: 'groceries', boodschap: 'groceries', boodschappenlijst: 'groceries', grocery: 'groceries', groceries: 'groceries',
    huishouden: 'chores', huishoudelijk: 'chores', schoonmaak: 'chores', taak: 'chores', taken: 'chores',
    voorraad: 'stock', stock: 'stock', inventaris: 'stock',
    idee: 'ideas', ideeen: 'ideas', ideeenlijst: 'ideas', samen_doen: 'ideas', samendoen: 'ideas', 'samen doen': 'ideas', date: 'ideas', dateideeen: 'ideas',
    woning: 'home', huis: 'home', onderhoud: 'home',
    reizen: 'trips', reis: 'trips', vakantie: 'trips', travel: 'trips'
  };

  const MONTHS = { januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, augustus: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, december: 12, dec: 12, january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10, oct: 10 };
  const WEEKDAYS = { maandag: 0, dinsdag: 1, woensdag: 2, donderdag: 3, vrijdag: 4, zaterdag: 5, zondag: 6 };
  const MONTH_RX = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

  const pad = n => String(n).padStart(2, '0');
  const norm = v => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const clean = v => String(v ?? '').trim().replace(/^\[(.*)\]$/, '$1').trim();
  const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const mkISO = (y, m, d) => {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  const addDaysISO = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weekStart = iso => { const d = new Date(iso + 'T12:00:00Z'); return addDaysISO(iso, -((d.getUTCDay() + 6) % 7)); };

  /* ---------- getallen (Nederlandse en internationale notatie) ---------- */
  function parseNumber(v, fallback = 0) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
    const s = String(v ?? '').replace(/[\u00a0\s]/g, '').replace(/[€$£]|eur(o)?|usd/gi, '');
    const m = s.match(/[-+]?\d[\d.,']*|[-+]?[.,]\d+/);
    if (!m) return fallback;
    let t = m[0].replace(/'/g, '');
    const sign = t.startsWith('-') ? -1 : 1;
    t = t.replace(/^[-+]/, '').replace(/[.,]+$/, '');
    const hasC = t.includes(','), hasD = t.includes('.');
    if (hasC && hasD) {
      const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
      const th = dec === ',' ? '.' : ',';
      t = t.split(th).join('').replace(dec, '.');
    } else if (hasC || hasD) {
      const sep = hasC ? ',' : '.';
      const parts = t.split(sep);
      if (parts.length > 2) t = parts.join('');
      else if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && Number(parts[0]) !== 0) t = parts.join('');
      else t = parts.join('.');
    }
    const n = Number(t);
    return Number.isFinite(n) ? sign * n : fallback;
  }
  const hasNumber = v => typeof v === 'number' || /\d/.test(String(v ?? ''));
  const roundMoney = n => Math.round(n * 100) / 100;

  /* ---------- datums en tijden ---------- */
  function yearFor(day, month, ref) {
    const refY = Number(ref.slice(0, 4));
    let iso = mkISO(refY, month, day);
    if (iso && iso < addDaysISO(ref, -60)) iso = mkISO(refY + 1, month, day);
    return iso;
  }
  // Zoekt de eerste datum in een tekst en geeft die plus de positie terug.
  function findDate(s, ref) {
    s = String(s ?? ''); ref = ref || new Date().toISOString().slice(0, 10);
    let m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) { const iso = mkISO(m[1], m[2], m[3]); if (iso) return { iso, index: m.index, length: m[0].length }; }
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
    if (m) { const iso = mkISO(m[3], m[2], m[1]); if (iso) return { iso, index: m.index, length: m[0].length }; }
    m = s.match(new RegExp(`\\b(\\d{1,2})\\s*(?:e|ste|de)?\\s+(${MONTH_RX})\\b\\.?(?:\\s+(\\d{4}))?`, 'i'));
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      const iso = m[3] ? mkISO(m[3], mo, m[1]) : yearFor(m[1], mo, ref);
      if (iso) return { iso, index: m.index, length: m[0].length };
    }
    m = s.match(/\b(overmorgen|morgen|vandaag)\b/i);
    if (m) {
      const n = { vandaag: 0, morgen: 1, overmorgen: 2 }[m[1].toLowerCase()];
      return { iso: addDaysISO(ref, n), index: m.index, length: m[0].length };
    }
    return null;
  }
  // "12 t/m 19 oktober" of "12-19 oktober 2026"
  function findDateRange(s, ref) {
    const m = String(s).match(new RegExp(`\\b(\\d{1,2})\\s*(?:-|–|—|t/m|tot en met|tot)\\s*(\\d{1,2})\\s+(${MONTH_RX})\\b\\.?(?:\\s+(\\d{4}))?`, 'i'));
    if (!m) return null;
    const mo = MONTHS[m[3].toLowerCase()];
    const a = m[4] ? mkISO(m[4], mo, m[1]) : yearFor(m[1], mo, ref);
    const b = m[4] ? mkISO(m[4], mo, m[2]) : yearFor(m[2], mo, ref);
    return a && b ? { from: a, to: b, index: m.index, length: m[0].length } : null;
  }
  function toISODate(v, ref) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    if (isISO(s)) return s;
    const f = findDate(s, ref);
    return f ? f.iso : s;
  }
  function findTime(s) {
    s = String(s ?? '');
    let m = s.match(/(?<![\d.:])([01]?\d|2[0-3])[:.u]([0-5]\d)\s*(?:uur|u|h)?\s*(?:-|–|—|tot|t\/m)\s*([01]?\d|2[0-3])[:.u]([0-5]\d)\s*(?:uur|u|h)?(?![\d])/i);
    if (m && /[:u]/i.test(m[0].slice(0, 5))) return { start: `${pad(m[1])}:${m[2]}`, end: `${pad(m[3])}:${m[4]}`, index: m.index, length: m[0].length };
    m = s.match(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)(?!\d)\s*(?:uur|u|h)?/i);
    if (m) return { start: `${pad(m[1])}:${m[2]}`, end: '', index: m.index, length: m[0].length };
    m = s.match(/(?<![\d.:])([01]?\d|2[0-3])u([0-5]\d)\b/i);
    if (m) return { start: `${pad(m[1])}:${m[2]}`, end: '', index: m.index, length: m[0].length };
    m = s.match(/(?<![\d.:,])([01]?\d|2[0-3])[.]([0-5]\d)\s*(?:uur|u)\b/i);
    if (m) return { start: `${pad(m[1])}:${m[2]}`, end: '', index: m.index, length: m[0].length };
    m = s.match(/\b(?:om\s+)?([01]?\d|2[0-3])\s*(?:uur|u)\b/i);
    if (m) return { start: `${pad(m[1])}:00`, end: '', index: m.index, length: m[0].length };
    return null;
  }
  function toTime(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const f = findTime(s);
    if (f && f.length >= s.length - 1) return f.start;
    const m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    return m ? `${pad(m[1])}:${m[2]}` : (f ? f.start : s);
  }
  function findMoney(s) {
    s = String(s ?? '');
    const num = '(\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
    let m = s.match(new RegExp(`(?:€|eur(?:o)?\\.?)\\s*${num}(?:\\s*,-)?`, 'i'));
    if (!m) m = s.match(new RegExp(`${num}\\s*(?:€|euro\\b|eur\\b)`, 'i'));
    if (!m) return null;
    return { value: parseNumber(m[1]), index: m.index, length: m[0].length, text: m[0] };
  }

  /* ---------- enkelvoudige normalisaties ---------- */
  function toBool(v, fallback = false) {
    if (typeof v === 'boolean') return v;
    const n = norm(v);
    if (['1', 'ja', 'yes', 'true', 'aan', 'x', 'afgevinkt', 'klaar', 'gedaan', 'v', 'checked', 'done', 'voltooid'].includes(n)) return true;
    if (['0', 'nee', 'no', 'false', 'uit', 'open', 'niet afgevinkt', 'todo'].includes(n)) return false;
    return fallback;
  }
  function toPriority(value = '') {
    const v = norm(value);
    if (/urgent|belangrijk|high|hoog|prio 1|!!/.test(v)) return 'hoog';
    if (/low|laag/.test(v)) return 'laag';
    if (/normaal|normal|medium|midden/.test(v)) return 'normaal';
    return value ? String(value).trim() : '';
  }
  function toRepeat(value = '') {
    const v = norm(String(value).replace(/^frequentie\s*:?\s*/i, ''));
    if (!v) return '';
    const t = [
      [/^(dagelijks|elke dag|iedere dag|daily)$/, 'Dagelijks'], [/^(om de dag|elke 2 dagen)$/, 'Om de dag'],
      [/^(2x per week|2 per week|twee keer per week|twice weekly)$/, '2× per week'], [/^(3x per week|3 per week|drie keer per week)$/, '3× per week'],
      [/^(wekelijks|iedere week|elke week|weekly)$/, 'Wekelijks'], [/^(elke 2 weken|om de week|tweewekelijks|biweekly)$/, 'Elke 2 weken'],
      [/^(elke 4 weken|4 wekelijks)$/, 'Elke 4 weken'], [/^(maandelijks|iedere maand|elke maand|monthly)$/, 'Maandelijks'],
      [/^(elke 2 maanden|2 maandelijks)$/, 'Elke 2 maanden'], [/^(elke 3 maanden|kwartaal|kwartaallijks|quarterly)$/, 'Elke 3 maanden'],
      [/^(elke 6 maanden|halfjaarlijks|semiannual)$/, 'Elke 6 maanden'], [/^(jaarlijks|ieder jaar|elk jaar|1x per jaar|yearly)$/, 'Jaarlijks'],
      [/^(na elke was|na iedere was)$/, 'Na elke was'], [/^(wanneer nodig|indien nodig|naar behoefte)$/, 'Wanneer nodig'], [/^(eenmalig|once)$/, 'Eenmalig']
    ];
    const hit = t.find(([rx]) => rx.test(v));
    return hit ? hit[1] : String(value).trim();
  }

  /* ---------- tekstcodering ---------- */
  function decodeBytes(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dec = (label, opts) => new TextDecoder(label, opts).decode(u);
    if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return { text: dec('utf-8').replace(/^\uFEFF/, ''), encoding: 'utf-8' };
    if (u.length >= 2 && u[0] === 0xff && u[1] === 0xfe) return { text: dec('utf-16le').replace(/^\uFEFF/, ''), encoding: 'utf-16le' };
    if (u.length >= 2 && u[0] === 0xfe && u[1] === 0xff) return { text: dec('utf-16be').replace(/^\uFEFF/, ''), encoding: 'utf-16be' };
    if (u.length >= 4 && u[1] === 0 && u[3] === 0 && u[0] !== 0) return { text: dec('utf-16le'), encoding: 'utf-16le' };
    try { return { text: dec('utf-8', { fatal: true }), encoding: 'utf-8' }; } catch (_) { /* geen geldige UTF-8 */ }
    return { text: dec('windows-1252'), encoding: 'windows-1252' };
  }

  /* ---------- CSV ---------- */
  function parseDelimited(text, delim) {
    const rows = []; let row = [], cell = '', q = false, i = 0;
    const s = String(text).replace(/^\uFEFF/, '');
    const push = () => { row.push(cell); cell = ''; };
    for (; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) push();
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; push(); rows.push(row); row = []; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { push(); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
  }
  function detectDelimiter(text) {
    const s = String(text).replace(/^\uFEFF/, '');
    const sep = s.match(/^sep=(.)\r?\n/i);
    if (sep) return sep[1];
    const sample = s.split(/\r?\n/).slice(0, 40).join('\n');
    let best = null;
    [';', '\t', '|', ','].forEach(d => {
      const rows = parseDelimited(sample, d).slice(0, 30);
      if (rows.length < 1) return;
      const counts = rows.map(r => r.length);
      const freq = {}; counts.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
      const [modal, n] = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      if (Number(modal) < 2) return;
      const score = (n / rows.length) * 10 + Math.min(Number(modal), 8) * 0.1;
      if (!best || score > best.score + 0.05) best = { d, score };
    });
    return best ? best.d : null;
  }

  /* ---------- kolomkoppen ---------- */
  const HEADER_CONCEPTS = [
    ['title', /^(titel|title|naam|name|onderwerp|product|producten|artikel|item|taak|gerecht|maaltijd|activiteit|afspraak|event|idee|ingredient|ingredienten|wat)$/],
    ['date', /^(datum|date|dag|startdatum|begindatum|start datum|begin datum|start date|van|start|vanaf|begin|op|wanneer)$/],
    ['endDate', /^(einddatum|enddate|end date|eind datum|tot en met|t m|tot|einde|terug)$/],
    ['time', /^(tijd|time|starttijd|begintijd|aanvang|start tijd|begin tijd|start time)$/],
    ['endTime', /^(eindtijd|end time|eind tijd|einde tijd)$/],
    ['deadline', /^(deadline|uiterlijk|uiterste datum|vervaldatum|due|due date|inleverdatum)$/],
    ['nextDate', /^(volgende datum|volgende|next|volgende keer)$/],
    ['bestBefore', /^(houdbaar tot|houdbaarheid|tht|ten minste houdbaar tot|best before|expiry|expires|houdbaarheidsdatum)$/],
    ['amount', /^(aantal|hoeveelheid|amount|qty|quantity|stuks|nr|aantal stuks|voorraad)$/],
    ['unit', /^(eenheid|unit|maat)$/],
    ['minimum', /^(minimum|min|minimumvoorraad|minimale voorraad|drempel)$/],
    ['money', /^(bedrag|prijs|kosten|price|cost|totaal|total|eur|euro|raming|budget|kosten eur|prijs eur|bedrag eur)$/],
    ['category', /^(categorie|category|ruimte|afdeling|groep|soort product|rubriek)$/],
    ['store', /^(winkel|store|supermarkt|shop|waar kopen)$/],
    ['location', /^(locatie|location|plaats|adres|bestemming adres|stad|waar|plek|opslag)$/],
    ['person', /^(persoon|person|wie|voor wie|toegewezen aan|toegewezen|eigenaar|door|verantwoordelijk)$/],
    ['priority', /^(prioriteit|priority|prio|belang)$/],
    ['status', /^(status|stand)$/],
    ['repeat', /^(herhaling|herhalen|frequentie|repeat|frequency|interval)$/],
    ['done', /^(afgevinkt|klaar|gedaan|done|voltooid|compleet|gekocht|check)$/],
    ['description', /^(omschrijving|beschrijving|description|details|toelichting|uitleg)$/],
    ['note', /^(notitie|notities|opmerking|opmerkingen|note|notes|link|memo|link notitie)$/],
    ['trip', /^(reis|trip|reisnaam|vakantie)$/],
    ['section', /^(map|sectie|section|onderdeel|reisonderdeel|hoofdstuk)$/],
    ['kind', /^(type|soort|kind|categorie type|type onderdeel)$/],
    ['target', /^(bestemming|pagina|page|target|module|waarheen|tabblad|doel)$/],
    ['allDay', /^(hele dag|all day|allday)$/],
    ['forMeal', /^(voor weekmenu|voor maaltijd|voor gerecht|recept|for meal)$/],
    ['persons', /^(personen|porties|persons|servings)$/],
    ['ingredients', /^(ingredienten|ingrediënten|ingredients)$/],
    ['checkable', /^(afvinken|checkable|afvinkbaar)$/]
  ];
  function headerConcept(h) {
    const n = norm(h);
    if (!n) return null;
    const hit = HEADER_CONCEPTS.find(([, rx]) => rx.test(n));
    return hit ? hit[0] : null;
  }
  function targetFromName(name) {
    const n = norm(name);
    if (!n) return null;
    return ALIASES[n] || ALIASES[n.replace(/\s+/g, '_')] || ALIASES[n.replace(/\s+/g, '')] || null;
  }

  // Concept -> veldnaam binnen de gekozen bestemming
  function fieldFor(target, concept) {
    const S = SCHEMAS[target];
    const map = {
      planning: { date: 'startDate', time: 'startTime', note: 'description', deadline: 'startDate', nextDate: 'startDate', kind: null, section: null, category: null, status: null, priority: null, money: null },
      meals: { kind: 'mealType', category: 'mealType', note: 'note', description: 'note', location: null, money: null },
      groceries: { description: 'note', money: null },
      chores: { date: 'startDate', description: 'notes', note: 'notes', deadline: 'nextDate', kind: null, money: null },
      stock: { date: 'bestBefore', deadline: 'bestBefore', description: 'note', store: null, money: null },
      ideas: { money: null, location: null },
      home: { date: 'startDate', money: 'cost', location: null },
      trips: { date: 'startDate', money: 'cost', description: 'description' }
    }[target] || {};
    if (concept in map) return map[concept];
    return S.includes(concept) ? concept : null;
  }

  /* ---------- items opbouwen ---------- */
  let seq = 0;
  const uid = () => `imp${Date.now().toString(36)}${(seq++).toString(36)}`;

  function emptyRecord(target) {
    const rec = { target };
    SCHEMAS[target].forEach(k => { rec[k] = NUM_KEYS.includes(k) ? '' : BOOL_KEYS.includes(k) ? false : ''; });
    return rec;
  }
  function appendNote(rec, text) {
    if (!text) return;
    const k = NOTE_KEY[rec.target];
    rec[k] = rec[k] ? `${rec[k]}\n${text}` : text;
  }
  // Zet ruwe waarden om naar vaste types: ISO-datums, HH:MM-tijden, getallen, booleans.
  function coerceRecord(rec, ref) {
    const out = { ...rec };
    SCHEMAS[rec.target].forEach(k => {
      let v = out[k];
      if (DATE_KEYS.includes(k)) out[k] = toISODate(v, ref);
      else if (TIME_KEYS.includes(k)) out[k] = toTime(v);
      else if (NUM_KEYS.includes(k)) out[k] = v === '' || v == null ? '' : parseNumber(v, '');
      else if (BOOL_KEYS.includes(k)) out[k] = toBool(v, false);
      else if (k === 'priority') out[k] = toPriority(v);
      else if (k === 'repeat') out[k] = toRepeat(v);
      else out[k] = v == null ? '' : String(v).trim();
    });
    return out;
  }
  function makeEntry(rec, source, extra = {}) {
    return { uid: uid(), target: rec.target, rec, source, selected: true, duplicate: false, uncertain: false, warnings: [], ...extra };
  }

  // Zet velden om als de gebruiker de bestemming van een item wijzigt.
  function convertRecord(rec, newTarget) {
    if (rec.target === newTarget) return rec;
    const out = emptyRecord(newTarget);
    SCHEMAS[newTarget].forEach(k => { if (k in rec && rec[k] !== '' && rec[k] != null) out[k] = rec[k]; });
    const oldPrimary = PRIMARY_DATE[rec.target];
    const date = (oldPrimary && rec[oldPrimary]) || DATE_KEYS.map(k => rec[k]).find(Boolean) || '';
    if (PRIMARY_DATE[newTarget] && !out[PRIMARY_DATE[newTarget]]) out[PRIMARY_DATE[newTarget]] = date;
    if (rec.startTime && newTarget === 'planning') out.startTime = rec.startTime;
    const oldNote = rec[NOTE_KEY[rec.target]] || rec.description || rec.note || rec.notes || '';
    if (oldNote && !out[NOTE_KEY[newTarget]]) out[NOTE_KEY[newTarget]] = oldNote;
    if (rec.cost !== undefined && rec.cost !== '' && !('cost' in out)) appendNote(out, `Kosten: ${rec.cost}`);
    out.target = newTarget;
    return out;
  }

  /* ---------- gestructureerde regels (bestaand pipe-formaat) ---------- */
  function splitStructured(line) {
    const raw = String(line).trim();
    let parts;
    if (raw.includes('|')) parts = raw.split('|');
    else if (raw.includes(';')) parts = raw.split(';');
    else if (raw.includes('\t')) parts = raw.split(/\t+/);
    else if (/\s\/\s/.test(raw)) parts = raw.split(/\s+\/\s+/);
    else if (/\s[-–—]\s/.test(raw)) parts = raw.split(/\s+[-–—]\s+/);
    else if (/\s{2,}/.test(raw)) parts = raw.split(/\s{2,}/);
    else return [raw];
    return parts.map(clean);
  }
  const hasExplicitDelimiter = line => /[|;\t]/.test(line);
  // Eerste kolom is een bestemming (bijv. "huishouden | Badkamer ...")
  function leadingTarget(parts) {
    if (parts.length < 2) return null;
    return targetFromName(parts[0]);
  }
  function recordFromParts(target, parts, ref) {
    const rec = emptyRecord(target);
    SCHEMAS[target].forEach((k, i) => { rec[k] = clean(parts[i] ?? ''); });
    return coerceRecord(rec, ref);
  }

  /* ---------- tabellen ---------- */
  function looksLikeHeader(rows) {
    if (!rows.length) return false;
    const r0 = rows[0];
    const concepts = r0.map(headerConcept).filter(Boolean);
    if (concepts.length >= 1 && r0.filter(c => c !== '').every(c => !/^[\d€.,\s-]+$/.test(String(c)))) {
      return concepts.length >= Math.min(2, r0.filter(Boolean).length) || concepts.includes('title');
    }
    return false;
  }
  function inferTableTarget(concepts) {
    const has = c => concepts.includes(c);
    const score = {
      planning: (has('time') ? 3 : 0) + (has('endTime') ? 2 : 0) + (has('allDay') ? 2 : 0) + (has('date') ? 1 : 0),
      meals: (has('ingredients') ? 3 : 0) + (has('persons') ? 3 : 0) + (has('date') && !has('time') && has('kind') ? 1 : 0),
      groceries: (has('store') ? 3 : 0) + (has('unit') ? 1 : 0) + (has('amount') ? 1 : 0) + (has('forMeal') ? 3 : 0),
      chores: (has('repeat') ? 3 : 0) + (has('person') ? 1 : 0),
      stock: (has('minimum') ? 4 : 0) + (has('bestBefore') ? 3 : 0) + (has('amount') && has('unit') ? 1 : 0),
      trips: (has('trip') ? 4 : 0) + (has('section') ? 2 : 0) + (has('endDate') ? 1 : 0) + (has('location') && has('money') ? 2 : 0),
      home: (has('money') && !has('location') ? 1 : 0) + (has('deadline') ? 1 : 0),
      ideas: 0
    };
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    return { target: ranked[0][1] > 0 ? ranked[0][0] : null, score: ranked[0][1] };
  }
  function cellText(v) { return typeof v === 'number' ? String(v) : String(v ?? '').trim(); }

  // Zet één tabelrij met bekende kolomkoppen om naar een record.
  function rowToRecord(target, headers, concepts, row, ref, opts = {}) {
    const rec = emptyRecord(target);
    const extras = [];
    let titleSet = false;
    headers.forEach((h, i) => {
      const raw = row[i];
      const val = cellText(raw);
      if (val === '') return;
      const concept = concepts[i];
      const key = concept ? fieldFor(target, concept) : null;
      if (concept && concept !== 'target' && key) {
        if (key === 'title') titleSet = true;
        if (NUM_KEYS.includes(key) || key === 'cost') rec[key] = typeof raw === 'number' ? raw : parseNumber(val, '');
        else if (rec[key] && key !== 'title') rec[key] = `${rec[key]} ${val}`.trim();
        else rec[key] = val;
        if (key === 'cost' && rec.cost === '') extras.push(`${h}: ${val}`);
        return;
      }
      if (concept === 'money') { extras.push(`${h}: ${val}`); return; }
      if (concept === 'target') return;
      extras.push(h ? `${h}: ${val}` : val);
    });
    if (!titleSet) {
      const idx = headers.findIndex((h, i) => cellText(row[i]) && !concepts[i] && !hasNumber(row[i]) && !findDate(cellText(row[i]), ref));
      if (idx >= 0) { rec.title = cellText(row[idx]); const x = `${headers[idx]}: ${rec.title}`; const j = extras.indexOf(x); if (j >= 0) extras.splice(j, 1); }
      else if (rec.description || rec.note) {
        const nk = rec.description ? 'description' : 'note';
        const full = String(rec[nk]);
        rec.title = full.split('\n')[0].slice(0, 80);
        if (full === rec.title) rec[nk] = '';
      }
    }
    extras.forEach(x => appendNote(rec, x));
    if (target === 'trips' && opts.trip && !rec.trip) rec.trip = opts.trip;
    return coerceRecord(rec, ref);
  }

  // Tabel (rijen met cellen) -> items, met bron per rij. Geeft ook waarschuwingen terug.
  function tableToEntries(seg, opts) {
    const ref = opts.today, warnings = [], entries = [];
    let rows = seg.rows.map(r => r.map(c => (typeof c === 'number' ? c : String(c ?? '').trim())));
    rows = rows.filter(r => r.some(c => c !== ''));
    if (!rows.length) return { entries, warnings };
    const rowStart = seg.firstRow || 1;
    const hasHeader = looksLikeHeader(rows) || (rows.length > 1 && !rows[0].some(c => /\d/.test(String(c))) && rows[1].some(c => /\d/.test(String(c))) && rows[0].every(c => c !== ''));
    const fallbackTarget = opts.target !== 'auto' ? opts.target : (seg.hint || null);
    const where = (n, extra = '') => `${seg.location ? seg.location + ', ' : ''}rij ${n}${extra}`;
    if (!hasHeader) {
      // Geen kolomkoppen: gebruik de vaste kolomvolgorde van het importformaat.
      rows.forEach((row, i) => {
        const parts = row.map(cellText);
        const lead = leadingTarget(parts);
        const t = lead || fallbackTarget;
        if (!t) { entries.push(...freeTextEntries(parts.filter(Boolean).join(' · '), { ...opts, target: 'auto' }, { file: seg.file, where: where(rowStart + i) })); return; }
        const rec = recordFromParts(t, lead ? parts.slice(1) : parts, ref);
        if (!rec.title && t !== 'trips') { warnings.push(`${where(rowStart + i)}: geen titel herkend, rij overgeslagen`); return; }
        entries.push(makeEntry(rec, { file: seg.file, where: where(rowStart + i) }));
      });
      return { entries, warnings };
    }
    const headers = rows[0].map(String);
    const width = headers.length;
    const concepts = headers.map(headerConcept);
    // Dubbele conceptkoppen: de tweede wordt een gewone notitiekolom (voorkomt overschrijven).
    const seen = new Set();
    concepts.forEach((c, i) => { if (c && seen.has(c)) concepts[i] = null; else if (c) seen.add(c); });
    const targetCol = concepts.indexOf('target');
    const kindCol = concepts.indexOf('kind');
    let kindIsTarget = false;
    if (kindCol >= 0 && targetCol < 0) kindIsTarget = rows.slice(1).some(r => targetFromName(cellText(r[kindCol])));
    const known = concepts.filter(Boolean);
    const inferred = inferTableTarget(known);
    rows.slice(1).forEach((row, i) => {
      const n = rowStart + i + 1;
      const rowWarn = [];
      if (row.length > width) {
        const extra = row.slice(width).filter(c => c !== '');
        if (extra.length) rowWarn.push(`${extra.length} extra kolom(men) in rij ${n} toegevoegd aan de notitie`);
      } else if (row.length < width) rowWarn.push(`rij ${n} heeft ${row.length} van ${width} kolommen`);
      let target = null;
      const tcol = targetCol >= 0 ? targetCol : (kindIsTarget ? kindCol : -1);
      if (tcol >= 0) target = targetFromName(cellText(row[tcol]));
      let guessed = false;
      if (!target) target = fallbackTarget;
      if (!target) { target = inferred.target || 'ideas'; guessed = inferred.score < 2; }
      const cs = kindIsTarget ? concepts.map((c, k) => (k === kindCol ? 'target' : c)) : concepts;
      const hdrs = row.length > width ? headers.concat(row.slice(width).map(() => 'Extra')) : headers;
      const cons = row.length > width ? cs.concat(row.slice(width).map(() => null)) : cs;
      const rec = rowToRecord(target, hdrs, cons, row, ref, { ...opts, trip: opts.trip || seg.trip });
      if (target === 'trips' && !rec.section) { const sec = seg.section ? TRAVEL_SECTIONS.find(x => x.name === seg.section) : travelSection(rec.title); rec.section = sec ? sec.name : (seg.section || 'Algemeen'); if (!rec.kind) rec.kind = sec ? sec.type : 'Notitie'; }
      if (!rec.title && !(target === 'trips' && rec.trip)) { warnings.push(`${where(n)}: lege of onleesbare rij overgeslagen`); return; }
      rowWarn.forEach(w => warnings.push(`${seg.file ? seg.file + ': ' : ''}${w}`));
      entries.push(makeEntry(rec, { file: seg.file, where: where(n) }, { uncertain: guessed, warnings: guessed ? ['Bestemming geraden: controleer'] : [] }));
    });
    return { entries, warnings };
  }

  /* ---------- vrije tekst ---------- */
  const GROCERY_UNITS = '(?:x|×|kg|kilo|g|gr|gram|l|liter|ml|cl|dl|stuks?|st|pak(?:ken|je|jes)?|blik(?:ken|je|jes)?|fles(?:sen)?|bos(?:sen)?|zak(?:ken|je|jes)?|doos|dozen|pot(?:ten)?|el|tl|eetlepels?|theelepels?|snee|sneetjes|bakje|bakjes|plak(?:ken|jes)?|bol(?:len)?|teen|tenen|handvol|krop|kroppen|rol(?:len)?|tros|pakjes|tube|tubes)';
  const QTY_FIRST = new RegExp(`^(\\d+(?:[.,]\\d+)?|[¼½¾])\\s*(${GROCERY_UNITS})\\.?\\s+(?:van\\s+|aan\\s+)?(.+)$`, 'i');
  const QTY_ONLY = /^(\d+(?:[.,]\d+)?)\s*[x×]?\s+([A-Za-zÀ-ÿ].*)$/;
  const QTY_LAST = new RegExp(`^(.+?)\\s*[-–:(,]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${GROCERY_UNITS})?\\.?\\)?$`, 'i');
  const GROCERY_CATS = [
    ['Groente', /tomaat|tomaten|sla\b|komkommer|paprika|ui\b|uien|knoflook|wortel|peen|broccoli|spinazie|courgette|aubergine|champignon|prei|bloemkool|spruitjes|sperziebonen|maïs|mais|avocado|aardappel|kool\b|bieslook|gember|spitskool|pompoen/i],
    ['Fruit', /appel|appels|banaan|bananen|peer|peren|sinaasappel|citroen|limoen|druiven|aardbei|aardbeien|framboos|blauwe bes|mango|ananas|kiwi|meloen|fruit/i],
    ['Brood & wraps', /brood|broodje|wrap|wraps|tortilla|bagel|croissant|beschuit|pita|toast/i],
    ['Zuivel & vega', /melk|yoghurt|yogurt|kaas|boter|room\b|kwark|ei\b|eieren|tofu|tempeh|vegetarisch|plantaardig|haverdrink|skyr|feta|mozzarella|halloumi/i],
    ['Vlees & vis', /kip|kipfilet|gehakt|vlees|worst|spek|ham|zalm|vis\b|tonijn|garnalen|biefstuk|rund|varken|filet/i],
    ['Diepvries', /diepvries|bevroren|ijs\b|frozen|vriezer/i],
    ['Voorraadkast', /rijst|pasta|spaghetti|noedels|meel|bloem|suiker|linzen|kikkererwten|bonen|havermout|muesli|cornflakes|couscous|bouillon|olie|blik|conserven|noten|pindakaas|hagelslag|jam\b/i],
    ['Kruiden & sauzen', /peper|zout|kruid|kruiden|saus|ketchup|mayonaise|mosterd|sambal|ketjap|sojasaus|pesto|kerrie|kurkuma|komijn|paprikapoeder|oregano|basilicum|tijm|specerij/i],
    ['Drinken', /water\b|cola|sap\b|thee|koffie|wijn|bier|frisdrank|limonade|drank|spa\b/i],
    ['Schoonmaak', /afwasmiddel|wasmiddel|schoonmaak|toiletpapier|keukenrol|vuilniszak|vuilniszakken|zeep|shampoo|tandpasta|spons|allesreiniger|wc-/i]
  ];
  const guessGroceryCategory = t => (GROCERY_CATS.find(([, rx]) => rx.test(t)) || [''])[0] || 'Overig';

  const TRAVEL_SECTIONS = [
    { name: 'Documenten & gezondheid', type: 'Documenten', rx: /paspoort|visum|visa\b|verzekering|vaccin|medic|gezondheid|dokter|id-kaart|identiteitskaart|boekingsnummer|reserveringsnummer|bevestigingsnummer|referentienummer|ticket|polis|document/i },
    { name: 'Paklijst', type: 'Paklijst', rx: /paklijst|inpakken|meenemen|bagage|koffer|rugzak|handbagage/i },
    { name: 'Vervoer', type: 'Vervoer', rx: /vlucht|flight|vliegtuig|vliegveld|luchthaven|trein|\bbus\b|transfer|taxi|grab\b|veerboot|ferry|cruise|vervoer|autohuur|huurauto|schiphol/i },
    { name: 'Verblijf', type: 'Verblijf', rx: /hotel|hostel|resort|homestay|appartement|airbnb|verblijf|overnacht|accommodat|check-in|check-out|camping|pension/i },
    { name: 'Eten & drinken', type: 'Eten', rx: /restaurant|ontbijt|lunch|diner\b|avondeten|drinken|food/i },
    { name: 'Budget', type: 'Budget', rx: /budget|kosten|prijs|prijzen|totaal|betaalmiddel|contant|valuta|\bvnd\b|\busd\b|\beur\b|€/i },
    { name: 'Activiteiten', type: 'Activiteit', rx: /activiteit|excursie|tour\b|bezoek|museum|strand|hike|wandeling|massage|spa\b|workshop|uitstap|attractie/i },
    { name: 'Boekingen & acties', type: 'Voorbereiding', rx: /boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|afspraak maken|actiepunt|deadline/i },
    { name: 'Route & planning', type: 'Notitie', rx: /route|reisplan|planning|programma|reisschema|itinerary|dagindeling|dag\s+\d+/i }
  ];
  const travelSection = t => TRAVEL_SECTIONS.find(s => s.rx.test(t)) || null;
  const TRAVEL_WORD = /vlucht|flight|vliegveld|luchthaven|hotel|hostel|airbnb|check-in|check-out|boekingsnummer|visum|paspoort|reisplan|vakantie|trein naar|excursie|transfer|paklijst|resort|camping|bagage/i;
  const TASK_WORD = /^(bel|bellen|mail|mailen|boek|boeken|regel|regelen|koop|kopen|betaal|betalen|maak|maken|stuur|sturen|plan|plannen|vraag|vragen|zoek|zoeken|controleer|controleren|check|vul|vullen|zet|zetten|haal|halen|breng|brengen|print|printen|bestel|bestellen|meld|melden|schrijf|schrijven|neem|nemen|leeg|legen|stofzuig|stofzuigen|dweil|dweilen|poets|poetsen|was|wassen|ruim|opruimen|verleng|verlengen|vergeet|onthoud|reserveer|reserveren)\b/i;
  const CHORE_WORD = /\b(todo|to-do|to do|actiepunt|actie:|moet nog|nog doen|taak:|schoonmaken|stofzuigen|afwassen|wassen|strijken|opruimen|poetsen|dweilen|vuilnis|afval)\b/i;
  const HOME_WORD = /\b(kraan|lekkage|reparatie|repareren|schilderen|verf|kitten|kit\b|dakgoot|dak\b|cv-ketel|cv\b|ketel|rookmelder|isolatie|onderhoud|klus|klussen|boiler|slot\b|tuinhek|stopcontact|gordijnen|aannemer|loodgieter|monteur|hypotheek|energielabel|woning|badkamer|zolder|schuur|garage|ventilatie|filter)\b/i;
  const STOCK_WORD = /\b(voorraad|houdbaar|tht\b|in de vriezer|in de kast|in de kelder|op voorraad|nog \d+ over)\b/i;
  const HOME_CATS = [['Badkamer', /badkamer|douche|wc\b|toilet/i], ['Keuken', /keuken|afzuig|vaatwasser/i], ['Tuin', /tuin|schutting|gras|border/i], ['Dak & buiten', /dak\b|dakgoot|gevel|schilder/i], ['Installaties', /cv|ketel|boiler|rookmelder|stopcontact|elektra|loodgieter/i]];
  const IDEA_CATS = [['Uitje', /museum|uitje|dagje|strand|wandel|pretpark|bos\b|stad\b|festival|concert|theater|bioscoop|film/i], ['Eten', /restaurant|dineren|diner|brunch|koken|bakken|picknick|terras/i], ['Thuis', /spelletje|spelavond|film.*thuis|thuis|bordspel|puzzel|bubbelbad|massage/i]];

  const NOISE = /^(pagina\s+\d+(\s+van\s+\d+)?|page\s+\d+(\s+of\s+\d+)?|\d+|[-_=*·.\s]{3,}|–\s*\d+\s*–)$/i;
  const stripBullet = s => s.replace(/^\s*(?:[-*•▪◦‣–—·●○■□☐☑✓✔]|\[[ xX✓]?\]|\d{1,2}[.)](?=\s))\s*/, '').trim();
  const checkState = s => ({ done: /^\s*(?:☑|✓|✔|\[[xX✓]\])/.test(s), box: /^\s*(?:☐|□|\[\s?\]|☑|✓|✔|\[[xX✓]\])/.test(s) });

  function headingContext(text, ctx) {
    let t = norm(text);
    if (!t || t.split(' ').length > 6) return null;
    const trip = text.match(/^(?:reis|reisplan|vakantie|trip)\s*(?:naar|:|-|–)\s*(.+?)\s*:?$/i);
    if (trip && trip[1].length < 60) return { target: 'trips', trip: trip[1].trim(), section: null };
    const recipe = text.match(/^(?:recept|gerecht)\s*[:\-–]\s*(.+?)\s*$/i);
    if (recipe) return { recipe: recipe[1].trim() };
    if (/^(ingredi[eë]nten?)$/.test(t)) return { role: 'ingredients', target: 'groceries' };
    if (/^(bereiding|bereidingswijze|werkwijze|instructies|stappen|bereiden)$/.test(t)) return { role: 'steps', target: 'meals' };
    if (/^(boodschappen|boodschappenlijst|boodschappenlijstje|winkellijst|winkellijstje|grocery list|groceries|grocery|inkopen)$/.test(t)) return { target: 'groceries', role: null };
    if (/^(weekmenu|menu|eetschema|maaltijden|avondeten|diner|lunch|ontbijt)$/.test(t)) return { target: 'meals', role: null };
    if (/^(agenda|afspraken|kalender|planning|programma)$/.test(t)) return { target: 'planning', role: null };
    if (/^(taken|takenlijst|to do|todo|to-do|actiepunten|acties|huishouden|schoonmaak|klusjes|huishoudelijke taken)$/.test(t)) return { target: 'chores', role: null };
    if (/^(voorraad|inventaris|voorraadlijst|vriezer|koelkast|kasten)$/.test(t)) return { target: 'stock', role: null };
    if (/^(woning|onderhoud|klussen|huis|reparaties|woningonderhoud)$/.test(t)) return { target: 'home', role: null };
    if (/^(idee|ideeen|samen doen|date ideeen|uitjes|bucketlist|wensen|dateideeen|date)$/.test(t)) return { target: 'ideas', role: null };
    if (/^(reizen|reis|vakantie|reisplan|travel)$/.test(t)) return { target: 'trips', role: null, section: null };
    const sec = travelSection(text);
    if (sec && (ctx.target === 'trips' || ctx.travelish || isSectionWord(text))) return { target: 'trips', section: sec.name };
    return null;
  }
  const isHeadingLine = s => /^#{1,6}\s+\S/.test(s) || (/:\s*$/.test(s) && s.length <= 60) || (s.length <= 40 && s === s.toUpperCase() && /[A-ZÀ-Ý]{3}/.test(s) && !/\d{3}/.test(s));
  const isSectionWord = s => s.split(/\s+/).length <= 3 && !/\d|[.,;]/.test(s) && !TASK_WORD.test(s) && Boolean(travelSection(s)) && TRAVEL_SECTIONS.some(x => x.name.toLowerCase().startsWith(norm(s).split(' ')[0]) || norm(x.name) === norm(s));

  function detectPerson(s, people) {
    for (const p of people) if (new RegExp(`(^|[^\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(s)) return p;
    return '';
  }
  function detectLocation(s) {
    const m = s.match(/(?:\b(?:in|bij|te|naar|richting)\s+|@\s*)([A-ZÀ-Ý][\wÀ-ÿ'’.-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’.-]+){0,2})/);
    return m ? m[1].replace(/[.,;:]+$/, '') : '';
  }
  const guessBy = (list, text, fallback) => (list.find(([, rx]) => rx.test(text)) || [fallback])[0];

  // Haalt datum, tijd en bedrag uit de tekst en geeft de overgebleven titel terug.
  function pullDateTime(text, ref) {
    let t = text;
    const out = { date: '', endDate: '', time: '', endTime: '', money: null };
    const range = findDateRange(t, ref);
    if (range) { out.date = range.from; out.endDate = range.to; t = t.slice(0, range.index) + ' ' + t.slice(range.index + range.length); }
    const d = findDate(t, ref);
    if (d) { if (out.date) { if (!out.endDate) out.endDate = d.iso; } else out.date = d.iso; t = t.slice(0, d.index) + ' ' + t.slice(d.index + d.length); const d2 = findDate(t, ref); if (d2 && !out.endDate && /(?:t\/m|tot|-|–)\s*$/i.test(t.slice(0, d2.index))) { out.endDate = d2.iso; t = t.slice(0, d2.index) + ' ' + t.slice(d2.index + d2.length); } }
    const tm = findTime(t);
    if (tm) { out.time = tm.start; out.endTime = tm.end; t = t.slice(0, tm.index) + ' ' + t.slice(tm.index + tm.length); }
    const mo = findMoney(t);
    if (mo) { out.money = mo.value; t = t.slice(0, mo.index) + ' ' + t.slice(mo.index + mo.length); }
    t = t.replace(WEEKDAY_STRIP, ' ').replace(/\b(om|op|vanaf|rond|per|tot|t\/m|van|deadline)\s*(?=[-:,.;\s]|$)/gi, ' ');
    t = t.replace(/\s*[-–:,;()]\s*(?=[-–:,;()]|$)/g, ' ').replace(/^[\s\-–:,;()]+|[\s\-–:,;()]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    return { ...out, title: t };
  }
  const WEEKDAY_STRIP = /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo)\b\.?(?=\s|,|$)/gi;

  function parseQuantity(text) {
    let m = text.match(QTY_FIRST);
    if (m) {
      const q = m[1] === '¼' ? 0.25 : m[1] === '½' ? 0.5 : m[1] === '¾' ? 0.75 : parseNumber(m[1], 1);
      const unit = /^[x×]$/i.test(m[2]) ? '' : m[2].toLowerCase().replace(/^gr$/, 'g').replace(/^kilo$/, 'kg');
      return { amount: q, unit, title: m[3].trim() };
    }
    m = text.match(QTY_ONLY);
    if (m && !/^(uur|u|minuten|min|dagen|dag|weken|maanden|jaar|personen|euro)\b/i.test(m[2])) return { amount: parseNumber(m[1], 1), unit: '', title: m[2].trim() };
    m = text.match(QTY_LAST);
    if (m && m[1].split(/\s+/).length <= 5 && /^[A-Za-zÀ-ÿ]/.test(m[1])) return { amount: parseNumber(m[2], 1), unit: (m[3] || '').toLowerCase(), title: m[1].trim() };
    return null;
  }
  const looksLikeGrocery = t => { const q = t.match(QTY_FIRST); return Boolean(q) && !/\b(uur|min|km|euro)\b/i.test(q[2]) && t.split(/\s+/).length <= 6; };

  // Eén regel vrije tekst -> één item (of null bij ruis)
  function lineToEntry(raw, ctx, opts, source) {
    const ref = opts.today;
    const st = checkState(raw);
    let s = stripBullet(raw).replace(/\s+/g, ' ').trim();
    if (s.length < 2 || NOISE.test(s)) return null;
    let target = null, uncertain = false, section = ctx.section, recipeTitle = ctx.recipe && ctx.recipe.rec.title;
    // Expliciete bestemming vooraan: "Boodschappen: melk", of "Maandag: pasta"
    const lead = s.match(/^([A-Za-zÀ-ÿ ]{3,20})\s*[:|]\s*(.+)$/);
    let dayIdx = null;
    if (lead) {
      const lt = targetFromName(lead[1]);
      const wd = WEEKDAYS[norm(lead[1])];
      if (lt) { target = lt; s = lead[2].trim(); }
      else if (wd !== undefined && (ctx.target === 'meals' || opts.target === 'meals' || opts.target === 'auto')) { dayIdx = wd; s = lead[2].trim(); target = 'meals'; }
    }
    const ctxTarget = ctx.target === 'groceries' && opts.target === 'auto' && ctx.role !== 'ingredients' && !/^\s*[-*•]/.test(raw) && TASK_WORD.test(s) ? null : ctx.target;
    if (!target) target = ctxTarget || (opts.target !== 'auto' ? opts.target : null);
    const forced = Boolean(ctxTarget || opts.target !== 'auto' || (lead && target));
    const dt = pullDateTime(s, ref);
    if (!target) {
      if (looksLikeGrocery(s)) target = 'groceries';
      else if (st.box || TASK_WORD.test(s) || CHORE_WORD.test(s)) target = HOME_WORD.test(s) ? 'home' : 'chores';
      else if (TRAVEL_WORD.test(s)) target = 'trips';
      else if (dt.date || dt.time) target = 'planning';
      else if (STOCK_WORD.test(s)) target = 'stock';
      else if (HOME_WORD.test(s)) target = 'home';
      else if (travelSection(s) && ctx.travelish) target = 'trips';
      else { target = 'ideas'; uncertain = true; }
    }
    if (ctx.role === 'steps') { const m = ctx.recipe; if (m) { m.rec.note = m.rec.note ? `${m.rec.note}\n${s}` : s; } return 'consumed'; }
    const rec = emptyRecord(target);
    const people = opts.people;
    const person = detectPerson(s, people);
    let title = dt.title || s;
    const money = dt.money;
    const addMoney = () => { if (money != null) appendNote(rec, `Bedrag: € ${String(roundMoney(money)).replace('.', ',')}`); };
    if (target === 'planning') {
      Object.assign(rec, { title: title, startDate: dt.date || (dayIdx != null ? addDaysISO(weekStart(ref), dayIdx) : ''), startTime: dt.time, endDate: dt.endDate, endTime: dt.endTime, location: detectLocation(title), person });
      if (!dt.time && dt.date) rec.allDay = true;
      addMoney();
    } else if (target === 'meals') {
      const date = dt.date || (dayIdx != null ? addDaysISO(weekStart(ref), dayIdx) : '');
      const type = (s.match(/\b(ontbijt|lunch|diner|avondeten)\b/i) || [])[1];
      Object.assign(rec, { date, mealType: type ? (/diner|avondeten/i.test(type) ? 'Avondeten' : type[0].toUpperCase() + type.slice(1).toLowerCase()) : 'Avondeten', title: title.replace(/^(ontbijt|lunch|diner|avondeten)\s*[:-]\s*/i, ''), persons: '' });
      const pers = s.match(/\b(\d+)\s*(?:personen|porties|pers\.?)\b/i);
      if (pers) { rec.persons = pers[1]; rec.title = rec.title.replace(pers[0], '').trim(); }
      addMoney();
    } else if (target === 'groceries' || target === 'stock') {
      const base = s.replace(/€\s*[\d.,]+|[\d.,]+\s*(?:€|euro)|\s(?:à|a)\s*\d+[.,]\d{2}\b/gi, '').trim();
      const q = parseQuantity(base);
      const best = target === 'stock' ? s.match(/(?:tht|houdbaar tot|best before)\s*:?\s*(.+)$/i) : null;
      let name = q ? q.title : base;
      if (best) { const bd = findDate(best[1], ref); if (bd) { rec.bestBefore = bd.iso; name = name.replace(best[0], '').trim().replace(/[-–,(\s]+$/, ''); } }
      const loc = target === 'stock' ? (s.match(/\bin de (vriezer|koelkast|kast|kelder|voorraadkast|garage)\b/i) || [])[1] : '';
      if (loc) { rec.location = loc[0].toUpperCase() + loc.slice(1); name = name.replace(new RegExp(`\\s*in de ${loc}\\b`, 'i'), '').trim(); }
      name = name.replace(/\s+(?:à|a|per stuk)\s*$/i, '').replace(/[-–,:(\s]+$/, '').replace(/^[-–,:)\s]+/, '');
      Object.assign(rec, { title: name || base, amount: q ? q.amount : (target === 'groceries' ? 1 : ''), unit: q ? q.unit : '', category: guessGroceryCategory(name) });
      if (target === 'stock' && !rec.unit) rec.unit = 'stuks';
      if (target === 'groceries') { rec.done = st.done; if (ctx.role === 'ingredients' && recipeTitle) rec.forMeal = recipeTitle; if (ctx.store) rec.store = ctx.store; }
      addMoney();
    } else if (target === 'chores') {
      const rep = s.match(/\b(dagelijks|wekelijks|maandelijks|jaarlijks|elke \d+ (?:weken|maanden)|elke week|elke maand|iedere week|iedere maand|om de week|kwartaal|halfjaarlijks)\b/i);
      Object.assign(rec, { title: title.replace(rep ? rep[0] : '', '').replace(/[\s,;:-]+$/, '').trim() || title, category: ctx.heading && !headingContext(ctx.heading, ctx) ? ctx.heading : '', repeat: rep ? toRepeat(rep[0]) : '', person: person || '', startDate: dt.date, nextDate: '', priority: /urgent|belangrijk|dringend|!!/i.test(s) ? 'hoog' : '', done: st.done, notes: '' });
      addMoney();
    } else if (target === 'home') {
      Object.assign(rec, { title, category: guessBy(HOME_CATS, s, ctx.heading && !headingContext(ctx.heading, ctx) ? ctx.heading : 'Onderhoud'), deadline: /deadline|uiterlijk|voor\s/i.test(s) ? dt.date : '', startDate: /deadline|uiterlijk|voor\s/i.test(s) ? '' : dt.date, cost: money != null ? roundMoney(money) : '', priority: /urgent|dringend|!!/i.test(s) ? 'hoog' : '', done: st.done });
    } else if (target === 'ideas') {
      Object.assign(rec, { title, category: guessBy(IDEA_CATS, s, 'Thuis'), date: dt.date, person });
      addMoney();
    } else if (target === 'trips') {
      const sec = ctx.section ? TRAVEL_SECTIONS.find(x => x.name === ctx.section) || { name: ctx.section, type: 'Notitie' } : null;
      const found = travelSection(s) || sec || { name: 'Algemeen', type: 'Notitie' };
      const checkable = st.box || /\b(boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|inpakken|meenemen|afspreken|downloaden|printen)\b/i.test(s);
      Object.assign(rec, { trip: ctx.trip || opts.trip || '', section: found.name, title, kind: found.type, startDate: dt.date, endDate: dt.endDate, location: detectLocation(title), cost: money != null ? roundMoney(money) : '', checkable, done: st.done });
    }
    if (!rec.title) return null;
    if (dt.time && target !== 'planning') appendNote(rec, `Tijd: ${dt.time}${dt.endTime ? '–' + dt.endTime : ''}`);
    const out = coerceRecord(rec, ref);
    return makeEntry(out, source, { uncertain, selected: !uncertain, warnings: uncertain ? ['Bestemming onzeker: controleer of deze regel bij Samen doen hoort'] : [] });
  }

  function freeTextEntries(text, opts, source, baseCtx = {}, holder = null) {
    const entries = [];
    const ctx = { target: null, role: null, section: null, trip: '', heading: '', recipe: null, travelish: false, lastPlain: '', ...baseCtx };
    const lines = String(text).replace(/\u00ad/g, '').split(/\r?\n/);
    let pendingHeading = '';
    if (holder) holder.ctx = ctx;
    lines.forEach((rawLine, idx) => {
      const line = rawLine.replace(/\s+$/, '');
      if (!line.trim()) { return; }
      let s = line.trim().replace(/^#{1,6}\s+/, '');
      if (/^(\s*[#]|\s*\/\/)/.test(line) && !/^#{1,6}\s+\S/.test(line)) return; // commentaarregel
      const src = { ...source, where: `${source.where ? source.where + ', ' : ''}regel ${idx + 1 + (source.lineOffset || 0)}` };
      // Gestructureerde regel (bestaand formaat)? Dan expliciet verwerken.
      if (hasExplicitDelimiter(s) || /^(?:agenda|planning|weekmenu|boodschappen|huishouden|voorraad|idee|woning|reizen|reis)\s*[-/]\s/i.test(s)) {
        const parts = splitStructured(stripBullet(s));
        const lead = leadingTarget(parts);
        const t = lead || (opts.target !== 'auto' ? opts.target : ctx.target);
        if (t && parts.length >= 2 && (lead || hasExplicitDelimiter(s))) {
          const rec = recordFromParts(t, lead ? parts.slice(1) : parts, opts.today);
          if (t === 'trips' && !rec.trip) rec.trip = ctx.trip || opts.trip || '';
          if (rec.title || t === 'trips') { entries.push(makeEntry(rec, src)); return; }
        }
      }
      if (isHeadingLine(s) || /^#{1,6}\s/.test(line) || /^(?:reis|reisplan|vakantie|trip)\s*(?:naar|:|-|–)\s*[^|;\t]{2,60}$/i.test(s) || (!/^\s*(?:[-*•▪◦‣–—·●○■□☐☑✓✔]|\[)/.test(line) && (isSectionWord(s) || (s.split(/\s+/).length <= 3 && !/\d/.test(s) && (m => m && m.target && !m.recipe && !m.section)(headingContext(s, ctx)))))) {
        const text = s.replace(/:\s*$/, '').trim();
        const h = headingContext(text, ctx);
        if (h) {
          if (h.recipe) {
            const rec = coerceRecord({ ...emptyRecord('meals'), title: h.recipe }, opts.today);
            const e = makeEntry(rec, src); entries.push(e); ctx.recipe = e; ctx.target = 'meals'; ctx.role = null; return;
          }
          if (h.role === 'ingredients' && !ctx.recipe && pendingHeading) {
            const rec = coerceRecord({ ...emptyRecord('meals'), title: pendingHeading }, opts.today);
            const e = makeEntry(rec, src); entries.push(e); ctx.recipe = e;
          }
          if (h.role !== 'ingredients' && h.role !== 'steps' && h.target !== 'groceries') ctx.recipe = h.target === 'meals' ? ctx.recipe : null;
          ctx.target = h.target || ctx.target; ctx.role = h.role || null;
          if ('section' in h) ctx.section = h.section;
          if (h.trip) ctx.trip = h.trip;
          ctx.travelish = ctx.target === 'trips';
          if (h.target === 'trips' && !h.section) ctx.section = null;
          ctx.heading = text;
          return;
        }
        // Onbekende kop: bewaren als context (map/categorie) en als mogelijke receptnaam.
        ctx.heading = text; pendingHeading = text; ctx.role = null;
        if (ctx.target === 'trips') ctx.section = text;
        if (/^#{1,6}\s/.test(line) || (isHeadingLine(s) && !/\d/.test(text))) return;
      }
      if (ctx.recipe && ctx.role === 'ingredients') {
        const e = lineToEntry(line, ctx, opts, src);
        if (e && e !== 'consumed') {
          entries.push(e);
          const r = ctx.recipe.rec; r.ingredients = r.ingredients ? `${r.ingredients}, ${e.rec.title}` : e.rec.title;
        }
        return;
      }
      const e = lineToEntry(line, ctx, opts, src);
      if (e && e !== 'consumed') entries.push(e);
    });
    return entries;
  }

  /* ---------- JSON ---------- */
  const JSON_KEYS = { planning: 'planning', meals: 'meals', groceries: 'groceries', chores: 'chores', stock: 'stock', ideas: 'ideas', home: 'home', trips: 'trips' };
  function jsonToSegments(value, file) {
    const segs = [];
    const asTable = (rows, hint, loc) => {
      const objs = rows.filter(r => r && typeof r === 'object' && !Array.isArray(r));
      if (!objs.length) return;
      const keys = []; objs.forEach(o => Object.keys(o).forEach(k => { if (!keys.includes(k) && typeof o[k] !== 'object') keys.push(k); }));
      const kk = keys.filter(k => !/^(id|uuid|createdAt|updatedAt)$/i.test(k));
      segs.push({ kind: 'table', file, hint, location: loc, rows: [kk, ...objs.map(o => kk.map(k => (typeof o[k] === 'number' || typeof o[k] === 'boolean') ? (typeof o[k] === 'boolean' ? (o[k] ? 'ja' : 'nee') : o[k]) : (o[k] ?? '')))] });
    };
    if (Array.isArray(value)) {
      if (value.every(v => v && typeof v === 'object' && !Array.isArray(v))) asTable(value, null, 'JSON-lijst');
      else segs.push({ kind: 'text', file, location: 'JSON-lijst', text: value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join('\n') });
      return segs;
    }
    if (value && typeof value === 'object') {
      let any = false;
      Object.entries(value).forEach(([k, v]) => {
        const t = JSON_KEYS[k] || targetFromName(k);
        if (Array.isArray(v) && t) { any = true; asTable(v, t, `JSON "${k}"`); }
      });
      if (!any) {
        const lines = [];
        const walk = (v, path) => {
          if (v == null || v === '') return;
          if (Array.isArray(v)) { if (v.every(x => typeof x !== 'object')) lines.push(`${path}: ${v.join(', ')}`); else v.forEach((x, i) => walk(x, `${path}[${i + 1}]`)); }
          else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, path ? `${path} › ${k}` : k));
          else lines.push(path ? `${path}: ${v}` : String(v));
        };
        walk(value, '');
        segs.push({ kind: 'text', file, location: 'JSON', text: lines.join('\n') });
      }
    }
    return segs;
  }

  /* ---------- RTF ---------- */
  function rtfToText(rtf) {
    const s = String(rtf);
    const skip = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'generator', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'xmlnstbl', 'fldinst', 'mmathPr']);
    let out = '', depth = 0, skipDepth = -1, uc = 1, skipChars = 0;
    const stack = [];
    const cp1252 = new TextDecoder('windows-1252');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '{') { stack.push(uc); depth++; continue; }
      if (ch === '}') { depth--; uc = stack.pop() ?? 1; if (skipDepth >= 0 && depth < skipDepth) skipDepth = -1; continue; }
      if (ch === '\\') {
        const n = s[i + 1];
        if (n === '\\' || n === '{' || n === '}') { if (skipDepth < 0) out += n; i++; continue; }
        if (n === "'") { const hex = s.slice(i + 2, i + 4); if (skipChars > 0) skipChars--; else if (skipDepth < 0) out += cp1252.decode(new Uint8Array([parseInt(hex, 16)])); i += 3; continue; }
        if (n === '*') { skipDepth = skipDepth < 0 ? depth : skipDepth; i++; continue; }
        const m = s.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
        if (!m) { i++; continue; }
        const word = m[1], param = m[2] !== undefined ? Number(m[2]) : null;
        i += m[0].length;
        if (skip.has(word) && skipDepth < 0) skipDepth = depth;
        if (skipDepth < 0) {
          if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') out += '\n';
          else if (word === 'tab') out += '\t';
          else if (word === 'cell') out += '\t';
          else if (word === 'row') out += '\n';
          else if (word === 'bullet') out += '•';
          else if (word === 'emdash') out += '—';
          else if (word === 'endash') out += '–';
          else if (word === 'lquote' || word === 'rquote') out += "'";
          else if (word === 'ldblquote' || word === 'rdblquote') out += '"';
          else if (word === 'u' && param !== null) { out += String.fromCharCode(param < 0 ? param + 65536 : param); skipChars = uc; }
          else if (word === 'uc' && param !== null) uc = param;
        }
        continue;
      }
      if (skipDepth >= 0) continue;
      if (ch === '\r' || ch === '\n') continue;
      if (skipChars > 0) { skipChars--; continue; }
      out += ch;
    }
    return out.replace(/\t+\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- tekst met scheidingstekens als tabel herkennen ---------- */
  function textToSegments(text, file, location) {
    const clean = String(text).replace(/\r\n?/g, '\n');
    const delim = detectDelimiter(clean);
    if (delim) {
      const rows = parseDelimited(clean, delim);
      const hasHeader = looksLikeHeader(rows);
      const widths = rows.map(r => r.length);
      const modal = Math.max(...widths);
      const consistent = rows.filter(r => r.length === modal).length / rows.length >= 0.7;
      // Een gewoon tekstbestand met toevallige komma's is geen tabel: alleen puntkomma/tab/pipe of herkende kolomkoppen.
      if (rows.length >= 2 && consistent && (hasHeader || delim !== ',')) {
        if (hasHeader || !rows.some(r => leadingTarget(r))) {
          if (hasHeader) return [{ kind: 'table', file, location, rows, delimiter: delim }];
        }
      }
    }
    return [{ kind: 'text', file, location, text: clean }];
  }

  /* ---------- analyse van gelezen bestanden ---------- */
  function describeStatus(status) {
    return { ok: 'Succesvol gelezen', partial: 'Gedeeltelijk gelezen', unreadable: 'Niet leesbaar', unsupported: 'Bestandstype niet ondersteund', 'analysis-failed': 'Analyse mislukt' }[status] || status;
  }
  const normTitle = s => norm(s).replace(/\b(de|het|een)\b/g, '').replace(/\s+/g, ' ').trim();
  function signature(target, rec) {
    const t = normTitle(rec.title);
    if (target === 'planning') return `${t}|${rec.startDate || rec.date || ''}|${rec.startTime || rec.time || ''}`;
    if (target === 'meals') return `${t}|${rec.date || ''}|${norm(rec.mealType || rec.type || 'avondeten')}`;
    if (target === 'trips') return `${normTitle(rec.trip || '')}|${t}|${rec.startDate || rec.date || ''}`;
    if (target === 'home') return `${t}|${rec.deadline || rec.due || ''}`;
    return t;
  }
  function existingSignatures(data) {
    const sets = {};
    Object.keys(SCHEMAS).forEach(t => { sets[t] = new Set(); });
    const d = data || {};
    (d.planning || []).forEach(x => sets.planning.add(signature('planning', { title: x.title, startDate: x.date, startTime: x.time })));
    (d.meals || []).forEach(x => sets.meals.add(signature('meals', { title: x.title, date: x.date, mealType: x.type })));
    (d.groceries || []).filter(x => !x.done).forEach(x => sets.groceries.add(signature('groceries', x)));
    (d.chores || []).forEach(x => sets.chores.add(signature('chores', x)));
    (d.stock || []).forEach(x => sets.stock.add(signature('stock', x)));
    (d.ideas || []).forEach(x => sets.ideas.add(signature('ideas', x)));
    (d.home || []).forEach(x => sets.home.add(signature('home', { title: x.title, deadline: x.due })));
    const folders = new Map((d.tripFolders || []).map(f => [f.id, f.name]));
    (d.trips || []).forEach(x => sets.trips.add(signature('trips', { trip: folders.get(x.tripFolderId) || '', title: x.title, startDate: x.startDate || x.date })));
    return sets;
  }
  // Markeert dubbele items (t.o.v. bestaande data en binnen dezelfde import). Dubbele items staan standaard uit.
  function markDuplicates(entries, data) {
    const existing = existingSignatures(data), seen = new Set();
    entries.forEach(e => {
      const sig = `${e.target}:${signature(e.target, e.rec)}`;
      const inApp = existing[e.target] && existing[e.target].has(signature(e.target, e.rec));
      const inBatch = seen.has(sig);
      e.dupOf = inApp ? 'bestaand' : inBatch ? 'import' : '';
      if (e.rec.title && sig.length > e.target.length + 1) seen.add(sig);
      const was = e.duplicate;
      e.duplicate = Boolean(e.dupOf);
      if (e.duplicate && !was && !e.userTouchedSelection) e.selected = false;
      if (!e.duplicate && was && !e.userTouchedSelection && !e.uncertain) e.selected = true;
    });
    return entries;
  }

  function normalizeOpts(o = {}) {
    return { target: o.target && (o.target === 'auto' || SCHEMAS[o.target]) ? o.target : 'auto', today: o.today || new Date().toISOString().slice(0, 10), trip: o.trip || '', people: o.people && o.people.length ? o.people : ['Kees', 'Daphne'], data: o.data || null };
  }

  // reads: [{name, status, message, warnings, segments:[{kind:'text'|'table', ...}]}] of een enkele tekstinvoer
  function analyse(reads, options) {
    const opts = normalizeOpts(options);
    const entries = [], reports = [];
    reads.forEach(read => {
      const report = { name: read.name, type: read.type || '', status: read.status, message: read.message || '', warnings: [...(read.warnings || [])], count: 0, stats: read.stats || {} };
      reports.push(report);
      if (read.status === 'unreadable' || read.status === 'unsupported' || !read.segments || !read.segments.length) {
        if (read.status === 'ok' && (!read.segments || !read.segments.length)) { report.status = 'unreadable'; report.message = report.message || 'Geen inhoud gevonden in dit bestand'; }
        return;
      }
      try {
        const mine = [];
        let carry = null;
        read.segments.forEach(seg => {
          const o = { ...opts };
          const prev = carry && carry.ctx ? { target: carry.ctx.target, section: carry.ctx.section, trip: carry.ctx.trip, heading: carry.ctx.heading, travelish: carry.ctx.travelish } : {};
          if (seg.kind === 'table') {
            const hint = seg.hint || (seg.location && targetFromName((seg.location.match(/werkblad '([^']+)'/) || [])[1])) || (opts.target === 'auto' ? prev.target : null) || null;
            const res = tableToEntries({ ...seg, file: read.name, hint, section: prev.section, trip: prev.trip }, o);
            mine.push(...res.entries); report.warnings.push(...res.warnings);
          } else {
            const src = { file: read.name, where: seg.location || '', lineOffset: seg.lineOffset || 0 };
            const base = { ...prev, ...(seg.hint ? { target: seg.hint } : {}) };
            const holder = {};
            mine.push(...freeTextEntries(seg.text, o, src, base, holder));
            carry = holder;
          }
        });
        report.count = mine.length;
        entries.push(...mine);
        if (!mine.length && report.status !== 'unreadable') {
          report.status = 'partial'; report.message = (report.message ? report.message + ' ' : '') + 'Er is tekst gelezen, maar er zijn geen onderdelen herkend. Controleer de bestemming of voeg onderdelen zelf toe.';
        }
        if (report.warnings.length && report.status === 'ok') report.status = 'partial';
      } catch (err) {
        report.status = 'analysis-failed';
        report.message = `Analyse van dit bestand is mislukt: ${err && err.message ? err.message : err}`;
      }
    });
    markDuplicates(entries, opts.data);
    return { entries, reports };
  }

  // Zelf getypte of geplakte tekst wordt behandeld als een bestand.
  function textRead(text, name = 'Ingevoerde tekst') {
    const t = String(text || '');
    if (!t.trim()) return { name, type: 'tekst', status: 'unreadable', message: 'Er is geen tekst ingevoerd.', warnings: [], segments: [], stats: { chars: 0 } };
    return { name, type: 'tekst', status: 'ok', message: '', warnings: [], segments: textToSegments(t, name, 'ingevoerde tekst'), stats: { chars: t.length, lines: t.split(/\n/).length } };
  }

  // Maakt de definitieve app-items. Geen verwijzing naar het bronbestand, alleen gewone items.
  function buildItem(rec, ctx) {
    const r = coerceRecord(rec, ctx.today);
    const mk = ctx.id;
    switch (rec.target) {
      case 'planning': return { id: mk(), title: r.title || 'Afspraak', date: r.startDate, time: r.startTime, endDate: r.endDate || r.startDate, endTime: r.endTime, allDay: r.allDay, location: r.location, note: r.description, repeat: r.repeat, person: r.person || 'Samen', calendarId: ctx.calendarId };
      case 'meals': return { id: mk(), title: r.title || 'Maaltijd', date: r.date, type: r.mealType || 'Avondeten', persons: r.persons, ingredients: r.ingredients, note: r.note };
      case 'groceries': return { id: mk(), title: r.title || 'Product', amount: r.amount === '' ? 1 : r.amount, unit: r.unit, category: r.category || 'Overig', store: r.store, forMeal: r.forMeal, done: r.done, note: r.note };
      case 'chores': return { id: mk(), title: r.title || 'Taak', category: r.category, repeat: r.repeat, person: r.person || 'Samen', due: r.startDate || r.nextDate, nextDate: r.nextDate, priority: r.priority, done: r.done, notes: r.notes, secondWeekday: '', completedDates: [] };
      case 'stock': return { id: mk(), title: r.title || 'Product', category: r.category || 'Overig', amount: r.amount === '' ? 0 : r.amount, unit: r.unit || 'stuks', min: r.minimum === '' ? 0 : r.minimum, desired: Math.max(r.minimum === '' ? 0 : r.minimum, r.amount === '' ? 0 : r.amount), bestBefore: r.bestBefore, location: r.location, note: r.note };
      case 'ideas': return { id: mk(), title: r.title || 'Idee', category: r.category || 'Thuis', note: [r.description, r.note].filter(Boolean).join('\n'), person: r.person, priority: r.priority, status: r.status, date: r.date, icon: '♡' };
      case 'home': return { id: mk(), title: r.title || 'Woningitem', category: r.category || 'Onderhoud', note: [r.description, r.note].filter(Boolean).join('\n'), kind: r.kind, priority: r.priority, startDate: r.startDate, due: r.deadline || r.startDate, status: r.status, cost: r.cost === '' ? 0 : r.cost, done: r.done, repeat: '' };
      case 'trips': {
        const start = r.startDate || r.deadline;
        const extras = [];
        if (r.location) extras.push(`Locatie: ${r.location}`);
        if (r.cost !== '' && r.cost != null) extras.push(`Kosten: € ${String(r.cost).replace('.', ',')}`);
        if (r.priority) extras.push(`Prioriteit: ${r.priority}`);
        if (r.note) extras.push(r.note);
        return { id: mk(), title: r.title || 'Reisitem', date: start, startDate: start, endDate: r.endDate || start, type: r.kind || 'Notitie', note: [r.description, ...extras].filter(Boolean).join('\n'), checkable: r.checkable, important: r.priority === 'hoog', done: r.done };
      }
      default: return null;
    }
  }

  // Voegt geselecteerde items toe aan `data`. Raakt alleen de lijsten van de gekozen bestemmingen
  // (en reismappen/-onderdelen) aan; budget, instellingen en overige gegevens blijven onaangeroerd.
  function applyEntries(data, entries, ctx) {
    const counts = {}, failed = [];
    const same = (a, b) => norm(a) === norm(b);
    const folderFor = name => {
      data.tripFolders = data.tripFolders || [];
      const wanted = String(name || '').trim() || 'Nieuwe reis';
      let f = data.tripFolders.find(x => same(x.name, wanted));
      if (!f) { f = { id: ctx.id(), name: wanted, startDate: '', endDate: '', note: 'Aangemaakt via universele import' }; data.tripFolders.push(f); }
      return f;
    };
    const sectionFor = (folderId, name) => {
      data.tripSections = data.tripSections || [];
      const wanted = String(name || '').trim() || 'Algemeen';
      let sec = data.tripSections.find(x => x.tripFolderId === folderId && same(x.name, wanted));
      if (!sec) { sec = { id: ctx.id(), tripFolderId: folderId, name: wanted }; data.tripSections.push(sec); }
      return sec;
    };
    entries.forEach(e => {
      try {
        if (!String(e.rec.title || '').trim()) throw new Error('titel ontbreekt');
        const item = buildItem(e.rec, ctx);
        if (!item) throw new Error('onbekende bestemming');
        if (e.target === 'trips') {
          const folder = folderFor(e.rec.trip || ctx.trip);
          const sec = sectionFor(folder.id, e.rec.section);
          item.tripFolderId = folder.id; item.tripSectionId = sec.id;
          if (item.startDate && !folder.startDate) folder.startDate = item.startDate;
          if (item.endDate && !folder.endDate) folder.endDate = item.endDate;
        }
        if (!Array.isArray(data[e.target])) data[e.target] = [];
        data[e.target].push(item);
        counts[e.target] = (counts[e.target] || 0) + 1;
        e.imported = true;
      } catch (err) { failed.push(`${e.rec.title || '(zonder titel)'}: ${err.message}`); }
    });
    return { counts, failed };
  }

  return {
    applyEntries, TARGETS, SCHEMAS, DATE_KEYS, TIME_KEYS, NUM_KEYS, BOOL_KEYS, PRIMARY_DATE, TRAVEL_SECTIONS, ALIASES,
    parseNumber, findDate, findDateRange, findTime, findMoney, toISODate, toTime, toBool, toPriority, toRepeat,
    decodeBytes, parseDelimited, detectDelimiter, headerConcept, targetFromName, rtfToText,
    textToSegments, jsonToSegments, tableToEntries, freeTextEntries, analyse, textRead, describeStatus,
    emptyRecord, convertRecord, coerceRecord, makeEntry, signature, existingSignatures, markDuplicates, buildItem, norm,
    splitStructured, leadingTarget, recordFromParts, looksLikeHeader, guessGroceryCategory, travelSection
  };
});
