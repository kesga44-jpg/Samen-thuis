import { loadState, persistState } from './state.js';

let state = loadState();
let toastTimer;

/** Haken die app.js zet; houdt modules los van elkaar. */
export const hooks = { rerender: () => {}, afterSave: () => {} };

export const getState = () => state;
export const setState = next => { state = next; return state; };
export const render = () => hooks.rerender();

export function toast(message) {
  const el = globalThis.document?.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

export function save(message = '', { touch = true, sync = true } = {}) {
  try {
    if (touch) state.meta.updatedAt = new Date().toISOString();
    persistState(state);
    const badge = globalThis.document?.querySelector('#saveState');
    if (badge) badge.textContent = 'Lokaal bewaard';
    if (message) toast(message);
    if (sync) hooks.afterSave();
    return true;
  } catch {
    toast('Opslag niet beschikbaar');
    return false;
  }
}
