/* CLEAN MASTER BUILD 2026-09-08 16:xx */
console.info('Samen Thuis update 13.0 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V13__) return;
  window.__SAMEN_THUIS_V13__ = true;

  if (!document.querySelector('#v14CentralInputStyle')) {
    const style=document.createElement('style');
    style.id='v14CentralInputStyle';
    style.textContent=`
      .v14-methods{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 4px}
      .v14-methods button{flex:1 1 180px}
      .v14-manual-form{margin-top:16px}
      @media(max-width:650px){.v14-methods{display:grid;grid-template-columns:1fr}.v14-methods button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const TARGETS = {
    planning: 'Agenda',
    meals: 'Weekmenu',
    groceries: 'Boodschappen',
    chores: 'Huishouden',
    stock: 'Voorraad',
    ideas: 'Samen doen',
    home: 'Woning',
    trips: 'Reizen'
  };

  const SUBTYPES = {
    chores: ['Reguliere schoonmaak','Periodieke schoonmaak','Was & textiel','Overig'],
    stock: ['Huishoudvoorraad','Persoonlijke verzorging','Keuken basisvoorraad','Koelkast & vriezer','Overig'],
    home: ['Onderhoud','Veiligheid','Organisatie','Seizoen','Garantie','Woninginfo'],
    trips: ['Route & planning','Vervoer','Verblijf','Activiteiten','Boekingen & acties','Budget','Documenten','Paklijst','Overig']
  };

  const REPEATS = [
    'Eenmalig','Dagelijks','Om de dag','2× per week','3× per week','Wekelijks',
    'Elke 2 weken','Elke 4 weken','Maandelijks','Elke 2 maanden',
    'Elke 3 maanden','Elke 6 maanden','Jaarlijks','Na elke was','Wanneer nodig'
  ];

  const state13 = {
    target: 'planning',
    subtype: '',
    method: 'manual',
    text: '',
    filename: '',
    preview: [],
    tripFolderId: data.tripFolders?.[0]?.id || '',
    tripSectionId: '',
    calendarId: data.calendars?.[0]?.id || 'persoonlijk'
  };

  const baseRender13 = render;
  const baseFormConfig13 = formConfig;

  function cleanBullet(s='') {
    return String(s).replace(/^\s*(?:[-•▪◦‣–—]|☐|□|☑|✓|✔|\[[ xX]?\])\s*/, '').trim();
  }

  function norm(s='') {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/&/g,' en ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }

  function keyValueParts(line) {
    const chunks = cleanBullet(line).split('|').map(x => x.trim()).filter(Boolean);
    const title = chunks.shift() || '';
    const meta = {};
    const loose = [];
    chunks.forEach(chunk => {
      const m = chunk.match(/^([^:]{2,35}):\s*(.*)$/);
      if (m) meta[norm(m[1])] = m[2].trim();
      else loose.push(chunk);
    });
    return { title, meta, loose };
  }

  function num(v, fallback=0) {
    const m = String(v ?? '').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : fallback;
  }

  function boolWord(v) {
    return /^(1|ja|yes|true|aan|x|✓)$/i.test(String(v||'').trim());
  }

  function isoDateFromText(s='') {
    let m = String(s).match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m = String(s).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function normaliseRepeat(raw='') {
    const v = norm(raw.replace(/^frequentie\s*:\s*/i,''));
    const map = [
      [/^dagelijks$/, 'Dagelijks'],
      [/^(om de dag|elke 2 dagen)$/, 'Om de dag'],
      [/^(2x per week|2 per week|twee keer per week)$/, '2× per week'],
      [/^(3x per week|3 per week|drie keer per week)$/, '3× per week'],
      [/^wekelijks$/, 'Wekelijks'],
      [/^(elke 2 weken|2 wekelijks|tweewekelijks)$/, 'Elke 2 weken'],
      [/^(elke 4 weken|4 wekelijks)$/, 'Elke 4 weken'],
      [/^maandelijks$/, 'Maandelijks'],
      [/^(elke 2 maanden|2 maandelijks)$/, 'Elke 2 maanden'],
      [/^(elke 3 maanden|kwartaal|kwartaallijks)$/, 'Elke 3 maanden'],
      [/^(elke 6 maanden|halfjaarlijks)$/, 'Elke 6 maanden'],
      [/^(jaarlijks|elk jaar|1x per jaar)$/, 'Jaarlijks'],
      [/^(na elke was|na iedere was)$/, 'Na elke was'],
      [/^(wanneer nodig|indien nodig|naar behoefte)$/, 'Wanneer nodig'],
      [/^eenmalig$/, 'Eenmalig']
    ];
    for (const [rx, label] of map) if (rx.test(v)) return label;
    return raw && REPEATS.includes(raw) ? raw : 'Wekelijks';
  }

  function defaultSubtype(target) {
    return SUBTYPES[target]?.[0] || '';
  }

  function stockCategory(raw, subtype) {
    if (raw) return raw;
    if (subtype === 'Persoonlijke verzorging') return 'Badkamer';
    if (subtype === 'Keuken basisvoorraad') return 'Voorraadkast';
    if (subtype === 'Koelkast & vriezer') return 'Koelkast';
    return 'Overig';
  }

  function duplicateOf(target, item) {
    const arr = data[target] || [];
    return arr.find(existing => norm(existing.title || existing.name) === norm(item.title || item.name));
  }

  function parseChore(line) {
    const {title, meta, loose} = keyValueParts(line);
    if (!title || /^(huishouden|was & textiel)/i.test(title)) return null;
    const repeat = normaliseRepeat(meta.frequentie || meta.herhaling || loose[0] || 'Wekelijks');
    const notes = meta.notitie || meta.notes || meta.omschrijving || loose.slice(1).join(' · ');
    return {
      id:id(), title, person: meta['voor wie'] || meta.persoon || 'Samen',
      due: meta.datum || meta['eerste keer'] || todayISO(),
      repeat, secondWeekday:'', notes, completedDates:[],
      category: meta.categorie || state13.subtype,
      importSubtype: state13.subtype
    };
  }

  function parseStock(line) {
    const {title, meta} = keyValueParts(line);
    if (!title || /^(huishoudvoorraad|persoonlijke verzorging|keuken basisvoorraad|koelkast)/i.test(title)) return null;

    const desired = num(meta.gewenst ?? meta.doel ?? meta.streefvoorraad, 0);
    const minimum = num(meta.minimum ?? meta.min, 0);
    const amountGiven = meta.aantal ?? meta['in huis'] ?? meta.huidig;
    const amount = amountGiven !== undefined ? num(amountGiven, 0) : 0;

    return {
      id:id(), title,
      category: stockCategory(meta.categorie || meta.plek, state13.subtype),
      amount,
      min: minimum,
      desired: desired || Math.max(minimum, amount),
      unit: meta.eenheid || 'stuks',
      importSubtype: state13.subtype
    };
  }

  function parseHome(line) {
    const {title, meta, loose} = keyValueParts(line);
    if (!title || /^(woningonderhoud|veiligheid|woningorganisatie|seizoenstaken)/i.test(title)) return null;
    const repeatRaw = meta.frequentie || meta.herhaling || '';
    return {
      id:id(), title,
      category: meta.categorie || state13.subtype || 'Onderhoud',
      due: meta.datum || '',
      repeat: repeatRaw ? normaliseRepeat(repeatRaw) : '',
      note: meta.notitie || meta.omschrijving || loose.join(' · '),
      importSubtype: state13.subtype
    };
  }

  function travelType(line, subtype) {
    const s = norm(line + ' ' + subtype);
    if (/paklijst|meenemen|inpakken/.test(s)) return 'Paklijst';
    if (/hotel|homestay|verblijf|overnacht/.test(s)) return 'Verblijf';
    if (/vlucht|trein|bus|transfer|taxi|grab|vervoer|ferry|cruise/.test(s)) return 'Vervoer';
    if (/budget|prijs|kosten|spaardoel|euro|vnd/.test(s)) return 'Budget';
    if (/paspoort|visum|verzekering|document|gezondheid|vaccin/.test(s)) return 'Documenten';
    if (/boeken|vastleggen|reserveren|regelen|controleren|afspraak/.test(s)) return 'Voorbereiding';
    if (/restaurant|eten|food|coffee|koffie/.test(s)) return 'Eten';
    if (/activiteit|tour|cave|rafting|canyoning|massage|spa|tailor|workshop|strand|museum/.test(s)) return 'Activiteit';
    return 'Notitie';
  }


  const TARGET_PATH_NAMES = {
    agenda:'planning', planning:'planning',
    weekmenu:'meals', maaltijden:'meals',
    boodschappen:'groceries',
    huishouden:'chores',
    voorraad:'stock',
    'samen doen':'ideas', ideeen:'ideas', ideeën:'ideas',
    woning:'home',
    reizen:'trips', reis:'trips'
  };

  function pathParts(line='') {
    const raw = cleanBullet(line);
    if (!raw.includes('/')) return null;
    const parts = raw.split('/').map(x=>x.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const mapped = TARGET_PATH_NAMES[norm(parts[0])];
    return mapped ? {target:mapped, parts} : null;
  }

  function findTripFolderByName(name='') {
    return data.tripFolders?.find(f => norm(f.name) === norm(name));
  }

  function findTripSectionByName(folderId, name='') {
    return data.tripSections?.find(s => s.tripFolderId === folderId && norm(s.name) === norm(name));
  }

  function selectedTripFolder() {
    return data.tripFolders?.find(f=>f.id===state13.tripFolderId) || data.tripFolders?.[0] || null;
  }

  function selectedTripSection(folderId) {
    const selected = data.tripSections?.find(s=>s.id===state13.tripSectionId && s.tripFolderId===folderId);
    return selected || data.tripSections?.find(s=>s.tripFolderId===folderId) || null;
  }

  function parseTrip(line) {
    const p = pathParts(line);
    let folder = selectedTripFolder();
    let section = folder ? selectedTripSection(folder.id) : null;
    let source = cleanBullet(line);
    let pendingFolderName = '';
    let pendingSectionName = '';

    if (p && p.target === 'trips') {
      pendingFolderName = p.parts[1] || '';
      const matchedFolder = findTripFolderByName(pendingFolderName);
      if (matchedFolder) folder = matchedFolder;

      pendingSectionName = p.parts[2] || state13.subtype || 'Algemeen';
      if (folder) section = findTripSectionByName(folder.id, pendingSectionName) || null;

      source = p.parts.slice(3).join(' / ').trim();
      if (!source && p.parts.length === 3) return null;
    }

    if (!source || /^[A-ZÀ-Ÿ &/-]{3,}:?$/.test(source)) return null;
    const {title, meta} = keyValueParts(source);
    const itemTitle = title || source;
    const checkable = /^(?:☐|□|\[\s?\])/.test(line) ||
      boolWord(meta.afvinkbaar || meta.checkable) ||
      /\b(boeken|vastleggen|reserveren|regelen|controleren|afspraak|downloaden|meenemen|inpakken)\b/i.test(itemTitle);

    return {
      id:id(),
      tripFolderId: folder?.id || '',
      tripSectionId: section?.id || '',
      title: itemTitle,
      date: meta.datum || meta.deadline || isoDateFromText(source),
      type: meta.type || meta.soort || travelType(itemTitle, pendingSectionName || state13.subtype),
      note: meta.notitie || meta.notes || '',
      checkable,
      done:false,
      _pendingFolderName: pendingFolderName && !folder?.id ? pendingFolderName : '',
      _pendingSectionName: pendingSectionName && !section?.id ? pendingSectionName : ''
    };
  }

  function parseGeneric(line, target) {
    const clean = cleanBullet(line);
    if (!clean) return null;
    if (target === 'ideas') return {id:id(), title:clean, category:'Thuis', note:'', icon:'♡'};
    return null;
  }

  function parseLines13(text, target) {
    if (target === 'planning' || target === 'meals' || target === 'groceries') return null;
    const lines = String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean)
      .filter(x => !/^#\s*(pagina|werkblad)\b/i.test(x))
      .filter(x => !/^(aanbevolen uploadvolgorde|belangrijk|importregels|beperkingen|uitgangspunt woning)$/i.test(x));

    const parser = target === 'chores' ? parseChore :
                   target === 'stock' ? parseStock :
                   target === 'home' ? parseHome :
                   target === 'trips' ? parseTrip :
                   line => parseGeneric(line,target);

    return lines.slice(0,350).map(line => parser(line)).filter(Boolean).map(item => {
      const dup = duplicateOf(target,item);
      return {selected: !dup, item, duplicate: dup ? dup.id : ''};
    });
  }

  function previewMeta(item, target) {
    if (target === 'stock') {
      return `${item.category} · huidig ${item.amount} · minimum ${item.min} · gewenst ${item.desired} ${item.unit}`;
    }
    if (target === 'chores') {
      return `${item.repeat} · ${item.person}${item.category ? ' · '+item.category : ''}`;
    }
    if (target === 'home') {
      return `${item.category}${item.repeat ? ' · '+item.repeat : ''}${item.due ? ' · '+item.due : ''}`;
    }
    if (target === 'trips') {
      const folder = data.tripFolders?.find(f=>f.id===item.tripFolderId)?.name || item._pendingFolderName || 'Nieuwe/gekozen reis';
      const section = data.tripSections?.find(s=>s.id===item.tripSectionId)?.name || item._pendingSectionName || state13.subtype || 'Algemeen';
      return `${folder} › ${section} · ${item.type}${item.date ? ' · '+item.date : ''}${item.checkable ? ' · afvinken' : ''}`;
    }
    return item.category || TARGETS[target] || '';
  }

  function field(label, html, cls='') {
    return `<div class="field ${cls}"><label>${esc(label)}</label>${html}</div>`;
  }

  function optionList(values, selected) {
    return values.map(v => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  }

  function previewEditor(entry, index) {
    const x = entry.item, t = state13.target;
    if (t === 'stock') return `
      ${field('Product',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v13-field="amount" value="${x.amount}">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v13-field="min" value="${x.min}">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v13-field="desired" value="${x.desired}">`)}
      ${field('Eenheid',`<input data-v13-field="unit" value="${esc(x.unit)}">`)}`;
    if (t === 'chores') return `
      ${field('Taak',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Frequentie',`<select data-v13-field="repeat">${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Voor wie',`<select data-v13-field="person">${optionList(['Samen','Kees','Daphne'],x.person)}</select>`)}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category||'')}">`)}
      ${field('Eerste keer',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="notes">${esc(x.notes||'')}</textarea>`,'full')}`;
    if (t === 'home') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Frequentie',`<select data-v13-field="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Datum',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    if (t === 'trips') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Datum/deadline',`<input type="date" data-v13-field="date" value="${esc(x.date||'')}">`)}
      ${field('Soort',`<input data-v13-field="type" value="${esc(x.type||'Notitie')}">`)}
      <label class="checkbox-field"><input type="checkbox" data-v13-field="checkable" ${x.checkable?'checked':''}><span>Afvinkbaar</span></label>
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    return field('Titel',`<input data-v13-field="title" value="${esc(x.title||'')}">`,'full');
  }

  function manualForm13() {
    const t = state13.target;
    const calendars = data.calendars || [];
    const tripFolders = data.tripFolders || [];
    const folder = selectedTripFolder();
    const sections = (data.tripSections || []).filter(s=>s.tripFolderId===folder?.id);

    if (t === 'planning') return `
      ${field('Wat?',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Begintijd',`<input type="time" data-v14-manual="time">`)}
      ${field('Eindtijd',`<input type="time" data-v14-manual="endTime">`)}
      ${field('Agenda',`<select data-v14-manual="calendarId">${calendars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>`)}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}`;

    if (t === 'meals') return `
      ${field('Gerecht',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Moment',`<select data-v14-manual="type">${optionList(['Ontbijt','Lunch','Avondeten','Snack'],'Avondeten')}</select>`)}`;

    if (t === 'groceries') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(GROCERY_CATEGORIES,'Overig')}</select>`)}`;

    if (t === 'chores') return `
      ${field('Taak',`<input data-v14-manual="title" required>`,'full')}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}
      ${field('Eerste keer',`<input type="date" data-v14-manual="due" value="${todayISO()}">`)}
      ${field('Frequentie',`<select data-v14-manual="repeat">${optionList(REPEATS,'Wekelijks')}</select>`)}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype || 'Reguliere schoonmaak')}">`)}
      ${field('Notitie',`<textarea data-v14-manual="notes"></textarea>`,'full')}`;

    if (t === 'stock') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(stockCategory('',state13.subtype))}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v14-manual="amount" value="0">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v14-manual="min" value="0">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v14-manual="desired" value="0">`)}
      ${field('Eenheid',`<input data-v14-manual="unit" value="stuks">`)}`;

    if (t === 'ideas') return `
      ${field('Idee',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(['Thuis','Uit','Actief','Gratis','Eten'],'Thuis')}</select>`)}
      ${field('Emoji',`<input data-v14-manual="icon" value="♡">`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;

    if (t === 'home') return `
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype || 'Onderhoud')}">`)}
      ${field('Datum',`<input type="date" data-v14-manual="due">`)}
      ${field('Herhaling',`<select data-v14-manual="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,'')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;

    if (t === 'trips') return `
      ${field('Reis',`<select id="v14TripFolder" data-v14-manual="tripFolderId">${tripFolders.map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
      ${field('Map binnen de reis',`<select data-v14-manual="tripSectionId">${sections.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum/deadline',`<input type="date" data-v14-manual="date">`)}
      ${field('Soort',`<select data-v14-manual="type">${optionList(['Voorbereiding','Reservering','Vervoer','Verblijf','Activiteit','Eten','Budget','Documenten','Paklijst','Notitie'],'Notitie')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}
      <label class="checkbox-field"><input type="checkbox" data-v14-manual="checkable"><span>Dit moet afgevinkt worden</span></label>`;

    return '';
  }

  function destinationFields13() {
    if (state13.target === 'trips') {
      const folder = selectedTripFolder();
      const sections = (data.tripSections || []).filter(s=>s.tripFolderId===folder?.id);
      return `
        ${field('Standaard reis',`<select id="v14ImportTripFolder">${(data.tripFolders||[]).map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
        ${field('Standaard map',`<select id="v14ImportTripSection">${sections.map(s=>`<option value="${esc(s.id)}" ${s.id===state13.tripSectionId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`)}
        <div class="field full"><small class="muted">Padherkenning heeft voorrang. Voorbeeld: <strong>Reizen/Vietnam/Paklijst/Tandenborstel</strong>.</small></div>`;
    }
    const subtypes = SUBTYPES[state13.target] || [];
    return subtypes.length ? field('Standaard categorie/map',`<select id="v13Subtype">${subtypes.map(v=>`<option ${v===state13.subtype?'selected':''}>${esc(v)}</option>`).join('')}</select>`) : '';
  }

  function renderImports13() {
    const methodLabel = state13.method === 'manual' ? 'Handmatig invoeren' : state13.method === 'file' ? 'Bestand uploaden' : 'Tekst plakken';
    return `<div class="import-v13">
      <section class="card">
        <div class="card-head"><div><p class="eyebrow">SAMEN THUIS · CENTRALE INVOER</p><h2>Toevoegen & importeren</h2></div><span class="tag green">${esc(methodLabel)}</span></div>
        <p>Kies waar het hoort en daarna hoe je het wilt toevoegen.</p>

        <div class="form-grid">
          ${field('Waar hoort dit bij?',`<select id="v13Target">${Object.entries(TARGETS).map(([k,v])=>`<option value="${k}" ${k===state13.target?'selected':''}>${esc(v)}</option>`).join('')}</select>`)}
          ${state13.method !== 'manual' ? destinationFields13() : ''}
        </div>

        <div class="v14-methods">
          <button class="${state13.method==='manual'?'primary':'secondary'}" data-v14-method="manual">✏️ Handmatig</button>
          <button class="${state13.method==='file'?'primary':'secondary'}" data-v14-method="file">📄 Bestand uploaden</button>
          <button class="${state13.method==='text'?'primary':'secondary'}" data-v14-method="text">📋 Tekst plakken</button>
        </div>

        ${state13.method === 'manual' ? `
          <div class="form-grid v14-manual-form">${manualForm13()}</div>
          <div class="button-row"><button class="primary" data-v14-manual-save>Opslaan</button></div>
        ` : state13.method === 'file' ? `
          <div class="form-grid">
            ${field('Bestand',`<input id="v13File" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,text/plain">`,'full')}
          </div>
          ${state13.filename ? `<p class="muted">Bron: <strong>${esc(state13.filename)}</strong></p>` : ''}
          <p class="muted">Na kiezen wordt het bestand automatisch gelezen en geanalyseerd.</p>
        ` : `
          <div class="form-grid">
            ${field('Tekst/lijst plakken',`<textarea id="v13Text" placeholder="Bijvoorbeeld: Reizen/Vietnam/Paklijst/Tandenborstel">${esc(state13.text)}</textarea>`,'full')}
          </div>
          <div class="button-row"><button class="primary" data-v13-analyse>Analyseren</button><button class="secondary" data-v13-clear>Leegmaken</button></div>
        `}
      </section>

      ${state13.method !== 'manual' ? (state13.preview.length ? `<section class="card v13-preview">
        <div class="card-head"><div><p class="eyebrow">CONTROLE</p><h2>${state13.preview.length} gevonden items</h2></div>
          <div class="button-row"><button class="secondary" data-v13-all>Alles selecteren</button><button class="secondary" data-v13-none>Niets</button><button class="primary" data-v13-commit>Geselecteerde toevoegen</button></div>
        </div>
        ${['chores','stock','home'].includes(state13.target) ? `<div class="v13-bulk">
          <strong>Bulk aanpassen</strong>
          ${state13.target==='chores' ? `<select id="v13BulkRepeat"><option value="">Frequentie behouden</option>${REPEATS.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          <select id="v13BulkPerson"><option value="">Persoon behouden</option><option>Samen</option><option>Kees</option><option>Daphne</option></select>`:''}
          <input id="v13BulkCategory" placeholder="Categorie (optioneel)">
          <button class="secondary" data-v13-bulk>Toepassen op geselecteerde</button>
        </div>`:''}
        <div class="v13-preview-list">${state13.preview.map((entry,i)=>`
          <article class="v13-card ${entry.duplicate?'duplicate':''}" data-v13-card="${i}">
            <div class="v13-card-head">
              <label><input type="checkbox" data-v13-selected ${entry.selected?'checked':''}> Importeren</label>
              ${entry.duplicate ? '<span class="tag warning">Mogelijk al aanwezig · standaard overgeslagen</span>' : ''}
            </div>
            <div class="v13-fields">${previewEditor(entry,i)}</div>
            <small class="muted">${esc(previewMeta(entry.item,state13.target))}</small>
          </article>`).join('')}</div>
      </section>` : `<section class="card"><p class="muted">Nog niets geanalyseerd.</p></section>`) : ''}
    </div>`;
  }

  async function loadExternal13(src, test) {
    if (test()) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
  }

  async function readFile13(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (['txt','md','csv'].includes(ext)) return file.text();
    if (ext === 'pdf') return extractPdfText(file);
    if (ext === 'docx') {
      await loadExternal13('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',()=>Boolean(window.mammoth));
      return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value || '';
    }
    if (['xlsx','xlsm','xls'].includes(ext)) {
      await loadExternal13('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>Boolean(window.XLSX));
      const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      return wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
    }
    throw new Error('Bestandstype niet ondersteund');
  }

  function syncCardEdits() {
    document.querySelectorAll('[data-v13-card]').forEach(card=>{
      const entry=state13.preview[Number(card.dataset.v13Card)];
      if(!entry) return;
      entry.selected=Boolean(card.querySelector('[data-v13-selected]')?.checked);
      card.querySelectorAll('[data-v13-field]').forEach(input=>{
        const k=input.dataset.v13Field;
        let v=input.type==='checkbox'?input.checked:input.value;
        if(['amount','min','desired'].includes(k)) v=num(v,0);
        entry.item[k]=v;
      });
    });
  }

  function analyse13() {
    const special = parseLines13(state13.text,state13.target);
    if (special !== null) {
      state13.preview = special;
      render();
      toast(`${state13.preview.length} items gevonden`);
      return;
    }
    // Voor Agenda/Weekmenu/Boodschappen: laat de bewezen v12-functies het bestand lezen
    // door tijdelijk het v12-scherm te gebruiken is niet nodig; gebruik eenvoudige compatibele parsing.
    const lines=String(state13.text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(state13.target==='groceries'){
      state13.preview=parseGroceryText(state13.text).slice(0,300).map(x=>({selected:true,item:{id:id(),...x}}));
    }else if(state13.target==='planning'){
      state13.preview=lines.filter(x=>isoDateFromText(x)).map(x=>({selected:true,item:{
        id:id(),title:x.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/,'').trim()||'Afspraak',
        date:isoDateFromText(x),time:'',endTime:'',person:'Samen',calendarId:data.calendars[0]?.id||'persoonlijk'
      }}));
    }else if(state13.target==='meals'){
      const start=startOfWeek(todayISO());
      state13.preview=lines.slice(0,7).map((x,i)=>({selected:true,item:{id:id(),date:addDays(start,i),type:'Avondeten',title:cleanBullet(x)}}));
    }
    render();
    toast(`${state13.preview.length} items gevonden`);
  }

  function resolveTripDestination13(item) {
    let folder = data.tripFolders?.find(f=>f.id===item.tripFolderId);
    if (!folder && item._pendingFolderName) {
      folder = findTripFolderByName(item._pendingFolderName);
      if (!folder) {
        folder = {id:id(), name:item._pendingFolderName, startDate:'', endDate:'', note:'Aangemaakt via centrale invoer'};
        data.tripFolders.push(folder);
      }
    }
    if (!folder) folder = selectedTripFolder();
    if (!folder) return item;

    let section = data.tripSections?.find(s=>s.id===item.tripSectionId && s.tripFolderId===folder.id);
    const wantedSection = item._pendingSectionName || state13.subtype || 'Algemeen';
    if (!section) section = findTripSectionByName(folder.id,wantedSection);
    if (!section) {
      section = {id:id(), tripFolderId:folder.id, name:wantedSection};
      data.tripSections.push(section);
    }
    const clean = {...item, tripFolderId:folder.id, tripSectionId:section.id};
    delete clean._pendingFolderName;
    delete clean._pendingSectionName;
    return clean;
  }

  function commit13() {
    syncCardEdits();
    let selected=state13.preview.filter(x=>x.selected).map(x=>x.item);
    if(!selected.length) return toast('Selecteer minimaal één item');
    if(state13.target==='trips') selected=selected.map(resolveTripDestination13);
    data[state13.target].push(...selected);
    save();
    const count=selected.length;
    state13.preview=[]; state13.text=''; state13.filename='';
    render();
    toast(`${count} items toegevoegd aan ${TARGETS[state13.target]}`);
  }

  function manualValue13(name) {
    const el=document.querySelector(`[data-v14-manual="${name}"]`);
    if(!el) return '';
    return el.type==='checkbox' ? el.checked : el.value;
  }

  function saveManual13() {
    const t=state13.target;
    const title=String(manualValue13('title')||'').trim();
    if(!title) return toast('Vul eerst een titel/onderwerp in');
    let item;

    if(t==='planning') item={id:id(),title,date:manualValue13('date')||todayISO(),time:manualValue13('time'),endTime:manualValue13('endTime'),calendarId:manualValue13('calendarId')||'persoonlijk',person:manualValue13('person')||'Samen',personSource:'manual'};
    else if(t==='meals') item={id:id(),title,date:manualValue13('date')||todayISO(),type:manualValue13('type')||'Avondeten'};
    else if(t==='groceries') item={id:id(),title,category:manualValue13('category')||'Overig',done:false};
    else if(t==='chores') item={id:id(),title,person:manualValue13('person')||'Samen',due:manualValue13('due')||todayISO(),repeat:manualValue13('repeat')||'Wekelijks',secondWeekday:'',notes:manualValue13('notes')||'',category:manualValue13('category')||'',completedDates:[]};
    else if(t==='stock') item={id:id(),title,category:manualValue13('category')||'Overig',amount:num(manualValue13('amount'),0),min:num(manualValue13('min'),0),desired:num(manualValue13('desired'),0),unit:manualValue13('unit')||'stuks'};
    else if(t==='ideas') item={id:id(),title,category:manualValue13('category')||'Thuis',note:manualValue13('note')||'',icon:manualValue13('icon')||'♡'};
    else if(t==='home') item={id:id(),title,category:manualValue13('category')||'Onderhoud',due:manualValue13('due')||'',repeat:manualValue13('repeat')||'',note:manualValue13('note')||''};
    else if(t==='trips') {
      item={id:id(),title,tripFolderId:manualValue13('tripFolderId'),tripSectionId:manualValue13('tripSectionId'),date:manualValue13('date')||'',type:manualValue13('type')||'Notitie',note:manualValue13('note')||'',checkable:Boolean(manualValue13('checkable')),done:false};
      item=resolveTripDestination13(item);
    }
    if(!item) return;
    data[t].push(item);
    save(); render();
    toast(`Toegevoegd aan ${TARGETS[t]}`);
  }

  function bind13() {
    const target=document.querySelector('#v13Target');
    if(target) target.onchange=()=>{
      state13.target=target.value;
      state13.subtype=defaultSubtype(state13.target);
      state13.preview=[];
      if(state13.target==='trips'){
        state13.tripFolderId=data.tripFolders?.[0]?.id||'';
        state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      }
      render();
    };
    const subtype=document.querySelector('#v13Subtype');
    if(subtype) subtype.onchange=()=>{ state13.subtype=subtype.value; };

    const text=document.querySelector('#v13Text');
    if(text) text.oninput=()=>{ state13.text=text.value; };

    const importFolder=document.querySelector('#v14ImportTripFolder');
    if(importFolder) importFolder.onchange=()=>{
      state13.tripFolderId=importFolder.value;
      state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      render();
    };
    const importSection=document.querySelector('#v14ImportTripSection');
    if(importSection) importSection.onchange=()=>{state13.tripSectionId=importSection.value;};

    const manualFolder=document.querySelector('#v14TripFolder');
    if(manualFolder) manualFolder.onchange=()=>{
      state13.tripFolderId=manualFolder.value;
      state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      render();
    };

    const file=document.querySelector('#v13File');
    if(file) file.onchange=async()=>{
      const f=file.files?.[0]; if(!f) return;
      try{
        toast('Bestand wordt gelezen…');
        state13.filename=f.name;
        state13.text=await readFile13(f);
        analyse13();
      }catch(e){ console.error(e); toast('Bestand lezen is mislukt'); }
    };
  }

  render = function renderV13() {
    if (current === 'imports') {
      document.querySelector('#view').innerHTML=renderImports13();
      updateSyncBadge();
      bind13();
      return;
    }
    baseRender13();
  };

  document.addEventListener('click',e=>{
    const method=e.target.closest('[data-v14-method]');
    if(method){
      state13.method=method.dataset.v14Method;
      state13.preview=[];
      render();
      return;
    }
    if(e.target.closest('[data-v14-manual-save]')) { saveManual13(); return; }

    const v13Control = e.target.closest(
      '[data-v13-analyse],[data-v13-clear],[data-v13-all],[data-v13-none],[data-v13-commit],[data-v13-bulk]'
    );
    if(!v13Control) return;
    if(e.target.closest('[data-v13-analyse]')) { analyse13(); return; }
    if(e.target.closest('[data-v13-clear]')) { state13.text='';state13.filename='';state13.preview=[];render();return; }
    if(e.target.closest('[data-v13-all]')) { document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=true);return; }
    if(e.target.closest('[data-v13-none]')) { document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=false);return; }
    if(e.target.closest('[data-v13-commit]')) { commit13();return; }
    if(e.target.closest('[data-v13-bulk]')){
      syncCardEdits();
      const cat=document.querySelector('#v13BulkCategory')?.value.trim();
      const rep=document.querySelector('#v13BulkRepeat')?.value;
      const person=document.querySelector('#v13BulkPerson')?.value;
      state13.preview.filter(x=>x.selected).forEach(entry=>{
        if(cat) entry.item.category=cat;
        if(rep && state13.target==='chores') entry.item.repeat=rep;
        if(person && state13.target==='chores') entry.item.person=person;
      });
      render(); return;
    }
  },true);

  // Formulieren uitbreiden zodat nieuwe velden ook buiten import bruikbaar blijven.
  formConfig = function formConfigV13(view) {
    const cfg=baseFormConfig13(view);
    if(!cfg) return cfg;
    cfg.fields=(cfg.fields||[]).map(f=>[...f]);

    if(view==='stock' && !cfg.fields.some(f=>f[0]==='desired')){
      const minIndex=cfg.fields.findIndex(f=>f[0]==='min');
      cfg.fields.splice(minIndex>=0?minIndex+1:cfg.fields.length,0,['desired','Gewenste voorraad','number']);
    }
    if(view==='chores'){
      const r=cfg.fields.find(f=>f[0]==='repeat');
      if(r) r[3]=REPEATS;
      if(!cfg.fields.some(f=>f[0]==='category')) cfg.fields.push(['category','Categorie','text']);
    }
    if(view==='home'){
      if(!cfg.fields.some(f=>f[0]==='repeat')) cfg.fields.push(['repeat','Herhaling','select',['',...REPEATS]]);
    }
    return cfg;
  };

  // Bestaande voorraad migreren zonder gegevens kwijt te raken.
  (data.stock||[]).forEach(item=>{
    if(item.desired==null) item.desired=Math.max(Number(item.amount||0),Number(item.min||0));
  });
  (data.chores||[]).forEach(item=>{ item.category ||= 'Schoonmaak'; });
  (data.home||[]).forEach(item=>{ item.repeat ||= ''; });
  save({touch:false});

  toast('Samen Thuis v13 geladen');
})();
