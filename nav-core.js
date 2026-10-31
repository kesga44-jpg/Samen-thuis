(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.NavCore = core;
})(globalThis, function () {
  // Vijf hoofdsecties in de vaste onderbalk; elke bestaande pagina-sleutel staat in precies één sectie.
  // 'meer' is de overzichtspagina met tegels (alleen navigatie, geen eigen gegevens).
  const SECTIONS = [
    { key: 'vandaag', icon: 'home', label: 'Vandaag', pages: [['today', 'Dashboard'], ['weather', 'Weer']] },
    { key: 'financien', icon: 'wallet', label: 'Financiën', pages: [['budget19', 'Financiën']] },
    { key: 'sport', icon: 'dumbbell', label: 'Sport', pages: [['sportcoach', 'Sport & Training']] },
    { key: 'doelen', icon: 'target', label: 'Doelen', pages: [['challenges', 'Challenges']] },
    {
      key: 'meer', icon: 'grid', label: 'Meer',
      pages: [['meer', 'Meer'], ['planning', 'Agenda'], ['tasks', 'Taken'], ['ideas', 'Date ideeën'], ['trips', 'Reizen'],
        ['meals', 'Weekmenu'], ['groceries', 'Boodschappen'], ['offers', 'Aanbiedingen'], ['stock', 'Voorraad & vriezer'], ['chores', 'Routines'], ['home', 'Woning'],
        ['programs', "Programma's"], ['auto24', 'Auto'], ['imports243', 'Importeren'], ['extra19', 'Extra'], ['settings', 'Instellingen']]
    }
  ];

  // Blokken op de pagina 'Meer'. Alleen pagina's die niet al in de onderbalk staan, zodat niets dubbel wordt aangeboden.
  const MORE_GROUPS = [
    { title: 'Plannen', tiles: [['planning', 'calendar', 'Agenda', 'Afspraken en agenda’s'], ['tasks', 'check', 'Taken', 'Wat moet er gebeuren'], ['ideas', 'heart', 'Date ideeën', 'Samen leuke dingen doen'], ['trips', 'plane', 'Reizen', 'Reismappen en boekingen']] },
    { title: 'Huishouden', tiles: [['meals', 'utensils', 'Weekmenu', 'Wat eten we'], ['groceries', 'cart', 'Boodschappen', 'Lijst en prijsreferentie'], ['offers', 'tag', 'Aanbiedingen', 'Actuele supermarktprijzen'], ['stock', 'box', 'Voorraad & vriezer', 'Wat is er in huis'], ['chores', 'repeat', 'Routines', 'Huishoudtaken en herhalingen'], ['home', 'house', 'Woning', 'Onderhoud en woninginfo']] },
    { title: 'Overig', tiles: [['programs', 'tv', "Programma's", 'Series, films en uitjes'], ['auto24', 'car', 'Auto', 'Tankbeurten en voertuigen'], ['imports243', 'upload', 'Importeren', 'Gegevens inlezen'], ['extra19', 'sparkles', 'Extra', 'Handige snelkoppelingen'], ['settings', 'gear', 'Instellingen', 'Profiel, sync en back-ups']] }
  ];

  // Opsplitsing van lange pagina's. Elke subpagina toont een deel van de bestaande pagina;
  // `parts` = [CSS-selector, optionele kopregex]. `catchAll` toont ook alles wat geen andere subpagina claimt,
  // zodat er nooit een onderdeel verdwijnt. `always` blijft op elke subpagina zichtbaar.
  const HUBS = {
    settings: {
      title: 'Instellingen',
      subs: [
        { key: 'profiel', icon: 'user', label: 'Persoonlijk profiel', desc: 'Thema, accentkleur en weergave', parts: [['.device-settings19']] },
        { key: 'huishouden', icon: 'users', label: 'Huishouden', desc: 'Agenda’s per huishoudlid', parts: [['.settings-card', 'Agenda’s beheren']] },
        { key: 'account', icon: 'lock', label: 'Account en beveiliging', desc: 'Persoonlijk account en aanmelden', parts: [['[data-personal-account25]']] },
        { key: 'synchronisatie', icon: 'sync', label: 'Synchronisatie', desc: 'Huishoudcode en accountsync', parts: [['.settings-card', 'Versleutelde synchronisatie|Accountsynchronisatie'], ['[data-acct-card]'], ['.sync-conflict-card,[data-sync-conflict]']] },
        { key: 'back-ups', icon: 'database', label: 'Back-ups en herstel', desc: 'Back-up maken en herstellen', parts: [['.settings-card', 'Back-up|Beschadigde gegevens']] },
        { key: 'voorkeuren', icon: 'sliders', label: 'Dashboard en voorkeuren', desc: 'Dashboardonderdelen kiezen', parts: [['.dashboard-editor,.dashboard-editor25']] },
        { key: 'overig', icon: 'more', label: 'Overige instellingen', desc: 'Importformaat en overig', parts: [['.settings-card', 'Eenvoudig tekstformaat']], catchAll: true }
      ]
    },
    budget19: {
      title: 'Financiën',
      subs: [
        { key: 'dashboard', icon: 'chart', label: 'Financieel dashboard', desc: 'Inkomen, verdeling en kerncijfers', parts: [['.budget-title23'], ['.kpis23'], ['.budget-sheet23', 'INKOMEN|MAANDELIJKSE GELDVERDELING']], catchAll: true },
        { key: 'transacties', icon: 'receipt', label: 'Transacties', desc: 'Inkomsten, uitgaven en verschuivingen boeken', parts: [['.ledger25 > .card-head'], ['.ledger25 > .muted'], ['.ledger-section25', 'Registreren']] },
        { key: 'budgetten', icon: 'pie', label: 'Budgetten', desc: 'Huisbudget en potjessaldi', parts: [['.budget-sheet23', 'HUISBUDGET'], ['.ledger-section25', 'Potjes']] },
        { key: 'vaste-lasten', icon: 'repeat', label: 'Vaste lasten', desc: 'Vaste lasten en maandplanning', parts: [['.budget-sheet23', 'VASTE LASTEN'], ['.ledger-section25', 'Maandplanning']] },
        { key: 'spaardoelen', icon: 'piggy', label: 'Spaardoelen', desc: 'Doelen, prognose en slim sparen', parts: [['.budget-sheet23', 'SPAARDOELEN|SLIM SPAREN|SPAARGELD PER DOEL']] },
        { key: 'overzichten', icon: 'list', label: 'Financiële overzichten', desc: 'Kerncijfers en maandoverzichten', parts: [['.ledger-kpis25'], ['.ledger-plan25'], ['.ledger-section25', '^(Inkomsten|Uitgaven|Verschuivingen) van'], ['.ledger25 > .small-note']] }
      ]
    },
    sportcoach: {
      title: 'Sport & Training',
      always: ['.sport-disclaimer'],
      subs: [
        { key: 'profielen', icon: 'user', label: 'Trainingsprofielen', desc: 'Persoonlijke profielen', parts: [['.sport-profile'], ['.sport-intro']], catchAll: true },
        { key: 'schemas', icon: 'clipboard', label: 'Trainingsschema’s', desc: 'Nieuw programma en bestaande schema’s', parts: [['.sport-generator'], ['.sportcoach-page > section', 'Programma’s$']] },
        { key: 'oefeningen', icon: 'book', label: 'Oefeningen en bibliotheek', desc: 'Oefeningen, bronnen en bestanden', parts: [['.sport-library']] },
        { key: 'planning', icon: 'calendar', label: 'Trainingsplanning', desc: 'Plannen en actieve training', parts: [['.sport-planner'], ['.sport-workout']] },
        { key: 'geschiedenis', icon: 'clock', label: 'Trainingsgeschiedenis', desc: 'Trainingen registreren', parts: [['.sportcoach-page > section.card', 'Training registreren']] },
        { key: 'voortgang', icon: 'chart', label: 'Voortgang', desc: 'Statistieken per persoon', parts: [['.sport-stats']] }
      ]
    }
  };

  function sectionOf(page) { return SECTIONS.find(s => s.pages.some(p => p[0] === page)) || null; }
  function pageLabel(page) { const s = sectionOf(page); const p = s && s.pages.find(x => x[0] === page); return p ? p[1] : ''; }
  function defaultPage(sectionKey, remembered) {
    const s = SECTIONS.find(x => x.key === sectionKey); if (!s) return null;
    return s.pages.some(p => p[0] === remembered) ? remembered : s.pages[0][0];
  }
  function allPages() { return SECTIONS.flatMap(s => s.pages.map(p => p[0])); }
  function subOf(page, sub) { const h = HUBS[page]; return h ? h.subs.find(s => s.key === sub) || null : null; }
  function isHub(page) { return page === 'meer' || !!HUBS[page]; }

  // Route in de URL: #/pagina of #/pagina/subpagina. Onbekende pagina's geven null, onbekende subpagina's vallen terug op de hub.
  function parseRoute(hash) {
    const m = /^#?\/?([a-z0-9]+)(?:\/([a-z0-9-]+))?\/?$/i.exec(String(hash || '').trim());
    if (!m || !sectionOf(m[1])) return null;
    const sub = m[2] && subOf(m[1], m[2]) ? m[2] : null;
    return { page: m[1], sub };
  }
  function formatRoute(page, sub) { return `#/${page}${sub ? '/' + sub : ''}`; }

  // Kruimelpad: [{label, page, sub}]; het laatste element is de huidige pagina. Leeg als er niets te tonen valt.
  function crumbs(page, sub) {
    const s = sectionOf(page); if (!s) return [];
    const trail = [];
    if (s.key === 'meer') {
      trail.push({ label: 'Meer', page: 'meer', sub: null });
      if (page !== 'meer') trail.push({ label: pageLabel(page), page, sub: null });
      if (sub && subOf(page, sub)) trail.push({ label: subOf(page, sub).label, page, sub });
      return trail;
    }
    if (sub && subOf(page, sub)) {
      trail.push({ label: s.label, page, sub: null });
      trail.push({ label: subOf(page, sub).label, page, sub });
    }
    return trail;
  }
  // Doel van de terugknop; null = geen terugknop.
  function parentOf(page, sub) {
    if (sub && subOf(page, sub)) return { page, sub: null };
    const s = sectionOf(page);
    return s && s.key === 'meer' && page !== 'meer' ? { page: 'meer', sub: null } : null;
  }
  // Kleine categorienaam boven de paginatitel.
  function categoryOf(page, sub) {
    const s = sectionOf(page); if (!s) return '';
    if (sub && subOf(page, sub)) return HUBS[page].title;
    return s.label;
  }
  function titleOf(page, sub) {
    if (sub && subOf(page, sub)) return subOf(page, sub).label;
    return pageLabel(page);
  }
  return { SECTIONS, MORE_GROUPS, HUBS, sectionOf, pageLabel, defaultPage, allPages, subOf, isHub, parseRoute, formatRoute, crumbs, parentOf, categoryOf, titleOf };
});
