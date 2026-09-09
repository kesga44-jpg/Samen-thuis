/* Samen Thuis v14.0 — universele importlaag
   Eén vast importformaat voor Agenda t/m Reizen.
   Ondersteunt | ; tab, " / " en " - " als scheidingsteken.
   Datums zoals 2027-01-08 blijven intact.
*/
console.info('Samen Thuis update 14.1 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V140__) return;
  window.__SAMEN_THUIS_V140__ = true;

  const baseRender14 = render;

  const TARGETS14 = {
    planning:'Agenda', meals:'Weekmenu', groceries:'Boodschappen', chores:'Huishouden',
    stock:'Voorraad', ideas:'Ideeën', home:'Woning', trips:'Reizen'
  };

  const ALIASES14 = {
    agenda:'planning', planning:'planning', kalender:'planning', afspraak:'planning', afspraken:'planning',
    weekmenu:'meals', menu:'meals', maaltijd:'meals', maaltijden:'meals', eten:'meals',
    boodschappen:'groceries', boodschap:'groceries', grocery:'groceries', groceries:'groceries',
    huishouden:'chores', huishoudelijk:'chores', schoonmaak:'chores', taak:'chores', taken:'chores',
    voorraad:'stock', stock:'stock', inventaris:'stock',
    idee:'ideas', ideeen:'ideas', ideeenlijst:'ideas', samen_doen:'ideas',
    woning:'home', huis:'home', onderhoud:'home',
    reizen:'trips', reis:'trips', vakantie:'trips', travel:'trips'
  };

  const SCHEMAS14 = {
    planning:['type','title','startDate','startTime','endDate','endTime','allDay','location','description','repeat'],
    meals:['type','date','mealType','title','persons','ingredients','note'],
    groceries:['type','title','amount','unit','category','store','forMeal','done','note'],
    chores:['type','title','category','repeat','person','startDate','nextDate','priority','done','notes'],
    stock:['type','title','category','amount','unit','minimum','bestBefore','location','note'],
    ideas:['type','title','category','description','person','priority','status','date','note'],
    home:['type','title','category','description','kind','priority','startDate','deadline','status','cost','done','note'],
    trips:['type','trip','section','title','kind','description','startDate','endDate','deadline','location','cost','priority','checkable','done','note']
  };

  const state14 = { target:'planning', text:'', filename:'', preview:[], legacy:false };

  const esc14 = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const norm14 = value => String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const clean14 = value => String(value ?? '').trim().replace(/^\[(.*)\]$/,'$1').trim();

  function bool14(value, fallback=false) {
    const v=norm14(value);
    if(['1','ja','yes','true','aan','x','afgevinkt','klaar','gedaan'].includes(v)) return true;
    if(['0','nee','no','false','uit','open','niet afgevinkt'].includes(v)) return false;
    return fallback;
  }

  function priority14(value='') {
    const v=norm14(value);
    if(/urgent|belangrijk|high|hoog/.test(v)) return 'hoog';
    if(/low|laag/.test(v)) return 'laag';
    if(/normaal|normal|medium|midden/.test(v)) return 'normaal';
    return value ? String(value).trim() : '';
  }

  function repeat14(value='') {
    const v=norm14(String(value).replace(/^frequentie\s*:?\s*/i,''));
    if(!v) return '';
    if(/^(dagelijks|elke dag|iedere dag|daily)$/.test(v)) return 'Dagelijks';
    if(/^(om de dag|elke 2 dagen)$/.test(v)) return 'Om de dag';
    if(/^(2x per week|2 per week|twee keer per week|twice weekly)$/.test(v)) return '2× per week';
    if(/^(3x per week|3 per week|drie keer per week)$/.test(v)) return '3× per week';
    if(/^(wekelijks|iedere week|elke week|weekly)$/.test(v)) return 'Wekelijks';
    if(/^(elke 2 weken|om de week|tweewekelijks|biweekly)$/.test(v)) return 'Elke 2 weken';
    if(/^(elke 4 weken|4 wekelijks)$/.test(v)) return 'Elke 4 weken';
    if(/^(maandelijks|iedere maand|elke maand|monthly)$/.test(v)) return 'Maandelijks';
    if(/^(elke 2 maanden|2 maandelijks)$/.test(v)) return 'Elke 2 maanden';
    if(/^(elke 3 maanden|kwartaal|kwartaallijks|quarterly)$/.test(v)) return 'Elke 3 maanden';
    if(/^(elke 6 maanden|halfjaarlijks|semiannual)$/.test(v)) return 'Elke 6 maanden';
    if(/^(jaarlijks|ieder jaar|elk jaar|1x per jaar|yearly)$/.test(v)) return 'Jaarlijks';
    if(/^(na elke was|na iedere was)$/.test(v)) return 'Na elke was';
    if(/^(wanneer nodig|indien nodig|naar behoefte)$/.test(v)) return 'Wanneer nodig';
    if(/^(eenmalig|once)$/.test(v)) return 'Eenmalig';
    return String(value).trim();
  }

  function iso14(value='') {
    const s=String(value).trim();
    let m=s.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return s;
  }

  function number14(value, fallback=0) {
    const m=String(value ?? '').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : fallback;
  }

  function split14(line='') {
    const raw=String(line).trim();
    let parts;
    if(raw.includes('|')) parts=raw.split('|');
    else if(raw.includes(';')) parts=raw.split(';');
    else if(raw.includes('\t')) parts=raw.split(/\t+/);
    else if(/\s\/\s/.test(raw)) parts=raw.split(/\s+\/\s+/);
    else if(/\s[-–—]\s/.test(raw)) parts=raw.split(/\s+[-–—]\s+/);
    else if(/\s{2,}/.test(raw)) parts=raw.split(/\s{2,}/);
    else return [raw];
    return parts.map(clean14);
  }

  function detectTarget14(parts, fallback) {
    const first=norm14(parts[0]).replace(/\s/g,'_');
    return ALIASES14[first] || ALIASES14[norm14(parts[0])] || fallback;
  }

  function mapLine14(line, fallbackTarget) {
    const parts=split14(line);
    if(!parts.length || !parts.some(Boolean)) return null;
    const target=detectTarget14(parts,fallbackTarget);
    const schema=SCHEMAS14[target];
    if(!schema) return null;

    const firstTarget=ALIASES14[norm14(parts[0]).replace(/\s/g,'_')] || ALIASES14[norm14(parts[0])];
    const values=firstTarget ? parts : [TARGETS14[target], ...parts];
    const record={target};
    schema.forEach((key,i)=>record[key]=clean14(values[i] ?? ''));
    return record;
  }

  function findCalendar14(name='') {
    const n=norm14(name);
    return (data.calendars||[]).find(c=>norm14(c.name)===n)?.id || data.calendars?.[0]?.id || 'persoonlijk';
  }

  function makeItem14(r) {
    if(r.target==='planning') return {
      id:id(), title:r.title||'Afspraak',
      date:iso14(r.startDate), time:r.startTime||'',
      endDate:iso14(r.endDate||r.startDate), endTime:r.endTime||'',
      allDay:bool14(r.allDay,false), location:r.location||'',
      note:r.description||'', repeat:repeat14(r.repeat),
      person:'Samen', calendarId:findCalendar14('')
    };

    if(r.target==='meals') return {
      id:id(), title:r.title||'Maaltijd', date:iso14(r.date),
      type:r.mealType||'Avondeten', persons:r.persons||'',
      ingredients:r.ingredients||'', note:r.note||''
    };

    if(r.target==='groceries') return {
      id:id(), title:r.title||'Product',
      amount:number14(r.amount, r.amount?0:1), unit:r.unit||'',
      category:r.category||'Overig', store:r.store||'',
      forMeal:r.forMeal||'', done:bool14(r.done,false), note:r.note||''
    };

    if(r.target==='chores') return {
      id:id(), title:r.title||'Taak', category:r.category||'',
      repeat:repeat14(r.repeat), person:r.person||'Samen',
      due:iso14(r.startDate||r.nextDate), nextDate:iso14(r.nextDate),
      priority:priority14(r.priority), done:bool14(r.done,false),
      notes:r.notes||'', secondWeekday:'', completedDates:[]
    };

    if(r.target==='stock') return {
      id:id(), title:r.title||'Product', category:r.category||'Overig',
      amount:number14(r.amount,0), unit:r.unit||'stuks',
      min:number14(r.minimum,0),
      desired:Math.max(number14(r.minimum,0),number14(r.amount,0)),
      bestBefore:iso14(r.bestBefore), location:r.location||'', note:r.note||''
    };

    if(r.target==='ideas') return {
      id:id(), title:r.title||'Idee', category:r.category||'Thuis',
      note:[r.description,r.note].filter(Boolean).join('\n'),
      person:r.person||'', priority:priority14(r.priority),
      status:r.status||'', date:iso14(r.date), icon:'♡'
    };

    if(r.target==='home') return {
      id:id(), title:r.title||'Woningitem', category:r.category||'Onderhoud',
      note:[r.description,r.note].filter(Boolean).join('\n'),
      kind:r.kind||'', priority:priority14(r.priority),
      startDate:iso14(r.startDate), due:iso14(r.deadline||r.startDate),
      status:r.status||'', cost:number14(r.cost,0),
      done:bool14(r.done,false), repeat:''
    };

    if(r.target==='trips') return makeTrip14(r);
    return null;
  }

  function getOrCreateTripFolder14(name='') {
    data.tripFolders ||= [];
    const wanted=(name||'Nieuwe reis').trim();
    let folder=data.tripFolders.find(f=>norm14(f.name)===norm14(wanted));
    if(!folder) {
      folder={id:id(),name:wanted,startDate:'',endDate:'',note:'Aangemaakt via universele import'};
      data.tripFolders.push(folder);
    }
    return folder;
  }

  function getOrCreateTripSection14(folderId,name='') {
    data.tripSections ||= [];
    const wanted=(name||'Algemeen').trim();
    let section=data.tripSections.find(s=>s.tripFolderId===folderId && norm14(s.name)===norm14(wanted));
    if(!section) {
      section={id:id(),tripFolderId:folderId,name:wanted};
      data.tripSections.push(section);
    }
    return section;
  }

  function makeTrip14(r) {
    const folder=getOrCreateTripFolder14(r.trip);
    const section=getOrCreateTripSection14(folder.id,r.section);
    const start=iso14(r.startDate||r.deadline);
    const end=iso14(r.endDate||start);

    if(start && !folder.startDate) folder.startDate=start;
    if(end && !folder.endDate) folder.endDate=end;

    const extras=[];
    if(r.location) extras.push(`Locatie: ${r.location}`);
    if(r.cost) extras.push(`Kosten: ${r.cost}`);
    if(r.priority) extras.push(`Prioriteit: ${priority14(r.priority)}`);
    if(r.note) extras.push(r.note);

    return {
      id:id(), tripFolderId:folder.id, tripSectionId:section.id,
      title:r.title||'Reisitem', date:start, startDate:start, endDate:end,
      type:r.kind||'Notitie',
      note:[r.description,...extras].filter(Boolean).join('\n'),
      checkable:bool14(r.checkable,false),
      important:priority14(r.priority)==='hoog',
      done:bool14(r.done,false)
    };
  }

  function analyse14() {
    const lines=String(state14.text||'').replace(/\r/g,'').split(/\n+/)
      .map(x=>x.trim()).filter(Boolean)
      .filter(x=>!/^#/.test(x));

    const records=lines.map(line=>mapLine14(line,state14.target)).filter(Boolean);
    state14.preview=records
      .map(record=>({record,item:makeItem14(record),selected:true}))
      .filter(x=>x.item);

    render();
    toast(`${state14.preview.length} items gevonden`);
  }

  function previewText14(entry) {
    const r=entry.record;
    if(r.target==='planning') return `${r.startDate||'geen datum'} ${r.startTime||''}`.trim();
    if(r.target==='meals') return `${r.date||'geen datum'} · ${r.mealType||'Avondeten'}`;
    if(r.target==='groceries') return `${r.amount||''} ${r.unit||''} · ${r.category||'Overig'}`.trim();
    if(r.target==='chores') return `${repeat14(r.repeat)||'geen frequentie'} · ${r.person||'Samen'}`;
    if(r.target==='stock') return `${r.amount||0} ${r.unit||'stuks'} · min ${r.minimum||0}`;
    if(r.target==='ideas') return `${r.category||'Thuis'}${r.priority?' · '+priority14(r.priority):''}`;
    if(r.target==='home') return `${r.category||'Onderhoud'}${r.deadline?' · '+r.deadline:''}`;
    if(r.target==='trips') return `${r.trip||'Nieuwe reis'} › ${r.section||'Algemeen'}${r.startDate?' · '+r.startDate:''}`;
    return '';
  }

  function renderImport14() {
    return `<div class="import-v13">
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow">SAMEN THUIS · UNIVERSELE IMPORT</p><h2>Toevoegen & importeren</h2></div>
          <span class="tag green">v14</span>
        </div>

        <p>Gebruik <strong>|</strong>, <strong>;</strong>, tabs, <strong> / </strong>, <strong> - </strong> of meerdere spaties. Datums met een koppelteken blijven intact.</p>

        <div class="form-grid">
          <div class="field">
            <label>Standaard pagina</label>
            <select id="v14Target">
              ${Object.entries(TARGETS14).map(([k,v])=>`<option value="${k}" ${k===state14.target?'selected':''}>${esc14(v)}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label>Bestand</label>
            <input id="v14File" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,text/plain">
          </div>

          <div class="field full">
            <label>Tekst / lijst</label>
            <textarea id="v14Text" placeholder="huishouden | Badkamer schoonmaken | Badkamer | wekelijks | Samen ...">${esc14(state14.text)}</textarea>
          </div>
        </div>

        ${state14.filename?`<p class="muted">Bron: <strong>${esc14(state14.filename)}</strong></p>`:''}

        <div class="button-row">
          <button class="primary" data-v14-analyse>Analyseren</button>
          <button class="secondary" data-v14-clear>Leegmaken</button>
          <button class="secondary" data-v14-legacy>Oude documentanalyse</button>
        </div>

        <details>
          <summary>Vaste volgorde per pagina bekijken</summary>
          <pre style="white-space:pre-wrap">Agenda: [agenda] | [titel] | [begindatum] | [begintijd] | [einddatum] | [eindtijd] | [hele dag] | [locatie] | [omschrijving] | [herhaling]
Weekmenu: [weekmenu] | [datum] | [maaltijdmoment] | [gerecht] | [personen] | [ingrediënten] | [notitie]
Boodschappen: [boodschappen] | [product] | [hoeveelheid] | [eenheid] | [categorie] | [winkel] | [voor weekmenu] | [afgevinkt] | [notitie]
Huishouden: [huishouden] | [taak] | [ruimte/categorie] | [frequentie] | [toegewezen aan] | [startdatum] | [volgende datum] | [prioriteit] | [afgevinkt] | [omschrijving/subtaken]
Voorraad: [voorraad] | [product] | [categorie] | [hoeveelheid] | [eenheid] | [minimumvoorraad] | [houdbaar-tot] | [locatie] | [notitie]
Ideeën: [idee] | [titel] | [categorie] | [omschrijving] | [voor wie] | [prioriteit] | [status] | [datum/deadline] | [link/notitie]
Woning: [woning] | [titel] | [categorie/ruimte] | [omschrijving] | [type] | [prioriteit] | [startdatum] | [deadline] | [status] | [kosten] | [afgevinkt] | [notitie]
Reizen: [reizen] | [reis] | [map/onderdeel] | [titel] | [type] | [omschrijving] | [startdatum] | [einddatum] | [deadline] | [locatie] | [kosten] | [prioriteit] | [afvinken] | [afgevinkt] | [notitie/link]</pre>
        </details>
      </section>

      ${state14.preview.length?`
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow">CONTROLE</p><h2>${state14.preview.length} gevonden items</h2></div>
          <button class="primary" data-v14-commit>Geselecteerde toevoegen</button>
        </div>

        <div class="v13-preview-list">
          ${state14.preview.map((entry,i)=>`
            <article class="v13-card" data-v14-card="${i}">
              <div class="v13-card-head">
                <label><input type="checkbox" data-v14-selected ${entry.selected?'checked':''}> Importeren</label>
              </div>
              <strong>${esc14(entry.item.title)}</strong><br>
              <small class="muted">${esc14(TARGETS14[entry.record.target])} · ${esc14(previewText14(entry))}</small>
            </article>
          `).join('')}
        </div>
      </section>`:
      '<section class="card"><p class="muted">Nog niets geanalyseerd.</p></section>'}
    </div>`;
  }

  async function loadScript14(src,test) {
    if(test()) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function readFile14(file) {
    const ext=file.name.toLowerCase().split('.').pop();

    if(['txt','md','csv'].includes(ext)) return file.text();

    if(ext==='pdf') return extractPdfText(file);

    if(ext==='docx') {
      await loadScript14(
        'https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',
        ()=>Boolean(window.mammoth)
      );
      return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
    }

    if(['xlsx','xlsm','xls'].includes(ext)) {
      await loadScript14(
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        ()=>Boolean(window.XLSX)
      );
      const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      return wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:'|'})).join('\n');
    }

    throw new Error('Bestandstype niet ondersteund');
  }

  function bind14() {
    document.querySelector('#v14Target')?.addEventListener('change',e=>{
      state14.target=e.target.value;
      state14.preview=[];
      render();
    });

    document.querySelector('#v14Text')?.addEventListener('input',e=>{
      state14.text=e.target.value;
    });

    document.querySelector('#v14File')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0];
      if(!file) return;

      try {
        state14.filename=file.name;
        toast('Bestand wordt gelezen…');
        state14.text=await readFile14(file);
        analyse14();
      } catch(err) {
        console.error(err);
        toast('Bestand lezen is mislukt');
      }
    });
  }

  function openManualImport14() {
    state14.legacy=true;
    render();
    // De v13-importer staat standaard op handmatig. Als de gebruiker eerder
    // een andere methode koos, schakelen we expliciet terug naar Handmatig.
    setTimeout(()=>document.querySelector('[data-v14-method="manual"]')?.click(),0);
  }

  function bindTopAdd14() {
    const add=document.querySelector('#addBtn');
    if(!add || add.dataset.v14Bound==='1') return;
    add.dataset.v14Bound='1';
    add.addEventListener('click',e=>{
      if(current!=='imports') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openManualImport14();
    },true);
  }

  render = function renderV141() {
    if(current==='imports' && !state14.legacy) {
      document.querySelector('#view').innerHTML=renderImport14();
      updateSyncBadge();
      bind14();
      bindTopAdd14();
      return;
    }

    baseRender14();

    if(current==='imports' && state14.legacy) {
      const view=document.querySelector('#view');
      if(view && !view.querySelector('[data-v14-new]')) {
        view.insertAdjacentHTML('afterbegin',`
          <div class="button-row" style="margin-bottom:16px">
            <button class="secondary" data-v14-new>← Terug naar nieuwe import</button>
          </div>`);
      }
      bindTopAdd14();
    }
  };

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v14-new]')) {
      state14.legacy=false;
      render();
      return;
    }

    if(e.target.closest('[data-v14-legacy]')) {
      state14.legacy=true;
      render();
      return;
    }

    if(current!=='imports' || state14.legacy) return;

    if(e.target.closest('[data-v14-analyse]')) {
      state14.text=document.querySelector('#v14Text')?.value||state14.text;
      analyse14();
      return;
    }

    if(e.target.closest('[data-v14-clear]')) {
      state14.text='';
      state14.filename='';
      state14.preview=[];
      render();
      return;
    }

    if(e.target.closest('[data-v14-commit]')) {
      document.querySelectorAll('[data-v14-card]').forEach(card=>{
        const x=state14.preview[Number(card.dataset.v14Card)];
        if(x) x.selected=Boolean(card.querySelector('[data-v14-selected]')?.checked);
      });

      const selected=state14.preview.filter(x=>x.selected);
      if(!selected.length) return toast('Selecteer minimaal één item');

      selected.forEach(({record,item})=>{
        data[record.target] ||= [];
        data[record.target].push(item);
      });

      save();

      const count=selected.length;
      state14.preview=[];
      state14.text='';
      state14.filename='';
      render();
      toast(`${count} items toegevoegd`);
      return;
    }
  },true);

  save({touch:false});
  toast('Samen Thuis v14.1 geladen');
})();
