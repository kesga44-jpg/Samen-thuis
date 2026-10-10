import { escapeHtml as esc, fmtMoney, todayKey, toNumber, uid } from './utils.js';
import { getState, save, render, toast } from './store.js';
import { openFormDialog } from './dialogs.js';

export const PERIODS = [['maand', 'Per maand'], ['kwartaal', 'Per kwartaal'], ['jaar', 'Per jaar']];
const DIVISOR = { maand: 1, kwartaal: 3, jaar: 12 };

export const monthlyAmount = item => toNumber(item.amount) / (DIVISOR[item.period] || 1);
const sum = (items, fn) => items.reduce((n, item) => n + fn(item), 0);

export function budgetKpis(budget) {
  const net = toNumber(budget.incomeKees) + toNumber(budget.incomeDaphne);
  const pct = Math.min(100, Math.max(0, toNumber(budget.contributionPct)));
  const afdracht = net * pct / 100;
  const fixed = sum(budget.fixed || [], monthlyAmount);
  const house = sum(budget.houseCategories || [], i => toNumber(i.amount));
  const goals = sum(budget.goals || [], g => toNumber(g.monthly));
  const invest = toNumber(budget.invest);
  const needed = fixed + house + goals + invest;
  const spent = sum(budget.items || [], i => toNumber(i.amount));
  return { net, pct, afdracht, fixed, house, goals, invest, needed, balance: afdracht - needed, spent, monthly: toNumber(budget.monthly) };
}

export function goalProjection(goal, today = todayKey()) {
  const remaining = Math.max(0, toNumber(goal.target) - toNumber(goal.saved));
  const progress = toNumber(goal.target) > 0 ? Math.min(100, Math.round(toNumber(goal.saved) / toNumber(goal.target) * 100)) : 0;
  if (remaining === 0) return { remaining, progress: 100, months: 0, date: today };
  if (toNumber(goal.monthly) <= 0) return { remaining, progress, months: null, date: '' };
  const months = Math.ceil(remaining / toNumber(goal.monthly));
  const date = new Date(`${today}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return { remaining, progress, months, date: todayKey(date) };
}

export function donut(percent, label) {
  const r = 40, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, percent));
  return `<svg class="donut" viewBox="0 0 100 100" role="img" aria-label="${esc(label)}: ${p}%"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--green)" stroke-width="12" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="55" text-anchor="middle" class="donut-text">${p}%</text></svg>`;
}

const listRows = (kind, items, fmt) => items.map(i => `<li class="list-card"><div><strong>${esc(i.name)}</strong><small>${esc(fmt(i))}</small></div><button type="button" class="icon-button task-delete" data-act="budget:delete" data-kind="${kind}" data-id="${esc(i.id)}" aria-label="Verwijderen">×</button></li>`).join('') || '<li class="empty-row">Nog niets.</li>';

export function renderBudget(state = getState(), today = todayKey()) {
  const b = state.budget, k = budgetKpis(b);
  const kpi = (label, value, tone = '') => `<div class="stat ${tone}"><strong>${value}</strong><small>${esc(label)}</small></div>`;
  const goals = (b.goals || []).map(g => { const p = goalProjection(g, today); return `<li class="list-card goal-row">${donut(p.progress, g.name)}<div><strong>${esc(g.name)}</strong><small>${fmtMoney(g.saved)} van ${fmtMoney(g.target)} · ${fmtMoney(g.monthly)}/mnd${p.months === null ? ' · geen prognose' : p.months === 0 ? ' · bereikt' : ` · klaar in ${p.months} mnd (${esc(p.date)})`}</small></div><button type="button" class="button button-secondary button-small" data-act="budget:deposit" data-id="${esc(g.id)}">＋ Storten</button><button type="button" class="icon-button task-delete" data-act="budget:delete" data-kind="goals" data-id="${esc(g.id)}" aria-label="Verwijderen">×</button></li>`; }).join('') || '<li class="empty-row">Nog geen spaardoelen.</li>';
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Deze maand</p><h2>Budgetoverzicht</h2></div></div>
    <div class="stats-row">${kpi('Netto inkomen', fmtMoney(k.net))}${kpi(`Afdracht (${k.pct}%)`, fmtMoney(k.afdracht))}${kpi('Nodig', fmtMoney(k.needed))}${kpi(k.balance >= 0 ? 'Over' : 'Tekort', fmtMoney(Math.abs(k.balance)), k.balance >= 0 ? 'good' : 'bad')}</div>
    <div class="button-row"><button type="button" class="button button-secondary" data-act="budget:income">Inkomen en afdracht aanpassen</button></div>
    <p class="small-note">Kees ${fmtMoney(b.incomeKees)} · Daphne ${fmtMoney(b.incomeDaphne)} · beleggen ${fmtMoney(b.invest)}/mnd</p></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Maandbudget</p><h2>${fmtMoney(b.monthly)} · uitgegeven ${fmtMoney(k.spent)}</h2></div></div>
    <form class="inline-form" data-form="budget:monthly"><input name="monthly" type="number" min="0" step="0.01" value="${esc(b.monthly)}" aria-label="Maandbudget"><button class="button button-secondary">Budget opslaan</button></form>
    <form class="inline-form" data-form="budget:item"><input name="name" placeholder="Uitgave" required><input name="amount" type="number" step="0.01" min="0" placeholder="Bedrag" required><button class="button button-primary">Toevoegen</button></form>
    <ul class="data-list">${b.items.map(i => `<li class="list-card"><div><strong>${esc(i.name)}</strong><small>${fmtMoney(i.amount)}</small></div><button type="button" class="icon-button" data-delete="budget" data-id="${esc(i.id)}" aria-label="Verwijderen">×</button></li>`).join('') || '<li class="empty-row">Nog geen uitgaven.</li>'}</ul></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">${fmtMoney(k.fixed)}/mnd</p><h2>Vaste lasten</h2></div><button type="button" class="button button-secondary button-small" data-act="budget:add-fixed">＋</button></div><ul class="data-list">${listRows('fixed', b.fixed, i => `${fmtMoney(i.amount)} ${i.period}`)}</ul></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">${fmtMoney(k.house)}/mnd</p><h2>Huisbudget</h2></div><button type="button" class="button button-secondary button-small" data-act="budget:add-house">＋</button></div><ul class="data-list">${listRows('houseCategories', b.houseCategories, i => fmtMoney(i.amount))}</ul></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">${fmtMoney(k.goals)}/mnd</p><h2>Spaardoelen</h2></div><button type="button" class="button button-secondary button-small" data-act="budget:add-goal">＋</button></div><ul class="data-list">${goals}</ul></section></div>`;
}

const amountField = { name: 'amount', label: 'Bedrag', type: 'number', step: '0.01', required: true };
const add = (kind, extra) => values => {
  if (!values.name) return false;
  getState().budget[kind].push({ id: uid(), name: values.name, amount: toNumber(values.amount), ...extra?.(values) });
  save('Toegevoegd'); render(); return true;
};

export const forms = {
  'budget:monthly'(data) { getState().budget.monthly = Math.max(0, toNumber(data.monthly)); save('Budget opgeslagen'); render(); },
  'budget:item'(data) { getState().budget.items.unshift({ id: uid(), name: data.name, amount: toNumber(data.amount) }); save('Toegevoegd'); render(); }
};

export const actions = {
  'budget:income'() {
    const b = getState().budget;
    openFormDialog({
      title: 'Inkomen en afdracht', values: b,
      fields: [{ name: 'incomeKees', label: 'Netto inkomen Kees', type: 'number', step: '0.01' }, { name: 'incomeDaphne', label: 'Netto inkomen Daphne', type: 'number', step: '0.01' }, { name: 'contributionPct', label: 'Afdracht naar huishouden (%)', type: 'number', step: '1' }, { name: 'invest', label: 'Beleggen per maand', type: 'number', step: '0.01' }],
      onSubmit: v => {
        const pct = toNumber(v.contributionPct);
        if (pct < 0 || pct > 100) { toast('Afdracht moet tussen 0 en 100% liggen'); return false; }
        Object.assign(b, { incomeKees: toNumber(v.incomeKees), incomeDaphne: toNumber(v.incomeDaphne), contributionPct: pct, invest: Math.max(0, toNumber(v.invest)) });
        save('Opgeslagen'); render(); return true;
      }
    });
  },
  'budget:add-fixed'() { openFormDialog({ title: 'Vaste last toevoegen', fields: [{ name: 'name', label: 'Naam', required: true }, amountField, { name: 'period', label: 'Periode', type: 'select', options: PERIODS }], submit: 'Toevoegen', onSubmit: add('fixed', v => ({ period: DIVISOR[v.period] ? v.period : 'maand' })) }); },
  'budget:add-house'() { openFormDialog({ title: 'Huisbudget-categorie', fields: [{ name: 'name', label: 'Categorie', required: true }, amountField], submit: 'Toevoegen', onSubmit: add('houseCategories') }); },
  'budget:add-goal'() {
    openFormDialog({
      title: 'Spaardoel toevoegen', submit: 'Toevoegen',
      fields: [{ name: 'name', label: 'Doel', required: true }, { name: 'target', label: 'Doelbedrag', type: 'number', step: '0.01', required: true }, { name: 'saved', label: 'Al gespaard', type: 'number', step: '0.01' }, { name: 'monthly', label: 'Per maand sparen', type: 'number', step: '0.01' }],
      onSubmit: v => { if (!v.name) return false; getState().budget.goals.push({ id: uid(), name: v.name, target: toNumber(v.target), saved: toNumber(v.saved), monthly: toNumber(v.monthly) }); save('Toegevoegd'); render(); return true; }
    });
  },
  'budget:deposit'(el) {
    const goal = getState().budget.goals.find(g => g.id === el.dataset.id);
    if (goal) openFormDialog({ title: `Storten op ${goal.name}`, fields: [{ ...amountField, label: 'Bedrag' }], submit: 'Storten', onSubmit: v => { goal.saved = toNumber(goal.saved) + toNumber(v.amount); save('Gestort'); render(); return true; } });
  },
  'budget:delete'(el) {
    const list = getState().budget[el.dataset.kind];
    if (Array.isArray(list)) { getState().budget[el.dataset.kind] = list.filter(i => i.id !== el.dataset.id); save('Verwijderd'); render(); }
  }
};
