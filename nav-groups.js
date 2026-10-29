/* Vijf hoofdsecties met subnavigatie. Alle bestaande pagina's blijven bereikbaar via SamenThuisGo. */
(() => {
  'use strict';
  if (window.__ST_NAV5__ || !window.NavCore) return;
  window.__ST_NAV5__ = true;
  document.body.classList.add('nav5');
  const NC = window.NavCore, KEY = 'st-nav5-last';
  const memory = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  const remember = (s, p) => { try { const m = memory(); m[s] = p; sessionStorage.setItem(KEY, JSON.stringify(m)); } catch (_) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const goto = p => window.SamenThuisGo ? window.SamenThuisGo(p) : null;

  function sectionButtons(cls, mobile) {
    const cur = NC.sectionOf(window.__st_current_page__ || '');
    return NC.SECTIONS.map(s => mobile
      ? `<button data-nav5="${s.key}" class="${cur && cur.key === s.key ? 'active' : ''}"><span>${s.icon}</span><small>${s.label}</small></button>`
      : `<button data-nav5="${s.key}" class="${cls} ${cur && cur.key === s.key ? 'active' : ''}"><span>${s.icon}</span>${s.label}</button>`).join('');
  }
  function paint(page) {
    window.__st_current_page__ = page;
    const desk = document.querySelector('#nav');
    if (desk) { desk.querySelectorAll('[data-nav5]').forEach(b => b.remove()); desk.insertAdjacentHTML('afterbegin', sectionButtons('nav-item', false)); }
    const mob = document.querySelector('.mobile-nav-scroll23');
    if (mob) { mob.querySelectorAll('[data-nav5]').forEach(b => b.remove()); mob.insertAdjacentHTML('afterbegin', sectionButtons('', true)); }
    const bc = NC.breadcrumb(page);
    let bar = document.querySelector('#subnav5');
    if (!bc) { if (bar) bar.remove(); return; }
    remember(bc.section.key, page);
    if (!bar) { bar = document.createElement('div'); bar.id = 'subnav5'; bar.className = 'subnav5'; const v = document.querySelector('#view'); v.parentNode.insertBefore(bar, v); }
    const tabs = bc.section.pages.length > 1 ? `<div class="subnav5-tabs" role="tablist">${bc.section.pages.map(([k, l]) =>
      `<button role="tab" data-sub5="${k}" aria-selected="${k === page}" class="${k === page ? 'active' : ''}">${esc(l)}</button>`).join('')}</div>` : '';
    bar.innerHTML = `<div class="subnav5-crumb">${bc.isDefault ? '' : `<button data-sub5="${bc.parent}" aria-label="Terug naar ${esc(bc.section.label)}">‹ ${esc(bc.section.label)}</button>`}<span>${esc(bc.section.label)} › <strong>${esc(bc.label)}</strong></span></div>${tabs}`;
  }
  document.addEventListener('click', e => {
    const sec = e.target.closest('[data-nav5]');
    if (sec) { e.preventDefault(); e.stopPropagation(); goto(NC.defaultPage(sec.dataset.nav5, memory()[sec.dataset.nav5])); return; }
    const sub = e.target.closest('[data-sub5]');
    if (sub) { e.preventDefault(); goto(sub.dataset.sub5); }
  }, true);

  const base = render;
  render = function (...a) { const r = base.apply(this, a); try { paint(current); } catch (_) {} setTimeout(() => { try { paint(current); } catch (_) {} }, 120); return r; };
  const mo = new MutationObserver(() => { const n = document.querySelector('.mobile-nav-scroll23'); if (n && !n.querySelector('[data-nav5]')) { try { paint(current); } catch (_) {} } });
  mo.observe(document.body, { childList: true, subtree: true });
  try { paint(current); } catch (_) {}
})();
