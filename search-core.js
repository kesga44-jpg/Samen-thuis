(function (root, factory) {
  const core = factory(root.NavCore || (typeof require === 'function' ? require('./nav-core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisSearchCore = core;
})(globalThis, function (NavCore) {
  // Zoekkern: doorzoekt de bestaande lokale gegevens per module. Geen netwerk, geen tweede opslag.
  // Gezondheidsgegevens uit sportprofielen worden bewust nooit doorzocht; programma's en trainingen alleen als `canManagePerson` ze toestaat.
  const SKIP_KEY = /(^__|^id$|Id$|ids$|At$|^created|^updated|^url$|token|secret|password|^color$|^icon$)/i;
  const TITLE_KEYS = ['title', 'name', 'product', 'label', 'goal', 'station', 'description', 'text', 'note', 'source'];

  const fold = value => String(value ?? '').toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = query => fold(query).split(/\s+/).filter(Boolean);
  const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];

  function scalars(item) {
    const parts = [];
    for (const [key, value] of Object.entries(item)) {
      if (SKIP_KEY.test(key)) continue;
      if (typeof value === 'string' || typeof value === 'number') parts.push(String(value));
      else if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) parts.push(value.join(' '));
    }
    return parts;
  }
  const pickTitle = item => {
    for (const key of TITLE_KEYS) if (typeof item[key] === 'string' && item[key].trim()) return item[key].trim();
    return '';
  };
  const pickSubtitle = (item, title) => scalars(item).filter(text => text !== title && text.length <= 60).slice(0, 3).join(' · ');

  // Elke module: waar de gegevens staan, waar een resultaat naartoe leidt en wie de gegevens mag zien.
  function modules(data, opts) {
    const d = data || {};
    const ledger = (d.budgetV23 && d.budgetV23.financialLedger) || {};
    const sport = d.sportCoach || {};
    const challenge = d.challengeDataV26 || {};
    const canPerson = person => !opts.canManagePerson || !person || opts.canManagePerson(person);
    return [
      { key: 'planning', label: 'Agenda', icon: 'calendar', page: 'planning', items: list(d.planning) },
      { key: 'tasks', label: 'Taken', icon: 'check', page: 'tasks', items: list(d.tasks) },
      { key: 'meals', label: 'Weekmenu', icon: 'utensils', page: 'meals', items: list(d.meals) },
      { key: 'groceries', label: 'Boodschappen', icon: 'cart', page: 'groceries', items: [...list(d.groceries), ...list(d.priceReferences)] },
      { key: 'stock', label: 'Voorraad & vriezer', icon: 'box', page: 'stock', items: [...list(d.stock), ...list(d.freezer)] },
      { key: 'chores', label: 'Routines', icon: 'repeat', page: 'chores', items: list(d.chores) },
      { key: 'home', label: 'Woning', icon: 'house', page: 'home', items: list(d.home) },
      { key: 'ideas', label: 'Date ideeën', icon: 'heart', page: 'ideas', items: list(d.ideas) },
      { key: 'trips', label: 'Reizen', icon: 'plane', page: 'trips', items: [...list(d.tripFolders), ...list(d.tripSections), ...list(d.trips)] },
      { key: 'programs', label: "Programma's", icon: 'tv', page: 'programs', items: list(d.programs) },
      { key: 'auto', label: 'Auto', icon: 'car', page: 'auto24', items: [...list(d.cars), ...list(d.fuelEntries)] },
      { key: 'challenges', label: 'Challenges', icon: 'target', page: 'challenges', items: [...list(challenge.challenges), ...list(challenge.rewards), ...list(challenge.activities), ...list(challenge.redemptions)] },
      { key: 'fin-transacties', label: 'Financiën · Transacties', icon: 'receipt', page: 'budget19', sub: 'transacties', items: [...list(ledger.incomes), ...list(ledger.expenses), ...list(ledger.transfers)] },
      { key: 'fin-vaste-lasten', label: 'Financiën · Vaste lasten', icon: 'repeat', page: 'budget19', sub: 'vaste-lasten', items: [...list(d.budgetV23 && d.budgetV23.fixed), ...list(ledger.recurringBills), ...list(ledger.incomeSources)] },
      { key: 'fin-budgetten', label: 'Financiën · Budgetten', icon: 'pie', page: 'budget19', sub: 'budgetten', items: list(d.budgetV23 && d.budgetV23.houseCategories) },
      { key: 'fin-spaardoelen', label: 'Financiën · Spaardoelen', icon: 'piggy', page: 'budget19', sub: 'spaardoelen', items: list(d.budgetV23 && d.budgetV23.goals) },
      { key: 'sport-schemas', label: 'Sport · Schema’s', icon: 'clipboard', page: 'sportcoach', sub: 'schemas', items: list(sport.programs).filter(item => canPerson(item.person)) },
      { key: 'sport-oefeningen', label: 'Sport · Bibliotheek', icon: 'book', page: 'sportcoach', sub: 'oefeningen', items: [...list(sport.library), ...list(sport.sources), ...list(sport.exercises)] },
      { key: 'sport-geschiedenis', label: 'Sport · Geschiedenis', icon: 'clock', page: 'sportcoach', sub: 'geschiedenis', items: list(sport.sessions).filter(item => canPerson(item.person)) },
      { key: 'pages', label: 'Pagina’s en instellingen', icon: 'grid', page: null, items: pageEntries() }
    ];
  }

  function pageEntries() {
    if (!NavCore) return [];
    const entries = [];
    for (const section of NavCore.SECTIONS) {
      for (const [page, label] of section.pages) {
        if (page === 'meer') continue;
        entries.push({ id: `page:${page}`, title: label, description: section.label, __page: page, __sub: null });
      }
    }
    for (const [page, hub] of Object.entries(NavCore.HUBS)) {
      for (const sub of hub.subs) entries.push({ id: `sub:${page}/${sub.key}`, title: sub.label, description: `${hub.title} · ${sub.desc}`, __page: page, __sub: sub.key });
    }
    return entries;
  }

  function scoreOf(item, title, haystack, words) {
    const foldedTitle = fold(title);
    if (!words.every(word => haystack.includes(word))) return 0;
    if (words.every(word => foldedTitle.startsWith(word) || foldedTitle.includes(' ' + word))) return foldedTitle.startsWith(words[0]) ? 4 : 3;
    return words.every(word => foldedTitle.includes(word)) ? 2 : 1;
  }

  // Geeft per module de beste resultaten terug; lege zoekopdracht geeft lege lijst.
  function search(data, query, opts = {}) {
    const words = tokens(query);
    if (!words.length) return [];
    const perModule = opts.perModule || 6;
    const groups = [];
    for (const module of modules(data, opts)) {
      const found = [];
      for (const item of module.items) {
        const title = pickTitle(item);
        const haystack = fold(scalars(item).join(' '));
        const score = scoreOf(item, title, haystack, words);
        if (!score) continue;
        found.push({
          id: item.id || item.__page && `${item.__page}/${item.__sub || ''}` || '',
          title: title || pickSubtitle(item, '') || module.label,
          subtitle: item.__page ? item.description : pickSubtitle(item, title),
          page: item.__page || module.page, sub: item.__page ? item.__sub : module.sub || null, score
        });
      }
      if (!found.length) continue;
      found.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'nl-NL'));
      groups.push({ key: module.key, label: module.label, icon: module.icon, total: found.length, results: found.slice(0, perModule) });
    }
    return groups;
  }

  return { search, fold, tokens };
});
