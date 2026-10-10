import Core from './core.js';
import { escapeHtml as esc } from './utils.js';
import { defaultState, mergeState } from './state.js';
import { getState, setState, save, render, toast, hooks } from './store.js';

export const SYNC_KEY = 'samenThuisV2-sync';
export const CONFLICT_KEY = 'samenThuisV2-sync-conflict';
export const DEVICE_KEYS = ['currentPage', 'theme', 'themeMode', 'density', 'appearance', 'minimalColor', 'weather', 'showQuote', 'dashboard'];
export const MIN_CODE = 12;
export const AUTO_SYNC_MS = 30000;

const clone = value => structuredClone(value);
const emptyConfig = () => ({ projectUrl: '', anonKey: '', householdCode: '', lastSyncedAt: '' });
const conflicts = Core.createConflictStore(globalThis.localStorage ?? { getItem: () => null, setItem() {}, removeItem() {} }, CONFLICT_KEY);

function loadSyncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {};
    return { projectUrl: String(c.projectUrl || ''), anonKey: String(c.anonKey || ''), householdCode: String(c.householdCode || ''), lastSyncedAt: String(c.lastSyncedAt || '') };
  } catch { return emptyConfig(); }
}

let config = loadSyncConfig();
let syncing = false, syncError = '', syncTimer, intervalId;

export const syncPayload = st => { const o = { ...st }; DEVICE_KEYS.forEach(k => delete o[k]); return o; };
const validProjectUrl = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
export const syncConfigured = () => validProjectUrl(config.projectUrl) && !!config.anonKey && config.householdCode.length >= MIN_CODE;
export const conflictPending = () => Boolean(conflicts.get());
const saveConfig = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(config)); } catch { toast('Opslag niet beschikbaar'); } };

export const conditionalPatchUrl = (base, id, rowUpdatedAt) => `${base.replace(/\/+$/, '')}/rest/v1/household_data?id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(rowUpdatedAt)}`;

/** Bepaalt wat een synchronisatie moet doen: upload | download | conflict | none. */
export function decideSync({ localUpdated, remoteUpdated, lastSyncedAt, localData, remoteData }) {
  if (!remoteData) return 'upload';
  if (Core.hasConcurrentChanges(localUpdated, remoteUpdated, lastSyncedAt, localData, remoteData)) return 'conflict';
  if (!lastSyncedAt) return localUpdated && !Core.sameData(localData, remoteData) ? 'conflict' : 'download';
  if (Date.parse(remoteUpdated) > (Date.parse(localUpdated) || 0)) return 'download';
  return Core.sameData(localData, remoteData) ? 'none' : 'upload';
}

export function syncStatusText() {
  if (!syncConfigured()) return 'Alleen dit apparaat';
  if (conflictPending()) return 'Sync-conflict: kies een versie';
  if (!navigator.onLine) return 'Offline · later synchroniseren';
  if (syncing) return 'Synchroniseren…';
  if (syncError) return 'Sync controleren';
  if (config.lastSyncedAt) return `Gesynchroniseerd ${new Date(config.lastSyncedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  return 'Sync gereed';
}

export function updateSyncBadge() {
  const b = document.querySelector('#syncState');
  if (!b) return;
  b.textContent = syncStatusText();
  b.classList.toggle('connected', syncConfigured() && !syncing && !syncError && !conflictPending());
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
function headers() {
  const h = { apikey: config.anonKey, 'Content-Type': 'application/json' };
  if (!config.anonKey.startsWith('sb_publishable_')) h.Authorization = 'Bearer ' + config.anonKey;
  return h;
}

async function fetchRemote(base, id) {
  const res = await fetch(`${base}/rest/v1/household_data?id=eq.${id}&select=payload,updated_at`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase gaf ${res.status}`);
  const rows = await res.json();
  const remote = rows[0]?.payload ? await decryptData(rows[0].payload, config.householdCode) : null;
  return { remote, rowUpdatedAt: rows[0]?.updated_at || '', exists: rows.length > 0 };
}

/** Uploadt versleuteld; bestaande rijen worden alleen bijgewerkt als `updated_at` nog overeenkomt (conditionele PATCH). */
export async function uploadSyncData(base, id, data, updatedAt, expectedRowUpdatedAt, fetcher = fetch) {
  const body = JSON.stringify({ id, payload: await encryptData(data, config.householdCode), updated_at: updatedAt });
  if (expectedRowUpdatedAt) {
    const res = await fetcher(conditionalPatchUrl(base, id, expectedRowUpdatedAt), { method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' }, body });
    if (!res.ok) throw new Error(`Opslaan gaf ${res.status}`);
    return Core.conditionalUpdateSucceeded(await res.json());
  }
  const res = await fetcher(`${base}/rest/v1/household_data`, { method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Opslaan gaf ${res.status}`);
  return true;
}

function applyRemote(remote) {
  const device = Object.fromEntries(DEVICE_KEYS.map(k => [k, getState()[k]]));
  setState({ ...mergeState(defaultState(), remote), ...device });
  save('', { touch: false, sync: false });
  render();
}

export async function syncNow({ manual = false } = {}) {
  if (!syncConfigured() || syncing || !navigator.onLine) {
    if (manual) toast(!navigator.onLine ? 'Geen internetverbinding' : 'Vul eerst de synchronisatie-instellingen in');
    return;
  }
  if (conflictPending()) { if (manual) toast('Los eerst het synchronisatie-conflict op (Instellingen)'); return; }
  syncing = true; syncError = ''; updateSyncBadge();
  try {
    if (!(window.crypto && crypto.subtle)) throw new Error('Versleuteling vereist HTTPS');
    const id = await sha256(config.householdCode);
    const base = config.projectUrl.replace(/\/+$/, '');
    const { remote, rowUpdatedAt } = await fetchRemote(base, id);
    const state = getState();
    const localUpdated = state.meta.updatedAt, remoteUpdated = remote?.meta?.updatedAt || rowUpdatedAt || '';
    const local = syncPayload(state);
    const remoteData = remote ? syncPayload(mergeState(defaultState(), remote)) : null;
    const decision = decideSync({ localUpdated, remoteUpdated, lastSyncedAt: config.lastSyncedAt, localData: local, remoteData });
    if (decision === 'conflict') {
      conflicts.store({ localData: clone(state), remoteData: remote, localUpdatedAt: localUpdated, remoteUpdatedAt: remoteUpdated, rowUpdatedAt, detectedAt: new Date().toISOString() });
      toast('Op beide apparaten is gewijzigd. Kies een versie bij Instellingen.');
      if (getState().currentPage === 'settings') render();
      return;
    }
    if (decision === 'download') applyRemote(remote);
    else if (decision === 'upload') {
      if (!await uploadSyncData(base, id, local, localUpdated || new Date().toISOString(), remote ? rowUpdatedAt : '')) throw new Error('Een ander apparaat was eerder; synchroniseer opnieuw');
    }
    config.lastSyncedAt = new Date().toISOString();
    saveConfig();
    if (manual) toast('Apparaten zijn bijgewerkt');
  } catch (err) {
    console.error('Synchronisatie mislukt', err);
    syncError = err.message || 'Synchronisatie mislukt';
    if (manual) toast('Synchronisatie lukt nog niet. Controleer de instellingen.');
  } finally { syncing = false; updateSyncBadge(); }
}

export async function resolveConflict(choice) {
  const conflict = conflicts.get();
  if (!conflict) return;
  syncing = true; updateSyncBadge();
  try {
    const id = await sha256(config.householdCode);
    const base = config.projectUrl.replace(/\/+$/, '');
    const current = await fetchRemote(base, id);
    if (Core.remoteChangedSinceChoice(conflict.remoteData, current.remote)) {
      conflicts.store({ ...conflict, remoteData: current.remote, rowUpdatedAt: current.rowUpdatedAt, remoteUpdatedAt: current.remote?.meta?.updatedAt || current.rowUpdatedAt });
      toast('Het externe bestand is intussen gewijzigd. Kies opnieuw.');
      render();
      return;
    }
    const now = new Date().toISOString();
    const { data } = Core.resolveSyncConflict(conflict, choice, clone, now);
    if (choice === 'local') {
      const merged = mergeState(defaultState(), data);
      const ok = await uploadSyncData(base, id, syncPayload(merged), now, current.exists ? current.rowUpdatedAt : '');
      if (!ok) { toast('Upload geweigerd: extern is intussen gewijzigd'); return; }
      applyRemote(data);
    } else applyRemote(data);
    conflicts.clear();
    config.lastSyncedAt = new Date().toISOString();
    saveConfig();
    toast(choice === 'local' ? 'Lokale versie bewaard' : 'Externe versie overgenomen');
  } catch (err) {
    console.error('Conflict oplossen mislukt', err);
    syncError = err.message || 'Conflict oplossen mislukt';
    toast('Conflict oplossen lukt nog niet');
  } finally { syncing = false; updateSyncBadge(); render(); }
}

export function scheduleSync() {
  if (!syncConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 1200);
}

/** Automatische sync: elke 30s (alleen zichtbare tab) en bij focus/zichtbaar worden. */
export function startAutoSync() {
  if (intervalId) return;
  intervalId = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, AUTO_SYNC_MS);
  window.addEventListener('focus', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
}

export function handleSyncForm(data) {
  const next = { projectUrl: String(data.projectUrl || '').trim(), anonKey: String(data.anonKey || '').trim(), householdCode: String(data.householdCode || '').trim() };
  if (next.projectUrl && !validProjectUrl(next.projectUrl)) return toast('Gebruik een https-projecturl');
  if (next.householdCode && next.householdCode.length < MIN_CODE) return toast(`Kies een huishoudcode van minimaal ${MIN_CODE} tekens`);
  const changed = ['projectUrl', 'anonKey', 'householdCode'].some(k => next[k] !== config[k]);
  config = { ...config, ...next, lastSyncedAt: changed ? '' : config.lastSyncedAt };
  if (changed) conflicts.clear();
  syncError = '';
  saveConfig();
  toast(syncConfigured() ? 'Synchronisatie opgeslagen' : 'Opgeslagen; vul alle velden in om te synchroniseren');
  render(); updateSyncBadge();
  if (syncConfigured()) syncNow({ manual: true });
}

export function renderSyncPanel() {
  const configured = syncConfigured();
  const conflict = conflicts.get();
  const fmt = v => (v ? new Date(v).toLocaleString('nl-NL') : 'onbekend');
  const card = conflict ? `<div class="conflict-card" role="alert"><strong>Sync-conflict</strong><p>Op beide apparaten is gewijzigd sinds de laatste synchronisatie. Lokaal: ${esc(fmt(conflict.localUpdatedAt))} · extern: ${esc(fmt(conflict.remoteUpdatedAt))}. Kies welke versie je bewaart.</p><div class="button-row"><button type="button" class="button button-primary" data-act="sync:keep-local">Lokale versie bewaren</button><button type="button" class="button button-secondary" data-act="sync:keep-remote">Externe versie overnemen</button></div></div>` : '';
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Apparaten</p><h2>Synchronisatie (optioneel)</h2></div><span class="panel-icon">${configured ? '✓' : '○'}</span></div>
    <p class="small-note">Standaard blijft alles alleen op dit apparaat. Vul je eigen Supabase-project en een gedeelde geheime huishoudcode in om te synchroniseren. Gegevens worden versleuteld met de huishoudcode voordat ze worden verstuurd. Status: ${esc(syncStatusText())}.</p>${card}
    <form class="stack-form form-grid" data-form="sync:config">
      <div class="field"><label>Project-URL<input name="projectUrl" type="url" value="${esc(config.projectUrl)}" placeholder="https://jouwproject.supabase.co" autocomplete="off"></label></div>
      <div class="field"><label>Publishable / anon key<input name="anonKey" type="password" value="${esc(config.anonKey)}" autocomplete="off"></label></div>
      <div class="field"><label>Huishoudcode (minimaal ${MIN_CODE} tekens)<input name="householdCode" type="password" value="${esc(config.householdCode)}" minlength="${MIN_CODE}" autocomplete="off"></label></div>
      <div class="button-row"><button class="button button-primary">Bewaren</button>${configured ? '<button type="button" class="button button-secondary" data-act="sync:now">Nu synchroniseren</button><button type="button" class="button button-secondary" data-act="sync:clear">Synchronisatie uitzetten</button>' : ''}</div>
    </form></section>`;
}

export const forms = { 'sync:config': handleSyncForm };
export const actions = {
  'sync:now'() { syncNow({ manual: true }); },
  'sync:clear'() { config = emptyConfig(); conflicts.clear(); saveConfig(); toast('Synchronisatie uitgezet'); render(); updateSyncBadge(); },
  'sync:keep-local'() { resolveConflict('local'); },
  'sync:keep-remote'() { resolveConflict('remote'); }
};

hooks.afterSave = scheduleSync;
