(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisInbox = core;
})(globalThis, function () {
  const CATEGORIES = { chores: 'Taken & routines', agenda: 'Agenda', freezer: 'Vriezer', stock: 'Voorraad', sync: 'Synchronisatie' };
  const MAX_ITEMS = 100;
  const defaultPrefs = () => ({ chores: true, agenda: true, freezer: true, stock: true, sync: true, push: false });

  function normalizePrefs(v) {
    const d = defaultPrefs(), out = {};
    Object.keys(d).forEach(k => { out[k] = typeof v?.[k] === 'boolean' ? v[k] : d[k]; });
    return out;
  }
  function normalizeItems(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(i => i && typeof i.key === 'string' && typeof i.title === 'string')
      .map(i => ({ key: i.key.slice(0, 120), category: CATEGORIES[i.category] ? i.category : 'sync', title: i.title.slice(0, 160), body: String(i.body || '').slice(0, 300), page: String(i.page || ''), createdAt: String(i.createdAt || ''), read: !!i.read }))
      .slice(0, MAX_ITEMS);
  }
  // Herinneringen worden afgeleid uit bestaande data; de key voorkomt duplicaten en bewaart de gelezen-status.
  function generate(data, today, prefs, freezerCore) {
    const out = [], p = normalizePrefs(prefs), d = data || {};
    // Sleutel = onderwerp + toestand (niet de dag): dezelfde situatie meldt zich niet elke dag opnieuw en een gelezen melding blijft gelezen.
    const add = (category, key, title, body, page) => { if (p[category]) out.push({ key: `${category}:${key}`, category, title, body, page }); };
    (d.chores || []).forEach(c => {
      if (!c || !c.due || c.due > today || (c.completedDates || []).includes(c.due)) return;
      add('chores', c.id + ':' + c.due, c.due < today ? 'Taak te laat' : 'Taak vandaag', `${c.title}${c.person ? ' · ' + c.person : ''}`, 'chores');
    });
    (d.planning || []).forEach(a => { if (a && a.date === today) add('agenda', a.id + ':' + a.date, 'Afspraak vandaag', `${a.time ? a.time + ' ' : ''}${a.title}`, 'planning'); });
    if (freezerCore) (d.freezer || []).forEach(f => {
      if (!f || !(f.portions > 0)) return;
      const left = freezerCore.daysLeft(f, today);
      if (left !== null && left <= 3) add('freezer', f.id + ':' + f.bestBefore, left < 0 ? 'Vriezerproduct verlopen' : 'Vriezerproduct bijna over datum', f.title, 'stock');
    });
    (d.stock || []).forEach(s => { if (s && Number(s.amount) < Number(s.min)) add('stock', s.id + ':' + s.amount, 'Voorraad bijna op', `${s.title}: ${s.amount} ${s.unit || ''}`.trim(), 'stock'); });
    return out;
  }
  // Voegt nieuwe meldingen toe zonder bestaande (en hun gelezen-status) te wijzigen.
  function merge(items, fresh, now) {
    const have = new Set(items.map(i => i.key)), added = [];
    fresh.forEach(f => { if (!have.has(f.key)) { have.add(f.key); added.push({ ...f, createdAt: now, read: false }); } });
    return { items: [...added, ...items].slice(0, MAX_ITEMS), added: added.length };
  }
  const markRead = (items, key) => items.map(i => i.key === key ? { ...i, read: true } : i);
  const markAllRead = items => items.map(i => ({ ...i, read: true }));
  const unread = items => items.filter(i => !i.read).length;
  const remove = (items, key) => items.filter(i => i.key !== key);
  return { CATEGORIES, defaultPrefs, normalizePrefs, normalizeItems, generate, merge, markRead, markAllRead, unread, remove };
});
