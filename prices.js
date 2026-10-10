import { fmtMoney, todayKey, toNumber, uid } from './utils.js';
import { normalizeProductKey } from './groceries.js';
import { getState, save, toast } from './store.js';
import { readFileText } from './files.js';

/** Prijsreferenties uit CSV/TXT (product;winkel;prijs) of JSON. */
export function parsePriceText(text, isJson = false) {
  const clean = String(text || '');
  let list = [];
  if (isJson || /^\s*[[{]/.test(clean)) {
    const d = JSON.parse(clean);
    list = (Array.isArray(d) ? d : d?.products || [])
      .filter(p => p && typeof p === 'object')
      .map(p => ({ product: p.product || p.name, store: p.store || '', price: Number(p.price) }));
  } else {
    for (const line of clean.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const c = line.split(/[;\t|]/.test(line) ? /[;\t|]/ : ',').map(x => x.replace(/^"|"$/g, '').trim());
      const price = parseFloat(String(c[c.length - 1]).replace(/[€\s]/g, '').replace(',', '.'));
      if (c[0] && !Number.isNaN(price) && c.length > 1) list.push({ product: c[0], store: c.length > 2 ? c[1] : '', price });
    }
  }
  return list.filter(p => p.product && Number.isFinite(p.price));
}

export const pricesToCsv = refs => [['product', 'winkel', 'prijs'], ...refs.map(p => [p.product, p.store || '', p.price ?? ''])]
  .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');

export function findReference(refs, name) {
  const key = normalizeProductKey(name);
  if (!key) return null;
  const matches = refs.filter(r => { const rk = normalizeProductKey(r.product); return rk === key || (rk.length > 3 && (key.includes(rk) || rk.includes(key))); });
  return matches.sort((a, b) => toNumber(a.price) - toNumber(b.price))[0] || null;
}

/** 'bodem' = op of onder de bodemprijs, 'deal' = binnen 10% erboven. */
export function priceVerdict(ref, price) {
  if (!ref || !(toNumber(price) > 0)) return '';
  const p = toNumber(price), floor = toNumber(ref.price);
  return p <= floor ? 'bodem' : p <= floor * 1.1 ? 'deal' : '';
}

export function priceBadge(refs, item) {
  const ref = findReference(refs, item.name);
  if (!ref) return '';
  const verdict = priceVerdict(ref, item.price);
  return verdict
    ? `<span class="tag ${verdict === 'bodem' ? 'green' : 'tag-warn'}">${verdict === 'bodem' ? 'Bodem' : 'Goede deal'}</span>`
    : `<span class="tag" title="Referentieprijs ${ref.store || ''}">Bodem ${fmtMoney(ref.price)}</span>`;
}

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPrices() {
  const state = getState();
  download(`prijzen-${todayKey()}.csv`, pricesToCsv(state.priceReferences), 'text/csv');
  toast(state.priceReferences.length ? 'Prijzen geëxporteerd' : 'Nog geen prijzen, leeg bestand geëxporteerd');
}

export async function importPrices(file) {
  if (!file) return;
  try {
    const text = await readFileText(file);
    const list = parsePriceText(text, /\.json$/i.test(file.name));
    getState().priceReferences = list.map(p => ({ id: uid(), ...p }));
    save(`${list.length} prijzen geïmporteerd`);
  } catch { toast('Prijsbestand kon niet worden gelezen'); }
}
