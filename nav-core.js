(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.NavCore = core;
})(globalThis, function () {
  // Vijf hoofdsecties; elke bestaande pagina-sleutel staat in precies één sectie.
  const SECTIONS = [
    { key: 'vandaag', icon: '⌂', label: 'Vandaag', pages: [['today', 'Dashboard'], ['weather', 'Weer']] },
    { key: 'agenda', icon: '▦', label: 'Agenda', pages: [['planning', 'Agenda & planning'], ['ideas', 'Date ideeën']] },
    { key: 'taken', icon: '☑', label: 'Taken', pages: [['tasks', 'Taken']] },
    { key: 'huishouden', icon: '⌂', label: 'Huishouden', pages: [['meals', 'Weekmenu'], ['groceries', 'Boodschappen'], ['offers', 'Aanbiedingen'], ['stock', 'Voorraad & vriezer'], ['chores', 'Routines'], ['home', 'Woning'], ['budget19', 'Financiën']] },
    { key: 'meer', icon: '≡', label: 'Meer', pages: [['trips', 'Reizen'], ['challenges', 'Challenges'], ['programs', "Programma's"], ['sportcoach', 'Sport & Training'], ['auto24', 'Auto'], ['imports243', 'Importeren'], ['extra19', 'Extra'], ['settings', 'Instellingen']] }
  ];
  function sectionOf(page) { return SECTIONS.find(s => s.pages.some(p => p[0] === page)) || null; }
  function pageLabel(page) { const s = sectionOf(page); const p = s && s.pages.find(x => x[0] === page); return p ? p[1] : ''; }
  function defaultPage(sectionKey, remembered) {
    const s = SECTIONS.find(x => x.key === sectionKey); if (!s) return null;
    return s.pages.some(p => p[0] === remembered) ? remembered : s.pages[0][0];
  }
  function allPages() { return SECTIONS.flatMap(s => s.pages.map(p => p[0])); }
  function breadcrumb(page) {
    const s = sectionOf(page); if (!s) return null;
    return { section: s, label: pageLabel(page), parent: s.pages[0][0], isDefault: s.pages[0][0] === page };
  }
  return { SECTIONS, sectionOf, pageLabel, defaultPage, allPages, breadcrumb };
});
