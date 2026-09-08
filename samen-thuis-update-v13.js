/* CLEAN MASTER BUILD 2026-09-08 20:xx
   Samen Thuis v13.1
   Fix: gestructureerde reisdocumenten worden als blokken gelezen.
*/
console.info('Samen Thuis update 13.1 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V131__) return;
  window.__SAMEN_THUIS_V131__ = true;

  const TARGETS = {
    planning:'Agenda', meals:'Weekmenu', groceries:'Boodschappen',
    chores:'Huishouden', stock:'Voorraad', ideas:'Samen doen',
    home:'Woning', trips:'Reizen'
  };

  const SUBTYPES = {
    chores:['Reguliere schoonmaak','Periodieke schoonmaak','Was & textiel','Overig'],
    stock:['Huishoudvoorraad','Persoonlijke verzorging','Keuken basisvoorraad','Koelkast & vriezer','Overig'],
    home:['Onderhoud','Veiligheid','Organisatie','Seizoen','Garantie','Woninginfo'],
    trips:['Route & planning','Vervoer','Verblijf','Activiteiten','Boekingen & acties','Budget','Documenten','Paklijst','Overig']
  };

  const REPEATS = [
    'Eenmalig','Dagelijks','Om de dag','2× per week','3× per week','Wekelijks',
    'Elke 2 weken','Elke 4 weken','Maandelijks','Elke 2 maanden','Elke 3 maanden',
    'Elke 6 maanden','Jaarlijks','Na elke was','Wanneer nodig'
  ];

  const state13 = {
    target:'planning',
    subtype:'',
    method:'manual',
    text:'',
    filename:'',
    preview:[],
    tripFolderId:data.tripFolders?.[0]?.id || '',
    tripSectionId:'',
    detectedTripName:'',
    detectedTripStart:'',
    detectedTripEnd:''
  };

  const baseRender13 = render;
  const baseFormConfig13 = formConfig;

  function norm(s='') {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/&/g,' en ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }

  function cleanBullet(s='') {
    return String(s)
      .replace(/^\s*(?:[-•▪◦‣–—]|☐|□|☑|✓|✔|\[[ xX]?\])\s*/,'')
      .trim();
  }

  function num(v, fallback=0) {
    const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):fallback;
  }

  function boolWord(v) {
    return /^(1|ja|yes|true|aan|x|✓)$/i.test(String(v||'').trim());
  }

  function falseWord(v) {
    return /^(0|nee|no|false|uit)$/i.test(String(v||'').trim());
  }

  function isoDateFromText(s='') {
    let m=String(s).match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=String(s).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function normaliseRepeat(raw='') {
    const v=norm(String(raw).replace(/^frequentie\s*:\s*/i,''));
    const map=[
      [/^dagelijks$/,'Dagelijks'],[/^(om de dag|elke 2 dagen)$/,'Om de dag'],
      [/^(2x per week|2 per week|twee keer per week)$/,'2× per week'],
      [/^(3x per week|3 per week|drie keer per week)$/,'3× per week'],
      [/^wekelijks$/,'Wekelijks'],[/^(elke 2 weken|2 wekelijks|tweewekelijks)$/,'Elke 2 weken'],
      [/^(elke 4 weken|4 wekelijks)$/,'Elke 4 weken'],[/^maandelijks$/,'Maandelijks'],
      [/^(elke 2 maanden|2 maandelijks)$/,'Elke 2 maanden'],
      [/^(elke 3 maanden|kwartaal|kwartaallijks)$/,'Elke 3 maanden'],
      [/^(elke 6 maanden|halfjaarlijks)$/,'Elke 6 maanden'],
      [/^(jaarlijks|elk jaar|1x per jaar)$/,'Jaarlijks'],
      [/^(na elke was|na iedere was)$/,'Na elke was'],
      [/^(wanneer nodig|indien nodig|naar behoefte)$/,'Wanneer nodig'],
      [/^eenmalig$/,'Eenmalig']
    ];
    for(const [rx,label] of map) if(rx.test(v)) return label;
    return REPEATS.includes(raw)?raw:'Wekelijks';
  }

  function defaultSubtype(target) { return SUBTYPES[target]?.[0] || ''; }

  function keyValueLine(line='') {
    const m=cleanBullet(line).match(/^([^:]{2,40}):\s*(.*)$/);
    if(!m) return null;
    return {key:norm(m[1]), value:m[2].trim()};
  }

  function keyValueParts(line='') {
    const chunks=cleanBullet(line).split('|').map(x=>x.trim()).filter(Boolean);
    const title=chunks.shift()||'';
    const meta={}, loose=[];
    chunks.forEach(chunk=>{
      const m=chunk.match(/^([^:]{2,35}):\s*(.*)$/);
      if(m) meta[norm(m[1])]=m[2].trim();
      else loose.push(chunk);
    });
    return {title,meta,loose};
  }

  function stockCategory(raw, subtype) {
    if(raw) return raw;
    if(subtype==='Persoonlijke verzorging') return 'Badkamer';
    if(subtype==='Keuken basisvoorraad') return 'Voorraadkast';
    if(subtype==='Koelkast & vriezer') return 'Koelkast';
    return 'Overig';
  }

  function duplicateOf(target,item) {
    const arr=data[target]||[];
    return arr.find(existing=>{
      if(norm(existing.title||existing.name)!==norm(item.title||item.name)) return false;
      if(target==='trips' && item.tripFolderId && existing.tripFolderId) {
        return existing.tripFolderId===item.tripFolderId;
      }
      return true;
    });
  }

  function parseChore(line) {
    const {title,meta,loose}=keyValueParts(line);
    if(!title || /^(huishouden|was & textiel)/i.test(title)) return null;
    return {
      id:id(), title,
      person:meta['voor wie']||meta.persoon||'Samen',
      due:meta.datum||meta['eerste keer']||todayISO(),
      repeat:normaliseRepeat(meta.frequentie||meta.herhaling||loose[0]||'Wekelijks'),
      secondWeekday:'',
      notes:meta.notitie||meta.notes||meta.omschrijving||loose.slice(1).join(' · '),
      completedDates:[],
      category:meta.categorie||state13.subtype,
      importSubtype:state13.subtype
    };
  }

  function parseStock(line) {
    const {title,meta}=keyValueParts(line);
    if(!title || /^(huishoudvoorraad|persoonlijke verzorging|keuken basisvoorraad|koelkast)/i.test(title)) return null;
    const desired=num(meta.gewenst??meta.doel??meta.streefvoorraad,0);
    const minimum=num(meta.minimum??meta.min,0);
    const given=meta.aantal??meta['in huis']??meta.huidig;
    const amount=given!==undefined?num(given,0):0;
    return {
      id:id(), title,
      category:stockCategory(meta.categorie||meta.plek,state13.subtype),
      amount,min:minimum,desired:desired||Math.max(minimum,amount),
      unit:meta.eenheid||'stuks',importSubtype:state13.subtype
    };
  }

  function parseHome(line) {
    const {title,meta,loose}=keyValueParts(line);
    if(!title || /^(woningonderhoud|veiligheid|woningorganisatie|seizoenstaken)/i.test(title)) return null;
    const repeatRaw=meta.frequentie||meta.herhaling||'';
    return {
      id:id(),title,
      category:meta.categorie||state13.subtype||'Onderhoud',
      due:meta.datum||'',
      repeat:repeatRaw?normaliseRepeat(repeatRaw):'',
      note:meta.notitie||meta.omschrijving||loose.join(' · '),
      importSubtype:state13.subtype
    };
  }

  function findTripFolderByName(name='') {
    return (data.tripFolders||[]).find(f=>norm(f.name)===norm(name));
  }

  function findTripSectionByName(folderId,name='') {
    return (data.tripSections||[]).find(s=>s.tripFolderId===folderId && norm(s.name)===norm(name));
  }

  function selectedTripFolder() {
    return (data.tripFolders||[]).find(f=>f.id===state13.tripFolderId) || data.tripFolders?.[0] || null;
  }

  function selectedTripSection(folderId) {
    const selected=(data.tripSections||[]).find(s=>s.id===state13.tripSectionId && s.tripFolderId===folderId);
    return selected || (data.tripSections||[]).find(s=>s.tripFolderId===folderId) || null;
  }

  function travelSection(type='',title='') {
    const s=norm(`${type} ${title}`);
    if(/paklijst|reisapotheek|meenemen|kleding|schoenen|outdoor|elektronica/.test(s)) return 'Paklijst';
    if(/verblijf|hotel|homestay|overnachting/.test(s)) return 'Verblijf';
    if(/budget|dagbudget|spaardoel|budgetsamenvatting|budgetnotitie/.test(s)) return 'Budget';
    if(/taak|voorbereiding|gezondheidstaak|boeking|reserver/.test(s)) return 'Boekingen & acties';
    if(/document|visum|paspoort|verzekering/.test(s)) return 'Documenten';
    if(/planning|route/.test(s)) return 'Route & planning';
    if(/vervoer|vlucht|transfer|limousine|trein|bus/.test(s)) return 'Vervoer';
    if(/activiteit|wellness|tip|eten|food|massage|spa|manicure|facial|head spa|canyoning|rafting|workshop/.test(s)) return 'Activiteiten';
    return state13.subtype || 'Overig';
  }

  function travelType(line, subtype='') {
    const s=norm(`${line} ${subtype}`);
    if(/paklijst|meenemen|inpakken|reisapotheek/.test(s)) return 'Paklijst';
    if(/hotel|homestay|verblijf|overnacht/.test(s)) return 'Verblijf';
    if(/vlucht|trein|bus|transfer|taxi|grab|vervoer|ferry|cruise|limousine/.test(s)) return 'Vervoer';
    if(/budget|prijs|kosten|spaardoel|euro|vnd/.test(s)) return 'Budget';
    if(/paspoort|visum|verzekering|document|gezondheid|vaccin/.test(s)) return 'Documenten';
    if(/boeken|vastleggen|reserveren|regelen|controleren|afspraak|taak/.test(s)) return 'Voorbereiding';
    if(/restaurant|eten|food|coffee|koffie/.test(s)) return 'Eten';
    if(/activiteit|tour|cave|rafting|canyoning|massage|spa|tailor|workshop|strand|museum|wellness/.test(s)) return 'Activiteit';
    return 'Notitie';
  }

  function detectTripMeta(lines) {
    state13.detectedTripName='';
    state13.detectedTripStart='';
    state13.detectedTripEnd='';

    for(const line of lines.slice(0,40)) {
      let m=line.match(/^Reis:\s*(.+)$/i);
      if(m) state13.detectedTripName=m[1].trim();
      m=line.match(/^(.+?\b20\d{2})\s*-\s*\d+\b/i);
      if(m && !state13.detectedTripName) state13.detectedTripName=m[1].trim();
    }

    // Record "Reis: X" is followed by metadata in our importdocument.
    const reisIndex=lines.findIndex(x=>/^Reis:\s*/i.test(x));
    if(reisIndex>=0) {
      for(let i=reisIndex+1;i<Math.min(lines.length,reisIndex+12);i++) {
        const kv=keyValueLine(lines[i]);
        if(!kv) break;
        if(kv.key==='startdatum') state13.detectedTripStart=isoDateFromText(kv.value)||kv.value;
        if(kv.key==='einddatum') state13.detectedTripEnd=isoDateFromText(kv.value)||kv.value;
      }
    }

    // Fallback: document title "Vietnam 2027 - 01 Reisplanning"
    if(!state13.detectedTripName && state13.filename) {
      const m=state13.filename.replace(/\.[^.]+$/,'').match(/^(.+?20\d{2})[_ -]/);
      if(m) state13.detectedTripName=m[1].replace(/_/g,' ').trim();
    }

    state13.detectedTripName ||= selectedTripFolder()?.name || 'Nieuwe reis';
  }

  const META_KEYS=new Set([
    'type','locatie','startdatum','einddatum','datum','deadline','afvinken','afvinkbaar',
    'belangrijk','personen','route','details','notitie','notes','categorie','prijs','bedrag',
    'status','plaats','person','voor wie','frequentie','herhaling','eenheid'
  ]);

  function isDocumentNoise(line='') {
    const s=String(line).trim();
    return !s ||
      /^Samen Thuis importdocument\b/i.test(s) ||
      /^IMPORTINSTRUCTIE:/i.test(s) ||
      /^Vietnam 20\d{2}\s*-\s*\d+/i.test(s) ||
      /^Reis:\s*/i.test(s) ||
      /^(Type|Startdatum|Einddatum|Afvinken|Belangrijk|Personen|Route):\s*/i.test(s) && false;
  }

  function structuredTravelBlocks(text) {
    const rawLines=String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    detectTripMeta(rawLines);

    const skipIndexes=new Set();
    const reisIndex=rawLines.findIndex(x=>/^Reis:\s*/i.test(x));
    if(reisIndex>=0) {
      skipIndexes.add(reisIndex);
      for(let i=reisIndex+1;i<Math.min(rawLines.length,reisIndex+15);i++) {
        const kv=keyValueLine(rawLines[i]);
        if(!kv || !META_KEYS.has(kv.key)) break;
        skipIndexes.add(i);
      }
    }

    const blocks=[];
    let current=null;

    function pushCurrent() {
      if(!current) return;
      if(current.title && !isDocumentNoise(current.title)) blocks.push(current);
      current=null;
    }

    rawLines.forEach((line,idx)=>{
      if(skipIndexes.has(idx)) return;
      if(/^Samen Thuis importdocument\b/i.test(line) || /^IMPORTINSTRUCTIE:/i.test(line)) return;
      if(/^Vietnam 20\d{2}\s*-\s*\d+/i.test(line)) return;

      const kv=keyValueLine(line);
      if(kv && META_KEYS.has(kv.key)) {
        if(!current) return; // metadata zonder hoofdonderwerp negeren
        current.meta[kv.key]=kv.value;
        return;
      }

      // Een gewone regel is een nieuw hoofditem.
      pushCurrent();
      current={title:cleanBullet(line),meta:{}};
    });

    pushCurrent();
    return blocks;
  }

  function blockToTrip(block) {
    const m=block.meta||{};
    const title=block.title?.trim();
    if(!title) return null;

    const type=m.type || travelType(title,'');
    const sectionName=travelSection(type,title);
    const startDate=isoDateFromText(m.startdatum||m.datum||m.deadline||'');
    const endDate=isoDateFromText(m.einddatum||'') || startDate;
    let checkable=false;
    if(m.afvinken!==undefined) checkable=boolWord(m.afvinken);
    else if(m.afvinkbaar!==undefined) checkable=boolWord(m.afvinkbaar);
    else checkable=/\b(boek|boeken|vastleggen|reserveer|reserveren|regel|regelen|controleer|controleren|download|meenemen|inpakken)\b/i.test(title);

    const important=m.belangrijk!==undefined ? boolWord(m.belangrijk) : false;

    const notes=[];
    if(m.details) notes.push(m.details);
    if(m.notitie) notes.push(m.notitie);
    if(m.notes) notes.push(m.notes);
    if(m.locatie) notes.push(`Locatie: ${m.locatie}`);
    if(m.prijs) notes.push(`Prijs: ${m.prijs}`);
    if(m.bedrag) notes.push(`Bedrag: ${m.bedrag}`);
    if(m.status) notes.push(`Status: ${m.status}`);
    if(m.categorie) notes.push(`Categorie: ${m.categorie}`);

    const folder=findTripFolderByName(state13.detectedTripName);
    const section=folder?findTripSectionByName(folder.id,sectionName):null;

    return {
      id:id(),
      tripFolderId:folder?.id||'',
      tripSectionId:section?.id||'',
      title,
      date:startDate || endDate || '',
      startDate:startDate||'',
      endDate:endDate||'',
      type,
      note:notes.join('\n'),
      checkable,
      important,
      done:false,
      _pendingFolderName:folder?'':state13.detectedTripName,
      _pendingSectionName:section?'':sectionName
    };
  }

  function parseTripLegacy(line) {
    const source=cleanBullet(line);
    if(!source) return null;
    const {title,meta}=keyValueParts(source);
    const itemTitle=title||source;
    if(!itemTitle || /^[A-ZÀ-Ÿ &/-]{3,}:?$/.test(itemTitle)) return null;
    const folder=selectedTripFolder();
    const section=folder?selectedTripSection(folder.id):null;
    return {
      id:id(),tripFolderId:folder?.id||'',tripSectionId:section?.id||'',
      title:itemTitle,
      date:meta.datum||meta.deadline||isoDateFromText(source),
      startDate:meta.startdatum||'',
      endDate:meta.einddatum||'',
      type:meta.type||meta.soort||travelType(itemTitle,state13.subtype),
      note:meta.notitie||meta.notes||'',
      checkable:boolWord(meta.afvinkbaar||meta.afvinken) || /\b(boeken|vastleggen|reserveren|regelen|controleren|afspraak|downloaden|meenemen|inpakken)\b/i.test(itemTitle),
      important:boolWord(meta.belangrijk),
      done:false
    };
  }

  function parseGeneric(line,target) {
    const clean=cleanBullet(line);
    if(!clean) return null;
    if(target==='ideas') return {id:id(),title:clean,category:'Thuis',note:'',icon:'♡'};
    return null;
  }

  function parseLines13(text,target) {
    if(target==='planning'||target==='meals'||target==='groceries') return null;

    if(target==='trips') {
      const structured=structuredTravelBlocks(text);
      let items=structured.map(blockToTrip).filter(Boolean);

      // Als er geen blokstructuur is, val terug op de oude regelparser.
      if(!items.length) {
        items=String(text||'').replace(/\r/g,'').split(/\n+/)
          .map(x=>x.trim()).filter(Boolean).slice(0,350)
          .map(parseTripLegacy).filter(Boolean);
      }

      return items.map(item=>{
        const dup=duplicateOf(target,item);
        return {selected:!dup,item,duplicate:dup?dup.id:''};
      });
    }

    const lines=String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean)
      .filter(x=>!/^#\s*(pagina|werkblad)\b/i.test(x))
      .filter(x=>!/^(aanbevolen uploadvolgorde|belangrijk|importregels|beperkingen|uitgangspunt woning)$/i.test(x));

    const parser=target==='chores'?parseChore:
      target==='stock'?parseStock:
      target==='home'?parseHome:
      line=>parseGeneric(line,target);

    return lines.slice(0,350).map(parser).filter(Boolean).map(item=>{
      const dup=duplicateOf(target,item);
      return {selected:!dup,item,duplicate:dup?dup.id:''};
    });
  }

  function field(label,html,cls='') {
    return `<div class="field ${cls}"><label>${esc(label)}</label>${html}</div>`;
  }

  function optionList(values,selected) {
    return values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  }

  function previewMeta(item,target) {
    if(target==='stock') return `${item.category} · huidig ${item.amount} · minimum ${item.min} · gewenst ${item.desired} ${item.unit}`;
    if(target==='chores') return `${item.repeat} · ${item.person}${item.category?' · '+item.category:''}`;
    if(target==='home') return `${item.category}${item.repeat?' · '+item.repeat:''}${item.due?' · '+item.due:''}`;
    if(target==='trips') {
      const folder=(data.tripFolders||[]).find(f=>f.id===item.tripFolderId)?.name || item._pendingFolderName || state13.detectedTripName || 'Nieuwe/gekozen reis';
      const section=(data.tripSections||[]).find(s=>s.id===item.tripSectionId)?.name || item._pendingSectionName || state13.subtype || 'Algemeen';
      const dates=item.startDate&&item.endDate&&item.startDate!==item.endDate?`${item.startDate} → ${item.endDate}`:(item.date||item.startDate||'');
      return `${folder} › ${section} · ${item.type}${dates?' · '+dates:''}${item.checkable?' · afvinken':''}${item.important?' · ★ belangrijk':''}`;
    }
    return item.category||TARGETS[target]||'';
  }

  function previewEditor(entry) {
    const x=entry.item,t=state13.target;
    if(t==='stock') return `
      ${field('Product',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v13-field="amount" value="${x.amount}">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v13-field="min" value="${x.min}">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v13-field="desired" value="${x.desired}">`)}
      ${field('Eenheid',`<input data-v13-field="unit" value="${esc(x.unit)}">`)}`;
    if(t==='chores') return `
      ${field('Taak',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Frequentie',`<select data-v13-field="repeat">${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Voor wie',`<select data-v13-field="person">${optionList(['Samen','Kees','Daphne'],x.person)}</select>`)}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category||'')}">`)}
      ${field('Eerste keer',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="notes">${esc(x.notes||'')}</textarea>`,'full')}`;
    if(t==='home') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Frequentie',`<select data-v13-field="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Datum',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    if(t==='trips') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Startdatum',`<input type="date" data-v13-field="startDate" value="${esc(x.startDate||x.date||'')}">`)}
      ${field('Einddatum',`<input type="date" data-v13-field="endDate" value="${esc(x.endDate||x.startDate||x.date||'')}">`)}
      ${field('Soort',`<input data-v13-field="type" value="${esc(x.type||'Notitie')}">`)}
      <label class="checkbox-field"><input type="checkbox" data-v13-field="checkable" ${x.checkable?'checked':''}><span>Afvinkbaar</span></label>
      <label class="checkbox-field"><input type="checkbox" data-v13-field="important" ${x.important?'checked':''}><span>Belangrijk ★</span></label>
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    return field('Titel',`<input data-v13-field="title" value="${esc(x.title||'')}">`,'full');
  }

  function manualForm13() {
    const t=state13.target;
    const calendars=data.calendars||[];
    const tripFolders=data.tripFolders||[];
    const folder=selectedTripFolder();
    const sections=(data.tripSections||[]).filter(s=>s.tripFolderId===folder?.id);

    if(t==='planning') return `
      ${field('Wat?',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Begintijd',`<input type="time" data-v14-manual="time">`)}
      ${field('Eindtijd',`<input type="time" data-v14-manual="endTime">`)}
      ${field('Agenda',`<select data-v14-manual="calendarId">${calendars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>`)}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}`;
    if(t==='meals') return `
      ${field('Gerecht',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Moment',`<select data-v14-manual="type">${optionList(['Ontbijt','Lunch','Avondeten','Snack'],'Avondeten')}</select>`)}`;
    if(t==='groceries') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(GROCERY_CATEGORIES,'Overig')}</select>`)}`;
    if(t==='chores') return `
      ${field('Taak',`<input data-v14-manual="title" required>`,'full')}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}
      ${field('Eerste keer',`<input type="date" data-v14-manual="due" value="${todayISO()}">`)}
      ${field('Frequentie',`<select data-v14-manual="repeat">${optionList(REPEATS,'Wekelijks')}</select>`)}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype||'Reguliere schoonmaak')}">`)}
      ${field('Notitie',`<textarea data-v14-manual="notes"></textarea>`,'full')}`;
    if(t==='stock') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(stockCategory('',state13.subtype))}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v14-manual="amount" value="0">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v14-manual="min" value="0">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v14-manual="desired" value="0">`)}
      ${field('Eenheid',`<input data-v14-manual="unit" value="stuks">`)}`;
    if(t==='ideas') return `
      ${field('Idee',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(['Thuis','Uit','Actief','Gratis','Eten'],'Thuis')}</select>`)}
      ${field('Emoji',`<input data-v14-manual="icon" value="♡">`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;
    if(t==='home') return `
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype||'Onderhoud')}">`)}
      ${field('Datum',`<input type="date" data-v14-manual="due">`)}
      ${field('Herhaling',`<select data-v14-manual="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,'')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;
    if(t==='trips') return `
      ${field('Reis',`<select id="v14TripFolder" data-v14-manual="tripFolderId">${tripFolders.map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
      ${field('Map binnen de reis',`<select data-v14-manual="tripSectionId">${sections.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Startdatum',`<input type="date" data-v14-manual="startDate">`)}
      ${field('Einddatum',`<input type="date" data-v14-manual="endDate">`)}
      ${field('Soort',`<select data-v14-manual="type">${optionList(['Voorbereiding','Reservering','Vervoer','Verblijf','Activiteit','Eten','Budget','Documenten','Paklijst','Notitie'],'Notitie')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}
      <label class="checkbox-field"><input type="checkbox" data-v14-manual="checkable"><span>Dit moet afgevinkt worden</span></label>
      <label class="checkbox-field"><input type="checkbox" data-v14-manual="important"><span>Belangrijk ★</span></label>`;
    return '';
  }

  function destinationFields13() {
    if(state13.target==='trips') {
      const detected=state13.detectedTripName?`<div class="field full"><small class="muted">Automatisch herkende reis: <strong>${esc(state13.detectedTripName)}</strong>. De documentstructuur heeft voorrang op de standaardkeuze.</small></div>`:'';
      const folder=selectedTripFolder();
      const sections=(data.tripSections||[]).filter(s=>s.tripFolderId===folder?.id);
      return `
        ${field('Standaard reis',`<select id="v14ImportTripFolder">${(data.tripFolders||[]).map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
        ${field('Standaard map',`<select id="v14ImportTripSection">${sections.map(s=>`<option value="${esc(s.id)}" ${s.id===state13.tripSectionId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`)}
        ${detected}`;
    }
    const subtypes=SUBTYPES[state13.target]||[];
    return subtypes.length?field('Standaard categorie/map',`<select id="v13Subtype">${subtypes.map(v=>`<option ${v===state13.subtype?'selected':''}>${esc(v)}</option>`).join('')}</select>`):'';
  }

  function renderImports13() {
    const methodLabel=state13.method==='manual'?'Handmatig invoeren':state13.method==='file'?'Bestand uploaden':'Tekst plakken';
    return `<div class="import-v13">
      <section class="card">
        <div class="card-head"><div><p class="eyebrow">SAMEN THUIS · CENTRALE INVOER</p><h2>Toevoegen & importeren</h2></div><span class="tag green">${esc(methodLabel)}</span></div>
        <p>Kies waar het hoort en daarna hoe je het wilt toevoegen.</p>
        <div class="form-grid">
          ${field('Waar hoort dit bij?',`<select id="v13Target">${Object.entries(TARGETS).map(([k,v])=>`<option value="${k}" ${k===state13.target?'selected':''}>${esc(v)}</option>`).join('')}</select>`)}
          ${state13.method!=='manual'?destinationFields13():''}
        </div>
        <div class="v14-methods">
          <button class="${state13.method==='manual'?'primary':'secondary'}" data-v14-method="manual">✏️ Handmatig</button>
          <button class="${state13.method==='file'?'primary':'secondary'}" data-v14-method="file">📄 Bestand uploaden</button>
          <button class="${state13.method==='text'?'primary':'secondary'}" data-v14-method="text">📋 Tekst plakken</button>
        </div>
        ${state13.method==='manual'?`
          <div class="form-grid v14-manual-form">${manualForm13()}</div>
          <div class="button-row"><button class="primary" data-v14-manual-save>Opslaan</button></div>
        `:state13.method==='file'?`
          <div class="form-grid">${field('Bestand',`<input id="v13File" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,text/plain">`,'full')}</div>
          ${state13.filename?`<p class="muted">Bron: <strong>${esc(state13.filename)}</strong></p>`:''}
          <p class="muted">Na kiezen wordt het bestand automatisch gelezen en geanalyseerd.</p>
        `:`
          <div class="form-grid">${field('Tekst/lijst plakken',`<textarea id="v13Text">${esc(state13.text)}</textarea>`,'full')}</div>
          <div class="button-row"><button class="primary" data-v13-analyse>Analyseren</button><button class="secondary" data-v13-clear>Leegmaken</button></div>
        `}
      </section>

      ${state13.method!=='manual'?(state13.preview.length?`<section class="card v13-preview">
        <div class="card-head"><div><p class="eyebrow">CONTROLE</p><h2>${state13.preview.length} gevonden items</h2></div>
          <div class="button-row"><button class="secondary" data-v13-all>Alles selecteren</button><button class="secondary" data-v13-none>Niets</button><button class="primary" data-v13-commit>Geselecteerde toevoegen</button></div>
        </div>
        ${state13.target==='trips'&&state13.detectedTripName?`<p class="muted">Bestemming: <strong>Reizen → ${esc(state13.detectedTripName)}</strong>${state13.detectedTripStart?` · ${esc(state13.detectedTripStart)}`:''}${state13.detectedTripEnd?` t/m ${esc(state13.detectedTripEnd)}`:''}</p>`:''}
        ${['chores','stock','home'].includes(state13.target)?`<div class="v13-bulk">
          <strong>Bulk aanpassen</strong>
          ${state13.target==='chores'?`<select id="v13BulkRepeat"><option value="">Frequentie behouden</option>${REPEATS.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          <select id="v13BulkPerson"><option value="">Persoon behouden</option><option>Samen</option><option>Kees</option><option>Daphne</option></select>`:''}
          <input id="v13BulkCategory" placeholder="Categorie (optioneel)">
          <button class="secondary" data-v13-bulk>Toepassen op geselecteerde</button>
        </div>`:''}
        <div class="v13-preview-list">${state13.preview.map((entry,i)=>`
          <article class="v13-card ${entry.duplicate?'duplicate':''}" data-v13-card="${i}">
            <div class="v13-card-head">
              <label><input type="checkbox" data-v13-selected ${entry.selected?'checked':''}> Importeren</label>
              ${entry.duplicate?'<span class="tag warning">Mogelijk al aanwezig · standaard overgeslagen</span>':''}
            </div>
            <div class="v13-fields">${previewEditor(entry)}</div>
            <small class="muted">${esc(previewMeta(entry.item,state13.target))}</small>
          </article>`).join('')}</div>
      </section>`:`<section class="card"><p class="muted">Nog niets geanalyseerd.</p></section>`):''}
    </div>`;
  }

  async function loadExternal13(src,test) {
    if(test()) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  async function readFile13(file) {
    const ext=file.name.toLowerCase().split('.').pop();
    if(['txt','md','csv'].includes(ext)) return file.text();
    if(ext==='pdf') return extractPdfText(file);
    if(ext==='docx') {
      await loadExternal13('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',()=>Boolean(window.mammoth));
      return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
    }
    if(['xlsx','xlsm','xls'].includes(ext)) {
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
      if(entry.item.startDate) entry.item.date=entry.item.startDate;
    });
  }

  function analyse13() {
    const special=parseLines13(state13.text,state13.target);
    if(special!==null) {
      state13.preview=special;
      render();
      toast(`${state13.preview.length} items gevonden`);
      return;
    }

    const lines=String(state13.text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(state13.target==='groceries') {
      state13.preview=parseGroceryText(state13.text).slice(0,300).map(x=>({selected:true,item:{id:id(),...x}}));
    } else if(state13.target==='planning') {
      state13.preview=lines.filter(x=>isoDateFromText(x)).map(x=>({selected:true,item:{
        id:id(),title:x.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/,'').trim()||'Afspraak',
        date:isoDateFromText(x),time:'',endTime:'',person:'Samen',calendarId:data.calendars[0]?.id||'persoonlijk'
      }}));
    } else if(state13.target==='meals') {
      const start=startOfWeek(todayISO());
      state13.preview=lines.slice(0,7).map((x,i)=>({selected:true,item:{id:id(),date:addDays(start,i),type:'Avondeten',title:cleanBullet(x)}}));
    }
    render();
    toast(`${state13.preview.length} items gevonden`);
  }

  function resolveTripDestination13(item) {
    data.tripFolders ||= [];
    data.tripSections ||= [];
    data.trips ||= [];

    const wantedFolder=item._pendingFolderName || state13.detectedTripName || '';
    let folder=(data.tripFolders||[]).find(f=>f.id===item.tripFolderId);

    if(!folder && wantedFolder) {
      folder=findTripFolderByName(wantedFolder);
      if(!folder) {
        folder={
          id:id(),name:wantedFolder,
          startDate:state13.detectedTripStart||'',
          endDate:state13.detectedTripEnd||'',
          note:'Aangemaakt via centrale invoer'
        };
        data.tripFolders.push(folder);
      }
    }
    if(!folder) folder=selectedTripFolder();
    if(!folder) return item;

    // Periode van de reis aanvullen wanneer die uit het document komt.
    if(state13.detectedTripStart && !folder.startDate) folder.startDate=state13.detectedTripStart;
    if(state13.detectedTripEnd && !folder.endDate) folder.endDate=state13.detectedTripEnd;

    const wantedSection=item._pendingSectionName || travelSection(item.type,item.title);
    let section=(data.tripSections||[]).find(s=>s.id===item.tripSectionId && s.tripFolderId===folder.id);
    if(!section) section=findTripSectionByName(folder.id,wantedSection);
    if(!section) {
      section={id:id(),tripFolderId:folder.id,name:wantedSection};
      data.tripSections.push(section);
    }

    const clean={...item,tripFolderId:folder.id,tripSectionId:section.id};
    delete clean._pendingFolderName;
    delete clean._pendingSectionName;
    clean.date=clean.startDate||clean.date||clean.endDate||'';
    return clean;
  }

  function commit13() {
    syncCardEdits();
    let selected=state13.preview.filter(x=>x.selected).map(x=>x.item);
    if(!selected.length) return toast('Selecteer minimaal één item');
    if(state13.target==='trips') selected=selected.map(resolveTripDestination13);

    data[state13.target] ||= [];
    data[state13.target].push(...selected);
    save();

    const count=selected.length;
    state13.preview=[];state13.text='';state13.filename='';
    render();
    toast(`${count} items toegevoegd aan ${TARGETS[state13.target]}`);
  }

  function manualValue13(name) {
    const el=document.querySelector(`[data-v14-manual="${name}"]`);
    if(!el) return '';
    return el.type==='checkbox'?el.checked:el.value;
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
      const startDate=manualValue13('startDate')||'';
      item={id:id(),title,tripFolderId:manualValue13('tripFolderId'),tripSectionId:manualValue13('tripSectionId'),date:startDate,startDate,endDate:manualValue13('endDate')||startDate,type:manualValue13('type')||'Notitie',note:manualValue13('note')||'',checkable:Boolean(manualValue13('checkable')),important:Boolean(manualValue13('important')),done:false};
      item=resolveTripDestination13(item);
    }
    if(!item) return;
    data[t] ||= [];
    data[t].push(item);
    save();render();
    toast(`Toegevoegd aan ${TARGETS[t]}`);
  }

  function bind13() {
    const target=document.querySelector('#v13Target');
    if(target) target.onchange=()=>{
      state13.target=target.value;
      state13.subtype=defaultSubtype(state13.target);
      state13.preview=[];
      if(state13.target==='trips') {
        state13.tripFolderId=data.tripFolders?.[0]?.id||'';
        state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      }
      render();
    };

    const subtype=document.querySelector('#v13Subtype');
    if(subtype) subtype.onchange=()=>{state13.subtype=subtype.value;};

    const text=document.querySelector('#v13Text');
    if(text) text.oninput=()=>{state13.text=text.value;};

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
      const f=file.files?.[0];
      if(!f) return;
      try {
        toast('Bestand wordt gelezen…');
        state13.filename=f.name;
        state13.text=await readFile13(f);

        // Voor onze Samen Thuis-reisdocumenten automatisch naar Reizen.
        if(/\bReis:\s*.+20\d{2}\b/i.test(state13.text) || /Samen Thuis importdocument/i.test(state13.text) && /\b(Startdatum|Einddatum|Afvinken|Belangrijk):/i.test(state13.text)) {
          state13.target='trips';
          state13.subtype='Route & planning';
        }

        analyse13();
      } catch(e) {
        console.error(e);
        toast('Bestand lezen is mislukt');
      }
    };
  }

  render=function renderV131() {
    if(current==='imports') {
      document.querySelector('#view').innerHTML=renderImports13();
      updateSyncBadge();
      bind13();
      return;
    }
    baseRender13();
  };

  document.addEventListener('click',e=>{
    const method=e.target.closest('[data-v14-method]');
    if(method) {
      state13.method=method.dataset.v14Method;
      state13.preview=[];
      render();
      return;
    }
    if(e.target.closest('[data-v14-manual-save]')) {saveManual13();return;}

    const ctl=e.target.closest('[data-v13-analyse],[data-v13-clear],[data-v13-all],[data-v13-none],[data-v13-commit],[data-v13-bulk]');
    if(!ctl) return;

    if(e.target.closest('[data-v13-analyse]')) {analyse13();return;}
    if(e.target.closest('[data-v13-clear]')) {
      state13.text='';state13.filename='';state13.preview=[];state13.detectedTripName='';render();return;
    }
    if(e.target.closest('[data-v13-all]')) {
      document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=true);return;
    }
    if(e.target.closest('[data-v13-none]')) {
      document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=false);return;
    }
    if(e.target.closest('[data-v13-commit]')) {commit13();return;}
    if(e.target.closest('[data-v13-bulk]')) {
      syncCardEdits();
      const cat=document.querySelector('#v13BulkCategory')?.value.trim();
      const rep=document.querySelector('#v13BulkRepeat')?.value;
      const person=document.querySelector('#v13BulkPerson')?.value;
      state13.preview.filter(x=>x.selected).forEach(entry=>{
        if(cat) entry.item.category=cat;
        if(rep&&state13.target==='chores') entry.item.repeat=rep;
        if(person&&state13.target==='chores') entry.item.person=person;
      });
      render();return;
    }
  },true);

  formConfig=function formConfigV131(view) {
    const cfg=baseFormConfig13(view);
    if(!cfg) return cfg;
    cfg.fields=(cfg.fields||[]).map(f=>[...f]);

    if(view==='stock'&&!cfg.fields.some(f=>f[0]==='desired')) {
      const minIndex=cfg.fields.findIndex(f=>f[0]==='min');
      cfg.fields.splice(minIndex>=0?minIndex+1:cfg.fields.length,0,['desired','Gewenste voorraad','number']);
    }
    if(view==='chores') {
      const r=cfg.fields.find(f=>f[0]==='repeat');
      if(r) r[3]=REPEATS;
      if(!cfg.fields.some(f=>f[0]==='category')) cfg.fields.push(['category','Categorie','text']);
    }
    if(view==='home'&&!cfg.fields.some(f=>f[0]==='repeat')) {
      cfg.fields.push(['repeat','Herhaling','select',['',...REPEATS]]);
    }
    return cfg;
  };

  (data.stock||[]).forEach(item=>{
    if(item.desired==null) item.desired=Math.max(Number(item.amount||0),Number(item.min||0));
  });
  (data.chores||[]).forEach(item=>{item.category||='Schoonmaak';});
  (data.home||[]).forEach(item=>{item.repeat||='';});
  (data.trips||[]).forEach(item=>{
    if(item.startDate==null) item.startDate=item.date||'';
    if(item.endDate==null) item.endDate=item.startDate||item.date||'';
    if(item.important==null) item.important=false;
  });

  save({touch:false});
  toast('Samen Thuis v13.1 geladen');
})();
