import Core from './core.js';
import { addDays, escapeHtml as esc, fmtDate, fmtMoney, startOfWeek, todayKey, toNumber, uid } from './utils.js';
import { getState, save, render, toast } from './store.js';
import { openFormDialog } from './dialogs.js';
import { fetchWithRetry } from './api.js';

export const RDW_URL = 'https://opendata.rdw.nl/resource/m9d7-ebf2.json';
export const normalizePlate = plate => String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function parseRdwRecord(row = {}) {
  const apk = String(row.vervaldatum_apk_dt || row.vervaldatum_apk || '');
  const apkDate = /^\d{8}$/.test(apk) ? `${apk.slice(0, 4)}-${apk.slice(4, 6)}-${apk.slice(6, 8)}` : /^\d{4}-\d{2}-\d{2}/.test(apk) ? apk.slice(0, 10) : '';
  const first = String(row.datum_eerste_toelating || '');
  return {
    plate: normalizePlate(row.kenteken),
    model: [row.merk, row.handelsbenaming].filter(Boolean).join(' ').trim(),
    year: /^\d{4}/.test(first) ? first.slice(0, 4) : '',
    apkDate
  };
}

export async function lookupPlate(plate, fetcher = globalThis.fetch) {
  const clean = normalizePlate(plate);
  if (!/^[A-Z0-9]{4,8}$/.test(clean)) throw new Error('Ongeldig kenteken');
  const response = await fetchWithRetry(`${RDW_URL}?kenteken=${encodeURIComponent(clean)}`, { fetcher });
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('Kenteken niet gevonden');
  return parseRdwRecord(rows[0]);
}

export const newVehicle = (values = {}) => ({ id: uid(), model: '', plate: '', year: '', mileage: '', apkDate: '', insuranceDate: '', ...values });

/** Vervangt de automatische APK-afspraken (+ herinnering 30 dagen eerder) van een voertuig in de agenda. */
export function syncApkAgenda(state, vehicle) {
  state.agenda = state.agenda.filter(item => item.vehicleId !== vehicle.id);
  if (!vehicle.apkDate) return state.agenda;
  const label = vehicle.plate || vehicle.model || 'auto';
  const base = { person: 'Samen', calendarId: 'persoonlijk', auto: true, vehicleId: vehicle.id, time: '', endTime: '' };
  state.agenda.push({ ...base, id: uid(), title: `APK-vervaldatum ${label}`, date: vehicle.apkDate });
  state.agenda.push({ ...base, id: uid(), title: `APK herinnering ${label} (over 30 dagen)`, date: addDays(vehicle.apkDate, -30) });
  return state.agenda;
}

export function apkWarnings(state, today = todayKey(), days = 60) {
  return state.vehicles.filter(v => v.apkDate && v.apkDate <= addDays(today, days)).map(v => ({ vehicle: v, expired: v.apkDate < today }));
}

/* ---------- Tankbeurten / FuelMate ---------- */
export function parseFuelMate(text, carId) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  let rows;
  if (/^[[{]/.test(trimmed)) {
    const parsed = JSON.parse(trimmed);
    rows = Array.isArray(parsed) ? parsed : parsed.fillUps || parsed.fills || parsed.fuelEntries || parsed.entries || [];
  } else {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
    const header = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    rows = lines.slice(1).map(line => Object.fromEntries(line.split(delimiter).map((cell, i) => [header[i], cell.trim().replace(/^"|"$/g, '')])));
  }
  return rows.filter(row => row && typeof row === 'object').map(row => Core.normalizeFuelMateFill(row, carId, uid()))
    .filter(f => f.date && (f.liters > 0 || f.total > 0));
}

const signature = f => `${f.carId}|${f.date}|${f.odometer}|${f.liters}`;
export const mergeFuel = (existing, incoming) => Core.mergeUnique(existing, incoming, signature);

/** Verbruik (L/100km) tussen opeenvolgende volle tankbeurten; gedeeltelijke tankbeurten tellen mee in de liters. */
export function consumptionSeries(entries) {
  const sorted = entries.filter(e => e.odometer > 0).sort((a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date));
  const out = [];
  let baseline = null, litres = 0;
  sorted.forEach(entry => {
    if (entry.missedPrevious) { baseline = entry.partialFill ? null : entry.odometer; litres = 0; return; }
    if (baseline === null) { if (!entry.partialFill) { baseline = entry.odometer; litres = 0; } return; }
    litres += toNumber(entry.liters);
    if (entry.partialFill) return;
    const km = entry.odometer - baseline;
    if (km > 0 && litres > 0) out.push({ date: entry.date, l100: litres / km * 100, km });
    baseline = entry.odometer; litres = 0;
  });
  return out;
}

export function filterPeriod(entries, period, today = todayKey()) {
  const from = period === 'week' ? startOfWeek(today) : period === 'month' ? `${today.slice(0, 7)}-01` : period === 'year' ? `${today.slice(0, 4)}-01-01` : '';
  return from ? entries.filter(e => e.date >= from && e.date <= today) : entries.slice();
}

const group = (entries, keyFn) => {
  const map = new Map();
  entries.forEach(e => map.set(keyFn(e), (map.get(keyFn(e)) || 0) + toNumber(e.total)));
  return [...map.entries()];
};
const WEEKDAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

export function fuelStats(entries) {
  const series = consumptionSeries(entries);
  const l100 = series.map(s => s.l100);
  const avg = l100.length ? l100.reduce((a, b) => a + b, 0) / l100.length : 0;
  const sd = l100.length > 1 ? Math.sqrt(l100.reduce((n, v) => n + (v - avg) ** 2, 0) / l100.length) : 0;
  const priced = entries.filter(e => e.pricePerLiter > 0);
  const weekday = Array(7).fill(0);
  entries.forEach(e => { const d = new Date(`${e.date}T12:00:00`); if (!Number.isNaN(d.getTime())) weekday[d.getDay()] += toNumber(e.total); });
  return {
    count: entries.length,
    totalCost: entries.reduce((n, e) => n + toNumber(e.total), 0),
    totalLiters: entries.reduce((n, e) => n + toNumber(e.liters), 0),
    avgL100: avg,
    consistency: l100.length > 1 ? Math.max(0, Math.round(100 - (sd / (avg || 1)) * 100)) : null,
    records: {
      best: l100.length ? Math.min(...l100) : null, worst: l100.length ? Math.max(...l100) : null,
      cheapest: priced.length ? Math.min(...priced.map(e => e.pricePerLiter)) : null,
      priciest: priced.length ? Math.max(...priced.map(e => e.pricePerLiter)) : null,
      biggest: entries.length ? Math.max(...entries.map(e => toNumber(e.liters))) : null
    },
    costOverTime: group(entries, e => e.date.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])),
    byWeekday: [1, 2, 3, 4, 5, 6, 0].map(i => [WEEKDAYS[i], weekday[i]]),
    byStation: group(entries.filter(e => e.station), e => e.station).sort((a, b) => b[1] - a[1])
  };
}

/* ---------- UI ---------- */
const ui = { tab: 'fills', period: 'month', selected: null };
const bars = rows => { const max = Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([l, v]) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar"><i style="width:${Math.round(v / max * 100)}%"></i></div><b>${fmtMoney(v)}</b></div>`).join('') || '<p class="muted">Geen gegevens.</p>'}</div>`; };
const TABS = [['fills', 'Tankbeurten'], ['fuel', 'Tanken'], ['stats', 'Statistieken'], ['vehicles', 'Voertuigen']];
const VEHICLE_FIELDS = [{ name: 'plate', label: 'Kenteken' }, { name: 'model', label: 'Model' }, { name: 'year', label: 'Bouwjaar' }, { name: 'mileage', label: 'Kilometerstand' }, { name: 'apkDate', label: 'APK-datum', type: 'date' }, { name: 'insuranceDate', label: 'Verzekering tot', type: 'date' }];
const FILL_FIELDS = [{ name: 'date', label: 'Datum', type: 'date', required: true }, { name: 'odometer', label: 'Kilometerstand', type: 'number' }, { name: 'liters', label: 'Liters', type: 'number', step: '0.01', required: true }, { name: 'total', label: 'Totaalbedrag (€)', type: 'number', step: '0.01' }, { name: 'pricePerLiter', label: 'Prijs per liter (€)', type: 'number', step: '0.001' }, { name: 'station', label: 'Station' }, { name: 'partialFill', label: 'Gedeeltelijke tankbeurt', type: 'checkbox' }];

const selectedIds = state => (ui.selected ? ui.selected.filter(id => state.vehicles.some(v => v.id === id)) : state.vehicles.map(v => v.id));

export function renderCar(state = getState(), today = todayKey()) {
  const tabs = `<div class="tabs" role="tablist">${TABS.map(([id, l]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" class="tab ${ui.tab === id ? 'is-active' : ''}" data-act="auto:tab" data-tab="${id}">${l}</button>`).join('')}</div>`;
  const ids = selectedIds(state);
  const entries = state.fuelEntries.filter(e => ids.includes(e.carId)).sort((a, b) => b.date.localeCompare(a.date));
  let body = '';
  if (ui.tab === 'fills') {
    body = `<ul class="data-list">${entries.map(e => `<li class="list-card"><div><strong>${esc(fmtDate(e.date))} · ${esc(e.liters)} L · ${fmtMoney(e.total)}</strong><small>${esc([e.odometer && `${e.odometer} km`, e.pricePerLiter && `${fmtMoney(e.pricePerLiter)}/L`, e.station, e.partialFill && 'gedeeltelijk'].filter(Boolean).join(' · '))}</small></div><button type="button" class="icon-button task-delete" data-act="auto:delete-fill" data-id="${esc(e.id)}" aria-label="Verwijderen">×</button></li>`).join('') || '<li class="empty-row">Nog geen tankbeurten.</li>'}</ul>`;
  } else if (ui.tab === 'fuel') {
    body = `<div class="button-row"><button type="button" class="button button-primary" data-act="auto:add-fill">⛽ Tankbeurt toevoegen</button><button type="button" class="button button-secondary" data-act="goto" data-page="imports">FuelMate importeren</button></div>`;
  } else if (ui.tab === 'stats') {
    const s = fuelStats(filterPeriod(entries, ui.period, today));
    const f = v => (v == null ? '–' : v.toFixed(2));
    body = `<div class="button-row">${['week', 'month', 'year'].map(p => `<button type="button" class="button button-small ${ui.period === p ? 'button-primary' : 'button-secondary'}" data-act="auto:period" data-period="${p}">${{ week: 'Week', month: 'Maand', year: 'Jaar' }[p]}</button>`).join('')}</div>
      <div class="vehicle-select">${state.vehicles.map(v => `<label class="inline-check"><input type="checkbox" data-act-change="auto:select" data-id="${esc(v.id)}" ${ids.includes(v.id) ? 'checked' : ''}> ${esc(v.plate || v.model || 'Auto')}</label>`).join('')}</div>
      <div class="stats-row"><div class="stat"><strong>${fmtMoney(s.totalCost)}</strong><small>Kosten</small></div><div class="stat"><strong>${s.totalLiters.toFixed(1)} L</strong><small>Liters</small></div><div class="stat"><strong>${f(s.avgL100)}</strong><small>L/100km</small></div><div class="stat"><strong>${s.consistency == null ? '–' : `${s.consistency}%`}</strong><small>Consistentie</small></div></div>
      <p class="small-note">Records: zuinigst ${f(s.records.best)} · minst zuinig ${f(s.records.worst)} L/100km · goedkoopst ${f(s.records.cheapest)} · duurst ${f(s.records.priciest)} €/L · grootste tankbeurt ${f(s.records.biggest)} L</p>
      <h3>Kosten over tijd</h3>${bars(s.costOverTime)}<h3>Per weekdag</h3>${bars(s.byWeekday)}<h3>Per station</h3>${bars(s.byStation)}`;
  } else {
    body = `<ul class="data-list">${state.vehicles.map(v => `<li class="list-card"><div><strong>${esc(v.model || 'Auto')} ${esc(v.plate)}</strong><small>${esc([v.year, v.mileage && `${v.mileage} km`, v.apkDate && `APK ${fmtDate(v.apkDate)}`, v.insuranceDate && `Verzekering ${fmtDate(v.insuranceDate)}`].filter(Boolean).join(' · '))}</small></div><button type="button" class="icon-button" data-act="auto:edit-vehicle" data-id="${esc(v.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-act="auto:delete-vehicle" data-id="${esc(v.id)}" aria-label="Verwijderen">×</button></li>`).join('') || '<li class="empty-row">Nog geen voertuigen.</li>'}</ul><div class="button-row"><button type="button" class="button button-primary" data-act="auto:add-vehicle">＋ Voertuig toevoegen</button></div>`;
  }
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${state.vehicles.length} voertuig(en)</p><h2>Auto</h2></div></div>${tabs}${body}</section>`;
}

function mirrorFirstVehicle(state) {
  const first = state.vehicles[0];
  if (first) state.car = { ...state.car, ...Object.fromEntries(VEHICLE_FIELDS.map(f => [f.name, first[f.name] || ''])) };
}

function vehicleDialog(vehicle) {
  const dlg = openFormDialog({
    title: vehicle ? 'Voertuig bewerken' : 'Voertuig toevoegen', fields: VEHICLE_FIELDS, values: vehicle || {},
    body: '<div class="button-row"><button type="button" class="button button-secondary button-small" data-rdw>RDW-gegevens ophalen</button></div>',
    onSubmit: v => {
      const state = getState();
      const target = vehicle || newVehicle();
      Object.assign(target, { ...v, plate: normalizePlate(v.plate) });
      if (!vehicle) state.vehicles.push(target);
      syncApkAgenda(state, target); mirrorFirstVehicle(state);
      save('Voertuig opgeslagen'); render(); return true;
    }
  });
  dlg.querySelector('[data-rdw]').addEventListener('click', async () => {
    const form = dlg.querySelector('form');
    try {
      const info = await lookupPlate(form.elements.plate.value);
      ['model', 'year', 'apkDate'].forEach(k => { if (info[k]) form.elements[k].value = info[k]; });
      form.elements.plate.value = info.plate;
      toast('RDW-gegevens opgehaald');
    } catch (error) { toast(`RDW opzoeken mislukt: ${error.message}`); }
  });
}

export const actions = {
  'auto:tab'(el) { ui.tab = el.dataset.tab; render(); },
  'auto:period'(el) { ui.period = el.dataset.period; render(); },
  'auto:select'(el) {
    const state = getState(), ids = new Set(selectedIds(state));
    if (el.checked) ids.add(el.dataset.id); else ids.delete(el.dataset.id);
    ui.selected = [...ids]; render();
  },
  'auto:add-vehicle'() { vehicleDialog(null); },
  'auto:edit-vehicle'(el) { const v = getState().vehicles.find(x => x.id === el.dataset.id); if (v) vehicleDialog(v); },
  'auto:delete-vehicle'(el) {
    const state = getState();
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Voertuig en bijbehorende tankbeurten verwijderen?')) return;
    state.vehicles = state.vehicles.filter(v => v.id !== el.dataset.id);
    state.fuelEntries = state.fuelEntries.filter(e => e.carId !== el.dataset.id);
    state.agenda = state.agenda.filter(i => i.vehicleId !== el.dataset.id);
    save('Verwijderd'); render();
  },
  'auto:add-fill'() {
    const state = getState();
    if (!state.vehicles.length) return toast('Voeg eerst een voertuig toe');
    openFormDialog({
      title: 'Tankbeurt toevoegen', submit: 'Toevoegen', values: { date: todayKey() },
      fields: [{ name: 'carId', label: 'Voertuig', type: 'select', options: state.vehicles.map(v => [v.id, v.plate || v.model || 'Auto']) }, ...FILL_FIELDS],
      onSubmit: v => {
        const liters = toNumber(v.liters), total = toNumber(v.total);
        if (!(liters > 0)) { toast('Vul het aantal liters in'); return false; }
        const ppl = toNumber(v.pricePerLiter) || (total && liters ? total / liters : 0);
        getState().fuelEntries.push({ id: uid(), carId: v.carId, date: v.date || todayKey(), odometer: toNumber(v.odometer), liters, total: total || +(ppl * liters).toFixed(2), pricePerLiter: ppl, station: v.station, partialFill: v.partialFill, fuelGrade: '', missedPrevious: false, note: '' });
        save('Tankbeurt toegevoegd'); ui.tab = 'fills'; render(); return true;
      }
    });
  },
  'auto:delete-fill'(el) { const s = getState(); s.fuelEntries = s.fuelEntries.filter(e => e.id !== el.dataset.id); save('Verwijderd'); render(); }
};
