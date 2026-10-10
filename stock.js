import { escapeHtml as esc, toNumber } from './utils.js';
import { getState, save, render } from './store.js';

export const stockUnit = item => item.unit || '';
export const stockAmount = item => toNumber(item.amount);
export const isLow = item => toNumber(item.min) > 0 && stockAmount(item) < toNumber(item.min);

/** Laag-eerst, daarna alfabetisch. */
export const sortStock = items => items.slice().sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || String(a.name).localeCompare(String(b.name)));
export const lowStock = items => items.filter(isLow);
export const adjustStock = (item, delta) => { item.amount = Math.max(0, +(stockAmount(item) + delta).toFixed(2)); return item; };

export function stockRow(item) {
  const low = isLow(item);
  return `<li class="list-card"><div><strong>${esc(item.name)}</strong><small>${esc(stockAmount(item))} ${esc(stockUnit(item))}${item.min ? ` · min ${esc(item.min)}` : ''}${item.desired ? ` · gewenst ${esc(item.desired)}` : ''}</small></div><span class="tag ${low ? 'tag-warn' : 'green'}">${low ? 'Aanvullen' : 'Op peil'}</span><button type="button" class="icon-button" data-act="stock:adjust" data-delta="-1" data-id="${esc(item.id)}" aria-label="Minder">−</button><button type="button" class="icon-button" data-act="stock:adjust" data-delta="1" data-id="${esc(item.id)}" aria-label="Meer">+</button><button type="button" class="icon-button" data-act="edit" data-page="stock" data-id="${esc(item.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-delete="stock" data-id="${esc(item.id)}" aria-label="Verwijderen">×</button></li>`;
}

export function renderStock(state = getState()) {
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${state.stock.length} items · ${lowStock(state.stock).length} bijna op</p><h2>Voorraad</h2></div></div><ul class="data-list">${sortStock(state.stock).map(stockRow).join('') || '<li class="empty-row">Geen voorraad.</li>'}</ul></section>`;
}

export const actions = {
  'stock:adjust'(el) { const item = getState().stock.find(i => i.id === el.dataset.id); if (item) { adjustStock(item, Number(el.dataset.delta)); save(); render(); } }
};
