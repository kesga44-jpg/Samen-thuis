console.info('Samen Thuis update 12.0 geladen');

(() => {
  'use strict';

  // Deze file wordt na app.js en upgrade-v11.js geladen en gebruikt bewust
  // de bestaande Samen Thuis data/functions in plaats van een tweede opslaglaag.

  const IMPORT_TARGETS = {
    planning: 'Agenda',
    meals: 'Weekmenu',
    groceries: 'Boodschappen',
    chores: 'Huishouden',
    stock: 'Voorraad',
    ideas: 'Samen doen',
    home: 'Woning',
    trips: 'Reizen'
  };

  const importState = { target: 'planning', text: '', filename: '', preview: [] };
  const oldRender = render;

  sections.imports = { label: 'Importeren', icon: '↥' };

  function importEsc(value='') { return esc(value); }

  function ensureImportDialog() {
    if (document.querySelector('#editItemDialogV12')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'editItemDialogV12';
    dialog.innerHTML = `
      <form id="editItemFormV12">
        <div class="dialog-head">
          <div><p class="eyebrow">Bewerken</p><h2 id="editItemTitleV12">Item bewerken</h2></div>
          <button type="button" class="icon-btn" data-edit-close>×</button>
        </div>
        <div id="editItemFieldsV12" class="form-grid"></div>
        <div class="dialog-actions">
          <button type="button" class="secondary" data-edit-close>Annuleren</button>
          <button type="submit" class="primary">Wijzigingen opslaan</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('[data-edit-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  }

  function renderImportsV12() {
    return `<div class="settings-grid import-center-v12">
      <section class="card settings-card">
        <div class="card-head">
          <div><p class="eyebrow">Één centrale ingang</p><h2>Bestand of lijst importeren</h2></div>
          <span class="tag green">Eerst controleren</span>
        </div>
        <p>Kies waar de informatie hoort. Daarna leest de app het bestand of de geplakte tekst en toont eerst een controlelijst. Pas na bevestigen worden de items toegevoegd.</p>
        <div class="form-grid">
          <div class="field">
            <label for="centralImportTarget">Waar hoort dit bij?</label>
            <select id="centralImportTarget">
              ${Object.entries(IMPORT_TARGETS).map(([key,label]) => `<option value="${key}" ${key===importState.target?'selected':''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="centralImportFile">Bestand</label>
            <input id="centralImportFile" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv">
          </div>
          <div class="field" style="grid-column:1/-1">
            <label for="centralImportText">Of tekst/lijst plakken</label>
            <textarea id="centralImportText" placeholder="Plak hier de inhoud…">${importEsc(importState.text)}</textarea>
          </div>
        </div>
        ${importState.filename ? `<p class="muted">Gelezen bestand: <strong>${importEsc(importState.filename)}</strong></p>` : ''}
        <div class="button-row">
          <button class="primary" type="button" data-central-analyse>Analyseren</button>
          <button class="secondary" type="button" data-central-clear>Leegmaken</button>
        </div>
      </section>

      <section class="card settings-card">
        <div class="card-head">
          <div><p class="eyebrow">Controle</p><h2>${importState.preview.length} gevonden items</h2></div>
          ${importState.preview.length ? '<button class="primary" type="button" data-central-commit>Geselecteerde toevoegen</button>' : ''}
        </div>
        <div class="list">
          ${importState.preview.length ? importState.preview.map((entry,index) => `
            <div class="list-item">
              <input type="checkbox" data-preview-check="${index}" ${entry.selected?'checked':''}>
              <div class="item-main">
                <strong>${importEsc(previewTitle(entry.item))}</strong>
                <small>${importEsc(previewSubtitle(entry.item))}</small>
              </div>
              <button class="secondary" type="button" data-preview-edit="${index}">✎</button>
            </div>`).join('') : empty('Nog niets geanalyseerd')}
        </div>
      </section>
    </div>`;
  }

  render = function() {
    if (current === 'imports') {
      document.querySelector('#view').innerHTML = renderImportsV12();
      updateSyncBadge();
      bindImportPageV12();
      return;
    }
    oldRender();
    requestAnimationFrame(addEditButtonsV12);
  };

  function previewTitle(item) {
    return item.title || item.name || item.task || item.text || 'Item';
  }

  function previewSubtitle(item) {
    const bits = [item.date || item.due || '', item.type || item.category || item.repeat || '', item.person || ''].filter(Boolean);
    return bits.join(' · ') || IMPORT_TARGETS[importState.target];
  }

  function bindImportPageV12() {
    const target = document.querySelector('#centralImportTarget');
    if (target) target.onchange = () => {
      importState.target = target.value;
      importState.preview = importState.text ? parseCentralTextV12(importState.text, importState.target) : [];
      render();
    };
    const text = document.querySelector('#centralImportText');
    if (text) text.oninput = () => { importState.text = text.value; };
    const file = document.querySelector('#centralImportFile');
    if (file) file.onchange = async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      try {
        toast('Bestand wordt gelezen…');
        importState.filename = selected.name;
        importState.text = await readCentralFileV12(selected);
        importState.preview = parseCentralTextV12(importState.text, importState.target);
        render();
        toast(`${importState.preview.length} items gevonden`);
      } catch (error) {
        console.error(error);
        toast('Bestand lezen is mislukt');
      }
    };
  }

  async function loadExternalV12(src, test) {
    if (test()) return;
    await new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function readCentralFileV12(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (['txt','md','csv'].includes(ext)) return file.text();

    if (ext === 'docx') {
      await loadExternalV12('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js', () => Boolean(window.mammoth));
      return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || '';
    }

    if (['xlsx','xlsm','xls'].includes(ext)) {
      await loadExternalV12('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => Boolean(window.XLSX));
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
      return workbook.SheetNames.map(name => `# Werkblad: ${name}\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
    }

    if (ext === 'pdf') {
      // Gebruik de PDF-functie die de app al voor Reizen heeft.
      return await extractPdfText(file);
    }
    throw new Error('Niet ondersteund bestandstype');
  }

  function linesV12(text) {
    return String(text || '').replace(/\r/g,'').split(/\n+/).map(x => x.trim()).filter(Boolean)
      .filter(x => !/^#\s*(pagina|werkblad)\b/i.test(x));
  }

  function dateInLineV12(line) {
    const iso = line.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
    const eu = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (eu) return `${eu[3]}-${pad(eu[2])}-${pad(eu[1])}`;
    return '';
  }

  function stripDateV12(line) {
    return line.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}\b/,'')
      .replace(/^[\s|;,:–—-]+/,'').trim();
  }

  function parseCentralTextV12(text, target) {
    const lines = linesV12(text);
    const wrap = item => ({ selected:true, item });

    if (target === 'planning') {
      return lines.filter(line => dateInLineV12(line)).slice(0,200).map(line => wrap({
        id:id(), title:stripDateV12(line) || 'Afspraak', date:dateInLineV12(line), time:'', endTime:'',
        person:'Samen', personSource:'manual', calendarId:data.calendars[0]?.id || 'persoonlijk'
      }));
    }

    if (target === 'meals') {
      const dayMap = new Map(WEEKDAY_NAMES.map((name,index)=>[name.toLowerCase(), index]));
      const start = startOfWeek(todayISO());
      return lines.slice(0,100).map((line,index) => {
        const match = line.match(/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s*[:|;-]\s*(.+)$/i);
        return wrap({
          id:id(),
          date: match ? addDays(start, dayMap.get(match[1].toLowerCase())) : addDays(start, index % 7),
          type:'Avondeten',
          title: match ? match[2].trim() : line.replace(/^[-•]\s*/,'')
        });
      });
    }

    if (target === 'groceries') {
      return parseGroceryText(text).slice(0,300).map(item => wrap({ id:id(), ...item }));
    }

    if (target === 'chores') {
      return lines.slice(0,250).map(line => {
        const parts = line.split(/\s+[–—-]\s+|[;|]/).map(x=>x.trim());
        return wrap({
          id:id(), title:parts[0], person:'Samen', due:todayISO(),
          repeat:parts[1] || 'Wekelijks', secondWeekday:'', notes:'', completedDates:[]
        });
      });
    }

    if (target === 'stock') {
      return lines.slice(0,300).map(line => {
        const match = line.match(/^(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ]+)?)?$/);
        return wrap({
          id:id(), title:(match?.[1] || line).trim(), category:'Overig',
          amount:match?.[2] ? Number(match[2].replace(',','.')) : 1,
          min:1, unit:match?.[3] || 'stuks'
        });
      });
    }

    if (target === 'ideas') {
      return lines.slice(0,200).map(line => wrap({
        id:id(), title:line.replace(/^[-•]\s*/,''), category:'Thuis', note:'', icon:'♡'
      }));
    }

    if (target === 'home') {
      return lines.slice(0,200).map(line => wrap({
        id:id(), title:line.replace(/^[-•]\s*/,''), category:'Onderhoud', due:'', note:''
      }));
    }

    if (target === 'trips') {
      const folder = data.tripFolders[0];
      if (!folder) return [];
      const section = data.tripSections.find(s => s.tripFolderId === folder.id);
      return lines.slice(0,300).map(line => wrap({
        id:id(), tripFolderId:folder.id, tripSectionId:section?.id || '',
        title:line.replace(/^[-•]\s*/,''), date:dateInLineV12(line), type:'Notitie',
        note:'', checkable:false, done:false
      }));
    }
    return [];
  }

  function editPreviewV12(index) {
    const entry = importState.preview[index];
    if (!entry) return;
    openGenericEditorV12(importState.target, entry.item, false, () => render());
  }

  function commitPreviewV12() {
    const selected = importState.preview.filter(x => x.selected).map(x => x.item);
    if (!selected.length) return toast('Selecteer minimaal één item');
    data[importState.target].push(...selected);
    save();
    importState.preview = [];
    importState.text = '';
    importState.filename = '';
    render();
    toast(`${selected.length} items toegevoegd aan ${IMPORT_TARGETS[importState.target]}`);
  }

  function editableSpecV12(type, item) {
    const base = {
      planning: [['title','Titel','text'],['date','Datum','date'],['time','Tijd','time'],['endTime','Eindtijd','time'],['person','Voor wie','select',['Samen','Kees','Daphne']]],
      meals: [['title','Gerecht','text'],['date','Datum','date'],['type','Moment','select',['Ontbijt','Lunch','Avondeten','Snack']]],
      groceries: [['title','Product','text'],['category','Categorie','select',GROCERY_CATEGORIES],['done','Gekocht','checkbox']],
      chores: [['title','Taak','text'],['person','Voor wie','select',['Samen','Kees','Daphne']],['due','Eerste keer','date'],['repeat','Herhaling','select',['Eenmalig','Dagelijks','Wekelijks','2× per week','Elke 2 weken','Maandelijks']],['notes','Notitie','textarea']],
      stock: [['title','Product','text'],['category','Plek','text'],['amount','Aantal','number'],['min','Minimum','number'],['unit','Eenheid','text']],
      ideas: [['title','Idee','text'],['category','Categorie','text'],['note','Notitie','textarea'],['icon','Emoji','text']],
      home: [['title','Onderwerp','text'],['category','Categorie','text'],['due','Datum','date'],['note','Notitie','textarea']],
      trips: [['title','Onderwerp','text'],['date','Datum/deadline','date'],['type','Soort','text'],['note','Notitie','textarea'],['checkable','Afvinkbaar','checkbox'],['done','Afgerond','checkbox']]
    };
    return base[type] || [];
  }

  function openGenericEditorV12(type, item, persist=true, afterSave=null) {
    ensureImportDialog();
    const dialog = document.querySelector('#editItemDialogV12');
    const fields = editableSpecV12(type, item);
    document.querySelector('#editItemTitleV12').textContent = `${IMPORT_TARGETS[type] || 'Item'} bewerken`;
    document.querySelector('#editItemFieldsV12').innerHTML = fields.map(([key,label,kind,options]) => {
      const value = item[key] ?? '';
      if (kind === 'checkbox') return `<label class="checkbox-field"><input type="checkbox" data-edit-field="${key}" ${value?'checked':''}><span>${label}</span></label>`;
      if (kind === 'textarea') return `<div class="field"><label>${label}</label><textarea data-edit-field="${key}">${importEsc(value)}</textarea></div>`;
      if (kind === 'select') return `<div class="field"><label>${label}</label><select data-edit-field="${key}">${options.map(opt=>`<option value="${importEsc(opt)}" ${String(opt)===String(value)?'selected':''}>${importEsc(opt)}</option>`).join('')}</select></div>`;
      return `<div class="field"><label>${label}</label><input type="${kind}" data-edit-field="${key}" value="${importEsc(value)}"></div>`;
    }).join('');

    const form = document.querySelector('#editItemFormV12');
    form.onsubmit = event => {
      event.preventDefault();
      fields.forEach(([key,,kind]) => {
        const input = dialog.querySelector(`[data-edit-field="${key}"]`);
        if (!input) return;
        if (kind === 'checkbox') item[key] = input.checked;
        else if (kind === 'number') item[key] = Number(input.value) || 0;
        else item[key] = input.value;
      });
      if (persist) save();
      dialog.close();
      if (persist) render();
      afterSave?.();
      if (persist) toast('Wijzigingen opgeslagen');
    };
    dialog.showModal();
  }

  function addEditButtonsV12() {
    if (current === 'today' || current === 'settings' || current === 'imports') return;
    document.querySelectorAll('[data-delete]').forEach(deleteButton => {
      if (deleteButton.parentElement?.querySelector('[data-edit-existing]')) return;
      const raw = deleteButton.dataset.delete || '';
      const [type,itemId] = raw.split(':');
      if (!IMPORT_TARGETS[type] || !itemId) return;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'delete edit-pencil-v12';
      edit.dataset.editExisting = `${type}:${itemId}`;
      edit.setAttribute('aria-label','Bewerken');
      edit.textContent = '✎';
      deleteButton.before(edit);
    });
  }

  document.addEventListener('click', event => {
    const analyse = event.target.closest('[data-central-analyse]');
    if (analyse) {
      importState.text = document.querySelector('#centralImportText')?.value || '';
      importState.preview = parseCentralTextV12(importState.text, importState.target);
      render();
      toast(`${importState.preview.length} items gevonden`);
      return;
    }

    if (event.target.closest('[data-central-clear]')) {
      importState.text=''; importState.filename=''; importState.preview=[];
      render(); return;
    }

    if (event.target.closest('[data-central-commit]')) {
      commitPreviewV12(); return;
    }

    const previewEdit = event.target.closest('[data-preview-edit]');
    if (previewEdit) {
      editPreviewV12(Number(previewEdit.dataset.previewEdit)); return;
    }

    const existingEdit = event.target.closest('[data-edit-existing]');
    if (existingEdit) {
      const [type,itemId] = existingEdit.dataset.editExisting.split(':');
      const item = data[type]?.find(x => x.id === itemId);
      if (item) openGenericEditorV12(type,item,true);
      return;
    }
  });

  document.addEventListener('change', event => {
    const check = event.target.closest('[data-preview-check]');
    if (check) {
      const entry = importState.preview[Number(check.dataset.previewCheck)];
      if (entry) entry.selected = check.checked;
    }
  });

  ensureImportDialog();
  setupNav();
  render();
})();
