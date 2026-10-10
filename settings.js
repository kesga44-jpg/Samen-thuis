import { escapeHtml as esc, todayKey } from './utils.js';
import { normalizeDashboard, mergeState, defaultState } from './state.js';
import { getState, setState, save, render, toast } from './store.js';
import { WIDGET_LABELS } from './dashboard.js';
import { renderSyncPanel } from './sync.js';
import { mergeBackup } from './imports.js';
import { download, exportPrices, importPrices } from './prices.js';
import { openFormDialog } from './dialogs.js';

export const resolveTheme = (mode, prefersDark) => (mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode === 'dark' ? 'dark' : 'light');

export function applyTheme(state = getState()) {
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(state.themeMode, prefersDark);
  root.dataset.appearance = state.appearance;
  root.dataset.density = state.density;
  root.style.setProperty('--accent-minimal', state.minimalColor);
}

export function renderSettings() {
  const state = getState();
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const dash = normalizeDashboard(state.dashboard, state.showQuote);
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Weergave</p><h2>Instellingen</h2></div></div>
    <div class="setting-row"><label>Thema <select data-setting="theme">${opt('system', 'Systeem', state.themeMode)}${opt('light', 'Licht', state.themeMode)}${opt('dark', 'Donker', state.themeMode)}</select></label></div>
    <div class="setting-row"><label>Uiterlijk <select data-setting="appearance">${opt('normal', 'Normaal', state.appearance)}${opt('minimal', 'Minimalistisch', state.appearance)}</select></label></div>
    <div class="setting-row"><label>Dichtheid <select data-setting="density">${opt('comfortable', 'Ruim', state.density)}${opt('compact', 'Compact', state.density)}</select></label></div>
    <div class="setting-row"><label>Accentkleur <input type="color" data-setting="minimalColor" value="${esc(state.minimalColor)}"></label></div>
    <p class="small-note">Thema, uiterlijk, dichtheid en accentkleur gelden alleen voor dit apparaat.</p>
    <h3>Dashboard samenstellen</h3>
    ${dash.map((w, i, a) => `<div class="setting-row"><label><input type="checkbox" data-dash-toggle="${w.id}" ${w.visible ? 'checked' : ''}> ${esc(WIDGET_LABELS[w.id] || w.id)}</label><span><button type="button" class="icon-button" data-dash-move="${w.id}" data-dir="-1" aria-label="Omhoog" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="icon-button" data-dash-move="${w.id}" data-dir="1" aria-label="Omlaag" ${i === a.length - 1 ? 'disabled' : ''}>↓</button></span></div>`).join('')}
    <div class="setting-row"><button type="button" class="button button-secondary button-small" data-dash-reset>Standaard dashboard herstellen</button></div></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Gegevens</p><h2>Back-up & prijzen</h2></div></div>
    <p class="small-note">Gegevens worden lokaal in je browser bewaard. Maak regelmatig een back-up.</p>
    <div class="button-row"><button type="button" class="button button-primary" data-action="backup">Back-up maken</button><button type="button" class="button button-secondary" data-action="restore">Back-up laden</button><button type="button" class="button button-secondary" data-action="import-prices">Prijzen importeren</button><button type="button" class="button button-secondary" data-action="export-prices">Prijzen exporteren</button></div></section>
    ${renderSyncPanel()}</div>`;
}

export function handleSetting(name, value) {
  const state = getState();
  if (name === 'theme') { state.themeMode = value; state.theme = resolveTheme(value, globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches); }
  else if (name === 'appearance') state.appearance = value;
  else if (name === 'density') state.density = value === 'compact' ? 'compact' : 'comfortable';
  else if (name === 'minimalColor') state.minimalColor = value;
  else return;
  applyTheme(state);
  save('Opgeslagen', { sync: false });
}

export function toggleDashboard(id, visible) {
  const state = getState();
  state.dashboard = normalizeDashboard(state.dashboard, state.showQuote).map(w => (w.id === id ? { ...w, visible } : w));
  if (id === 'quote') state.showQuote = visible;
  save('Opgeslagen');
}

export function moveDashboard(id, dir) {
  const state = getState();
  const list = normalizeDashboard(state.dashboard, state.showQuote);
  const i = list.findIndex(w => w.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  state.dashboard = list;
  save('Opgeslagen'); render();
}

export function resetDashboard() {
  const state = getState();
  state.dashboard = normalizeDashboard([], true);
  state.showQuote = true;
  save('Dashboard hersteld'); render();
}

/* ---------- Back-up ---------- */
export async function exportData() {
  const name = `samen-thuis-backup-${todayKey()}.json`;
  const text = JSON.stringify(getState(), null, 2);
  const file = typeof File === 'function' ? new File([text], name, { type: 'application/json' }) : null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Samen Thuis back-up' }); toast('Back-up gedeeld'); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  download(name, text, 'application/json');
  toast('Back-up gemaakt');
}

export function restoreData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let raw;
    try { raw = JSON.parse(reader.result); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('ongeldig'); }
    catch { toast('Back-up kon niet worden geladen'); return; }
    openFormDialog({
      title: 'Back-up laden', intro: 'Samenvoegen voegt alleen ontbrekende items toe. Vervangen wist je huidige gegevens op dit apparaat.',
      fields: [{ name: 'mode', label: 'Hoe wil je laden?', type: 'select', options: [['merge', 'Samenvoegen (aanbevolen)'], ['replace', 'Vervangen']] }], submit: 'Laden',
      onSubmit: ({ mode }) => {
        if (mode === 'replace') {
          if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Alle huidige gegevens vervangen door deze back-up?')) return false;
          setState(mergeState(defaultState(), raw));
          applyTheme();
          save('Back-up geladen');
        } else {
          const { added } = mergeBackup(getState(), raw);
          save(`Samengevoegd: ${added} nieuwe items`);
        }
        render();
        return true;
      }
    });
  };
  reader.onerror = () => toast('Back-up kon niet worden geladen');
  reader.readAsText(file);
}

export const dataActions = {
  backup: exportData,
  restore: () => document.querySelector('#restoreInput')?.click(),
  'import-prices': () => document.querySelector('#priceFileInput')?.click(),
  'export-prices': exportPrices
};

export { importPrices };
