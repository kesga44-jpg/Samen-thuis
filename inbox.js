/* In-app meldingeninbox met persoonlijke voorraad per account (lokaal per account; gedeelde huishouddata blijft ongewijzigd). */
(() => {
  'use strict';
  const IC = window.SamenThuisInbox;
  if (window.__ST_INBOX__ || !IC) return;
  window.__ST_INBOX__ = true;
  const e2 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => window.SamenThuisAuth25?.session()?.user?.id || 'local';
  const key = () => `samenThuisInboxV1:${uid()}`;
  const read = () => { try { const s = JSON.parse(localStorage.getItem(key()) || '{}'); return { items: IC.normalizeItems(s.items), prefs: IC.normalizePrefs(s.prefs) }; } catch (_) { return { items: [], prefs: IC.defaultPrefs() }; } };
  const write = s => { try { localStorage.setItem(key(), JSON.stringify(s)); } catch (_) { toast('Meldingen konden niet worden bewaard (opslag vol)'); } };

  function refresh() {
    const s = read(), fresh = IC.generate(data, todayISO(), s.prefs, window.FreezerCore);
    const conflicts = window.SamenThuisAccountSync?.conflicts() || [];
    if (s.prefs.sync && conflicts.length) fresh.push({ key: 'sync:conflict:' + conflicts.map(c => c.section).sort().join(','), category: 'sync', title: 'Synchronisatieconflict', body: 'Kies bij Instellingen welke versie je bewaart.', page: 'settings' });
    const m = IC.merge(s.items, fresh, new Date().toISOString());
    if (m.added) write({ ...s, items: m.items });
    paintBadge(IC.unread(m.items));
  }
  function paintBadge(n) {
    let b = document.querySelector('#inboxBtn');
    if (!b) {
      const host = document.querySelector('.top-actions'); if (!host) return;
      b = document.createElement('button'); b.id = 'inboxBtn'; b.type = 'button'; b.className = 'secondary inbox-btn';
      host.prepend(b);
    }
    b.innerHTML = `🔔<span class="inbox-count" ${n ? '' : 'hidden'}>${n}</span>`;
    b.setAttribute('aria-label', n ? `Meldingen, ${n} ongelezen` : 'Meldingen, geen ongelezen');
  }
  function dialog() {
    let d = document.querySelector('#inboxDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'inboxDialog'; d.setAttribute('aria-label', 'Meldingen'); document.body.append(d); }
    const s = read();
    const list = s.items.length ? s.items.map(i => `<li class="list-item inbox-item ${i.read ? '' : 'unread'}"><button type="button" class="item-main" data-inbox-open="${e2(i.key)}"><strong>${i.read ? '' : '● '}${e2(i.title)}</strong><small>${e2(i.body)} · ${e2(IC.CATEGORIES[i.category])}</small></button><button type="button" class="icon-btn" data-inbox-del="${e2(i.key)}" aria-label="Melding verwijderen">×</button></li>`).join('') : '<li class="muted">Geen meldingen.</li>';
    const prefs = Object.keys(IC.CATEGORIES).map(k => `<label class="check-row"><input type="checkbox" data-inbox-pref="${k}" ${s.prefs[k] ? 'checked' : ''}> ${e2(IC.CATEGORIES[k])}</label>`).join('');
    d.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">MELDINGEN</p><h2>Inbox</h2></div><button type="button" class="icon-btn" data-inbox-close aria-label="Sluiten">×</button></div>
      <div class="button-row"><button type="button" class="secondary" data-inbox-all>Alles gelezen</button></div><ul class="list">${list}</ul>
      <details><summary>Meldingsvoorkeuren (dit account)</summary>${prefs}<p class="small-note">Pushmeldingen zijn nog niet beschikbaar: daarvoor is een server met VAPID-sleutels nodig die niet is geconfigureerd.</p></details>`;
    return d;
  }
  document.addEventListener('click', ev => {
    const t = ev.target;
    if (t.closest('#inboxBtn')) { refresh(); const d = dialog(); d.showModal(); return; }
    if (t.closest('[data-inbox-close]')) { document.querySelector('#inboxDialog')?.close(); return; }
    const s = read();
    const open = t.closest('[data-inbox-open]'), del = t.closest('[data-inbox-del]');
    if (open) { const it = s.items.find(i => i.key === open.dataset.inboxOpen); write({ ...s, items: IC.markRead(s.items, open.dataset.inboxOpen) }); document.querySelector('#inboxDialog')?.close(); paintBadge(IC.unread(read().items)); if (it?.page && window.SamenThuisGo) window.SamenThuisGo(it.page); }
    else if (del) { write({ ...s, items: IC.remove(s.items, del.dataset.inboxDel) }); dialog(); paintBadge(IC.unread(read().items)); }
    else if (t.closest('[data-inbox-all]')) { write({ ...s, items: IC.markAllRead(s.items) }); dialog(); paintBadge(0); }
  });
  document.addEventListener('change', ev => {
    const p = ev.target.closest('[data-inbox-pref]'); if (!p) return;
    const s = read(); write({ ...s, prefs: IC.normalizePrefs({ ...s.prefs, [p.dataset.inboxPref]: p.checked }) });
  });
  const base = render;
  render = function (...a) { const r = base.apply(this, a); try { refresh(); } catch (_) {} return r; };
  try { refresh(); } catch (_) {}
})();
