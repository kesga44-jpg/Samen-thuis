import { escapeHtml as esc } from './utils.js';

export function fieldMarkup(field, values = {}) {
  const value = values[field.name] ?? field.value ?? '';
  const name = esc(field.name);
  let control;
  if (field.type === 'select') {
    control = `<select name="${name}">${(field.options || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  } else if (field.type === 'textarea') {
    control = `<textarea name="${name}" rows="${field.rows || 5}" ${field.required ? 'required' : ''}>${esc(value)}</textarea>`;
  } else if (field.type === 'checkbox') {
    return `<div class="field"><label class="inline-check"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}> ${esc(field.label)}</label></div>`;
  } else {
    control = `<input name="${name}" type="${esc(field.type || 'text')}" value="${esc(value)}" ${field.step ? `step="${esc(field.step)}"` : ''} ${field.required ? 'required' : ''}>`;
  }
  return `<div class="field"><label>${esc(field.label)}${control}</label></div>`;
}

export function readForm(form, fields) {
  const data = new FormData(form);
  const out = {};
  fields.forEach(f => { out[f.name] = f.type === 'checkbox' ? data.has(f.name) : String(data.get(f.name) ?? '').trim(); });
  return out;
}

/** Generieke formulier-dialoog (vervangt prompt()). */
export function openFormDialog({ title, intro = '', fields = [], values = {}, submit = 'Opslaan', onSubmit, body = '' }) {
  const doc = globalThis.document;
  let dlg = doc.querySelector('#formDialog');
  if (!dlg) {
    dlg = doc.createElement('dialog');
    dlg.id = 'formDialog';
    doc.body.append(dlg);
  }
  dlg.innerHTML = `<form class="dialog-form"><div class="dialog-head"><div><h2>${esc(title)}</h2></div><button type="button" class="icon-btn" data-dialog-close aria-label="Sluiten">×</button></div>
    ${intro ? `<p class="small-note">${esc(intro)}</p>` : ''}${body}<div class="form-grid">${fields.map(f => fieldMarkup(f, values)).join('')}</div>
    <div class="dialog-actions"><button type="button" class="secondary" data-dialog-close>Annuleren</button><button type="submit" class="primary">${esc(submit)}</button></div></form>`;
  const form = dlg.querySelector('form');
  dlg.querySelectorAll('[data-dialog-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = onSubmit?.(readForm(form, fields), form);
    if (result !== false) dlg.close();
  });
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  return dlg;
}
