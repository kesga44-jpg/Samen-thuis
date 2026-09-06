/* Samen Thuis v11 – travel editing, import preview, priorities and automatic two-way sync */
(() => {
  if (window.__SAMEN_THUIS_V11_LOADED__) return;
  window.__SAMEN_THUIS_V11_LOADED__ = true;

  const AUTO_SYNC_INTERVAL_MS = 30000;
  const PRIORITIES = ['low', 'medium', 'high'];
  const PRIORITY_LABELS = { low: 'Laag', medium: 'Gemiddeld', high: 'Hoog' };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2, '': 3 };
  const TRAVEL_TYPES = ['Voorbereiding', 'Reservering', 'Vervoer', 'Verblijf', 'Activiteit', 'Eten', 'Budget', 'Documenten', 'Paklijst', 'Notitie'];

  let autoSyncInterval = null;
  let travelDraft = [];
  let travelDraftFolderId = '';

  const baseFormConfig = formConfig;
  const baseOpenAdd = openAdd;
  const baseRenderTrips = renderTrips;
  const baseRenderSettings = renderSettings;
  const baseUpdateSyncBadge = updateSyncBadge;

  const nowIso = () => new Date().toISOString();

  function isImportant(value) {
    return value === true || value === 'true' || value === 'on' || value === 1;
  }

  function normalisePriority(item) {
    item.important = isImportant(item.important);
    item.priority = item.important && PRIORITIES.includes(item.priority) ? item.priority : (item.important ? 'medium' : '');
    if (!item.updatedAt) item.updatedAt = data.meta?.updatedAt || nowIso();
    return item;
  }

  function normaliseTravelData({ persist = false } = {}) {
    (data.tripFolders || []).forEach(folder => {
      folder.createdAt ||= data.meta?.updatedAt || nowIso();
      folder.updatedAt ||= folder.createdAt;
    });
    (data.tripSections || []).forEach(section => {
      section.createdAt ||= data.meta?.updatedAt || nowIso();
      section.updatedAt ||= section.createdAt;
    });
    (data.trips || []).forEach(normalisePriority);
    if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function syncTimeLabel(value) {
    if (!value) return 'Nog niet gesynchroniseerd';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Nog niet gesynchroniseerd';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return `${sameDay ? 'Vandaag' : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function priorityBadge(item) {
    if (!item.important) return '';
    const priority = PRIORITIES.includes(item.priority) ? item.priority : 'medium';
    return `<span class="priority-badge ${priority}">${PRIORITY_LABELS[priority]}</span>`;
  }

  function markUpdated(item) {
    item.updatedAt = nowIso();
  }

  formConfig = function formConfigV11(view) {
    const config = baseFormConfig(view);
    if (view !== 'trips' || !config) return config;
    config.fields = config.fields.map(field => [...field]);
    if (!config.fields.some(([name]) => name === 'important')) {
      config.fields.push(['important', 'Belangrijk / prioriteit', 'checkbox']);
      config.fields.push(['priority', 'Prioriteit', 'select', [['low', 'Laag'], ['medium', 'Gemiddeld'], ['high', 'Hoog']], 'trip-priority-field']);
    }
    return config;
  };

  function updateAddPriorityVisibility() {
    const important = document.querySelector('#f-important');
    const priority = document.querySelector('#f-priority');
    const field = priority?.closest('.trip-priority-field');
    if (!important || !priority || !field) return;
    if (!priority.dataset.initialised) {
      priority.value = 'medium';
      priority.dataset.initialised = '1';
    }
    field.hidden = !important.checked;
    priority.disabled = !important.checked;
  }

  openAdd = function openAddV11(...args) {
    baseOpenAdd(...args);
    if (current === 'trips') setTimeout(updateAddPriorityVisibility, 0);
  };

  openTravelActions = function openTravelActionsV11() {
    normaliseTravelData();
    return data.trips.filter(item => item.checkable && !item.done).sort((a, b) => {
      const importantOrder = Number(Boolean(b.important)) - Number(Boolean(a.important));
      if (importantOrder) return importantOrder;
      const priorityOrder = PRIORITY_RANK[a.priority || ''] - PRIORITY_RANK[b.priority || ''];
      if (priorityOrder) return priorityOrder;
      const dateOrder = (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
      return dateOrder || a.title.localeCompare(b.title, 'nl');
    });
  };

  renderTravelActions = function renderTravelActionsV11() {
    const actions = openTravelActions().slice(0, 10);
    return `<section class="card travel-actions"><div class="card-head"><div><p class="eyebrow">Belangrijkste reisacties</p><h2>Prioriteiten & deadlines</h2></div><button class="text-btn" data-view="trips">Alle reizen</button></div><div class="list">${actions.length ? actions.map(item => {
      const folder = tripFolderById(item.tripFolderId);
      const section = tripSectionById(item.tripSectionId);
      const overdue = item.date && item.date < todayISO();
      const timing = item.date ? `${overdue ? 'Te laat · ' : ''}${fmtDate(item.date)}` : 'Geen deadline';
      return `<div class="list-item travel-action ${overdue ? 'overdue' : ''}"><button class="check" data-toggle="trips:${item.id}" aria-label="${esc(item.title)} afronden"></button><div class="item-main"><div class="travel-title-row"><strong>${esc(item.title)}</strong>${priorityBadge(item)}</div><small>${esc(folder?.name || 'Reis')}${section ? ` · ${esc(section.name)}` : ''} · ${esc(timing)}</small></div></div>`;
    }).join('') : '<p class="muted">Geen open reisacties.</p>'}</div>${openTravelActions().length > 10 ? `<p class="muted travel-more">Nog ${openTravelActions().length - 10} acties staan bij Reizen.</p>` : ''}</section>`;
  };

  tripItemRow = function tripItemRowV11(item) {
    normalisePriority(item);
    const hasDate = Boolean(item.date);
    return `<div class="list-item ${item.done ? 'is-done' : ''}">${item.checkable ? `<button class="check ${item.done ? 'done' : ''}" data-toggle="trips:${item.id}" aria-label="${item.done ? 'Opnieuw openen' : 'Afronden'}">${item.done ? '✓' : ''}</button>` : ''}<div class="trip-date">${hasDate ? `<strong>${parseDate(item.date).getDate()}</strong><small>${fmtDate(item.date, { month: 'short' })}</small>` : '<strong>–</strong><small>datum</small>'}</div><div class="item-main"><div class="travel-title-row"><strong class="${item.done ? 'done-text' : ''}">${esc(item.title)}</strong>${priorityBadge(item)}</div><small>${esc(item.type)}${item.checkable ? ' · Afvinken' : ''}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><div class="travel-row-actions"><button class="text-btn" data-edit-trip-item="${item.id}" aria-label="${esc(item.title)} bewerken">✎</button><button class="delete" data-delete="trips:${item.id}" aria-label="${esc(item.title)} verwijderen">×</button></div></div>`;
  };

  renderTrips = function renderTripsV11() {
    let html = baseRenderTrips();
    html = html.replace(/(<button class="delete" data-delete-trip-folder="([^"]+)"[^>]*>×<\/button>)/g, '<div class="travel-edit-actions"><button class="text-btn" data-edit-trip-folder="$2" aria-label="Reismap bewerken">✎</button>$1</div>');
    html = html.replace(/(<button class="delete" data-delete-trip-section="([^"]+)"[^>]*>×<\/button>)/g, '<div class="travel-edit-actions"><button class="text-btn" data-edit-trip-section="$2" aria-label="Map bewerken">✎</button>$1</div>');
    return html;
  };

  renderSettings = function renderSettingsV11() {
    let html = baseRenderSettings();
    const detail = `<div class="sync-detail"><strong>Automatische synchronisatie</strong><p>Wijzigingen worden na ongeveer 1,2 seconde verzonden. Als de app open is, controleert hij daarnaast elke 30 seconden op nieuwere gegevens van je andere apparaten.</p><p><strong>Laatst gesynchroniseerd:</strong> ${esc(syncTimeLabel(syncConfig.lastSyncedAt))}</p><p class="muted small">De knop “Nu synchroniseren” blijft alleen als noodknop; normaal hoef je die niet te gebruiken.</p></div>`;
    html = html.replace('</form>\n    </section>', `</form>${detail}\n    </section>`);
    return html;
  };

  updateSyncBadge = function updateSyncBadgeV11(message) {
    baseUpdateSyncBadge(message);
    const badge = document.querySelector('#syncState');
    if (!badge || message) return;
    if (syncConfigured() && navigator.onLine && !syncing && !syncError && syncConfig.lastSyncedAt) {
      const date = new Date(syncConfig.lastSyncedAt);
      badge.textContent = `✓ ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
      badge.title = `Laatst gesynchroniseerd: ${syncTimeLabel(syncConfig.lastSyncedAt)}`;
    }
  };

  function ensureTravelEditDialog() {
    if (document.querySelector('#travelEditDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'travelEditDialog';
    dialog.innerHTML = `<form id="travelEditForm" method="dialog"><div class="dialog-head"><div><p class="eyebrow">Reizen</p><h2 id="travelEditTitle">Bewerken</h2></div><button type="button" class="icon-btn" data-close-travel-edit aria-label="Sluiten">×</button></div><div id="travelEditFields" class="form-grid"></div><div class="dialog-actions"><button type="button" class="secondary" data-close-travel-edit>Annuleren</button><button type="submit" class="primary">Wijzigingen opslaan</button></div></form>`;
    document.body.appendChild(dialog);
  }

  function folderOptions(selected) {
    return data.tripFolders.map(folder => `<option value="${esc(folder.id)}" ${folder.id === selected ? 'selected' : ''}>${esc(folder.name)}</option>`).join('');
  }

  function sectionOptions(folderId, selected) {
    return data.tripSections.filter(section => section.tripFolderId === folderId).map(section => `<option value="${esc(section.id)}" ${section.id === selected ? 'selected' : ''}>${esc(section.name)}</option>`).join('');
  }

  function typeOptions(selected) {
    return TRAVEL_TYPES.map(type => `<option ${type === selected ? 'selected' : ''}>${esc(type)}</option>`).join('');
  }

  function priorityOptions(selected = 'medium') {
    return PRIORITIES.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${PRIORITY_LABELS[value]}</option>`).join('');
  }

  function openTravelItemEdit(itemId) {
    ensureTravelEditDialog();
    const item = data.trips.find(candidate => candidate.id === itemId);
    if (!item) return;
    normalisePriority(item);
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'item';
    dialog.dataset.id = item.id;
    document.querySelector('#travelEditTitle').textContent = 'Reisonderdeel bewerken';
    document.querySelector('#travelEditFields').innerHTML = `
      <div class="field"><label>Titel</label><input name="title" required value="${esc(item.title)}"></div>
      <div class="field"><label>Reis</label><select name="tripFolderId" id="editTripFolder">${folderOptions(item.tripFolderId)}</select></div>
      <div class="field"><label>Map binnen de reis</label><select name="tripSectionId" id="editTripSection">${sectionOptions(item.tripFolderId, item.tripSectionId)}</select></div>
      <div class="field"><label>Deadline / datum</label><input name="date" type="date" value="${esc(item.date || '')}"></div>
      <div class="field"><label>Soort</label><select name="type">${typeOptions(item.type)}</select></div>
      <div class="field"><label>Notitie</label><textarea name="note">${esc(item.note || '')}</textarea></div>
      <label class="checkbox-field"><input name="checkable" type="checkbox" ${item.checkable ? 'checked' : ''}><span>Dit moet afgevinkt worden</span></label>
      <label class="checkbox-field"><input name="important" id="editTripImportant" type="checkbox" ${item.important ? 'checked' : ''}><span>Belangrijk / prioriteit</span></label>
      <div class="field trip-priority-field" id="editTripPriorityField" ${item.important ? '' : 'hidden'}><label>Prioriteit</label><select name="priority" id="editTripPriority" ${item.important ? '' : 'disabled'}>${priorityOptions(item.priority || 'medium')}</select></div>`;
    dialog.showModal();
  }

  function openTravelFolderEdit(folderId) {
    ensureTravelEditDialog();
    const folder = tripFolderById(folderId);
    if (!folder) return;
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'folder';
    dialog.dataset.id = folder.id;
    document.querySelector('#travelEditTitle').textContent = 'Reismap bewerken';
    document.querySelector('#travelEditFields').innerHTML = `
      <div class="field"><label>Naam van de reis</label><input name="name" required value="${esc(folder.name)}"></div>
      <div class="field"><label>Vertrekdatum</label><input name="startDate" type="date" value="${esc(folder.startDate || '')}"></div>
      <div class="field"><label>Terugkomstdatum</label><input name="endDate" type="date" value="${esc(folder.endDate || '')}"></div>
      <div class="field"><label>Notitie</label><textarea name="note">${esc(folder.note || '')}</textarea></div>`;
    dialog.showModal();
  }

  function openTravelSectionEdit(sectionId) {
    ensureTravelEditDialog();
    const section = tripSectionById(sectionId);
    if (!section) return;
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'section';
    dialog.dataset.id = section.id;
    document.querySelector('#travelEditTitle').textContent = 'Map bewerken';
    document.querySelector('#travelEditFields').innerHTML = `<div class="field"><label>Naam van de map</label><input name="name" required value="${esc(section.name)}"></div>`;
    dialog.showModal();
  }

  function updateEditPriorityVisibility() {
    const important = document.querySelector('#editTripImportant');
    const priority = document.querySelector('#editTripPriority');
    const field = document.querySelector('#editTripPriorityField');
    if (!important || !priority || !field) return;
    field.hidden = !important.checked;
    priority.disabled = !important.checked;
  }

  function updateEditSectionOptions() {
    const folder = document.querySelector('#editTripFolder');
    const section = document.querySelector('#editTripSection');
    if (!folder || !section) return;
    section.innerHTML = sectionOptions(folder.value, '');
  }

  function handleTravelEditSubmit(event) {
    event.preventDefault();
    const dialog = document.querySelector('#travelEditDialog');
    const values = Object.fromEntries(new FormData(event.target));
    const mode = dialog.dataset.mode;
    const targetId = dialog.dataset.id;

    if (mode === 'item') {
      const item = data.trips.find(candidate => candidate.id === targetId);
      if (!item) return;
      const targetSection = tripSectionById(values.tripSectionId);
      if (!targetSection || targetSection.tripFolderId !== values.tripFolderId) return toast('Kies een geldige map binnen de reis');
      const checkable = values.checkable === 'on';
      if (checkable && !values.date) return toast('Kies een deadline voor een onderdeel dat afgevinkt moet worden');
      const important = values.important === 'on';
      Object.assign(item, {
        title: String(values.title || '').trim(),
        tripFolderId: values.tripFolderId,
        tripSectionId: values.tripSectionId,
        date: values.date || '',
        type: values.type || 'Notitie',
        note: String(values.note || '').trim(),
        checkable,
        done: checkable ? Boolean(item.done) : false,
        important,
        priority: important && PRIORITIES.includes(values.priority) ? values.priority : (important ? 'medium' : '')
      });
      markUpdated(item);
    } else if (mode === 'folder') {
      const folder = tripFolderById(targetId);
      if (!folder) return;
      Object.assign(folder, { name: String(values.name || '').trim(), startDate: values.startDate || '', endDate: values.endDate || '', note: String(values.note || '').trim() });
      markUpdated(folder);
    } else if (mode === 'section') {
      const section = tripSectionById(targetId);
      if (!section) return;
      section.name = String(values.name || '').trim();
      markUpdated(section);
    }

    save();
    dialog.close();
    render();
    toast('Wijzigingen opgeslagen');
  }

  function hasDateLead(line) {
    return /^(?:dag\s+\d+\b|\d{1,2}\s+(?:januari|jan|februari|feb|maart|mrt|april|apr|mei|juni|jun|juli|jul|augustus|aug|september|sep|oktober|okt|november|nov|december|dec)\b|20\d{2}-\d{1,2}-\d{1,2}\b|\d{1,2}[-/.]\d{1,2}(?:[-/.]20\d{2})?\b)/i.test(line);
  }

  function candidateTitleAndNote(text) {
    const clean = text.trim();
    if (clean.length <= 170) return { title: clean, note: '' };
    const boundary = clean.slice(70, 175).search(/[.!?;](?:\s|$)/);
    const cut = boundary >= 0 ? 70 + boundary + 1 : 167;
    return { title: `${clean.slice(0, cut).trim()}${cut < clean.length ? '…' : ''}`, note: clean.slice(cut).trim() };
  }

  function parseTravelCandidates(text, folderId) {
    const folder = tripFolderById(folderId);
    if (!folder) return [];
    const blocks = [];
    let sectionName = 'Algemeen';
    let currentBlock = null;

    const pushBlock = () => {
      if (currentBlock?.text?.trim()) blocks.push(currentBlock);
      currentBlock = null;
    };

    String(text || '').replace(/\u00ad/g, '').split(/\r?\n/).forEach(rawLine => {
      const source = rawLine.replace(/\s+/g, ' ').trim();
      if (!source || /^pagina\s+\d+(?:\s+van\s+\d+)?$/i.test(source) || /^\d+$/.test(source)) return;
      const heading = travelImportHeading(source);
      if (heading) {
        pushBlock();
        sectionName = heading;
        return;
      }
      const bullet = /^(?:[-•▪◦‣–—]|✓|✔|☑|☐|□|\[x\]|\[\s?\])\s*/i.test(source);
      const startsNew = bullet || hasDateLead(source) || !currentBlock;
      if (startsNew) {
        pushBlock();
        currentBlock = { sectionName, text: source };
      } else if ((currentBlock.text.length + source.length) < 900) {
        currentBlock.text += ` ${source}`;
      } else {
        pushBlock();
        currentBlock = { sectionName, text: source };
      }
    });
    pushBlock();

    const seen = new Set();
    return blocks.slice(0, 180).map(block => {
      const source = block.text;
      const done = /^(?:✓|✔|☑|\[x\])\s*/i.test(source);
      const explicitAction = /^(?:☐|□|\[\s?\]|todo:|to-do:|actie:)/i.test(source);
      const clean = source.replace(/^(?:[-•▪◦‣–—]|✓|✔|☑|☐|□|\[x\]|\[\s?\])\s*/i, '').trim();
      if (clean.length < 3) return null;
      const key = clean.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const detected = travelImportCategory(clean);
      const section = detected?.name || block.sectionName || 'Algemeen';
      const type = detected?.type || travelImportCategory(section)?.type || 'Notitie';
      const checkable = done || explicitAction || /\b(boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|inpakken|meenemen|afspreken|downloaden|printen)\b/i.test(clean);
      const split = candidateTitleAndNote(clean);
      return {
        selected: true,
        title: split.title,
        note: split.note,
        section,
        type,
        date: travelDateFromLine(clean, folder),
        checkable,
        done: checkable ? done : false,
        important: false,
        priority: ''
      };
    }).filter(Boolean).filter(candidate => !data.trips.some(item => item.tripFolderId === folderId && item.title.toLowerCase() === candidate.title.toLowerCase()));
  }

  function renderTravelDraft() {
    document.querySelector('#travelImportPreview')?.remove();
    const importCard = document.querySelector('.travel-import');
    if (!importCard || !travelDraft.length) return;
    const section = document.createElement('section');
    section.id = 'travelImportPreview';
    section.className = 'card travel-import-preview';
    section.innerHTML = `<div class="card-head"><div><p class="eyebrow">Controle vóór import</p><h2>${travelDraft.length} mogelijke onderdelen gevonden</h2><p class="muted small">Pas tekst, map, type, datum, afvinken en prioriteit eerst aan. Pas na “Geselecteerde importeren” worden ze opgeslagen.</p></div><div class="button-row"><button class="secondary" data-preview-select-all>Alles selecteren</button><button class="secondary" data-preview-select-none>Niets selecteren</button></div></div><div class="travel-preview-list">${travelDraft.map((candidate, index) => `<article class="travel-preview-card" data-preview-index="${index}"><label class="preview-select"><input type="checkbox" data-preview-selected ${candidate.selected ? 'checked' : ''}> Importeren</label><div class="preview-grid"><div class="field preview-title"><label>Titel</label><input data-preview-title value="${esc(candidate.title)}"></div><div class="field"><label>Map</label><input data-preview-section value="${esc(candidate.section)}"></div><div class="field"><label>Soort</label><select data-preview-type>${typeOptions(candidate.type)}</select></div><div class="field"><label>Datum / deadline</label><input type="date" data-preview-date value="${esc(candidate.date || '')}"></div><label class="checkbox-field compact"><input type="checkbox" data-preview-checkable ${candidate.checkable ? 'checked' : ''}><span>Afvinken</span></label><label class="checkbox-field compact"><input type="checkbox" data-preview-important><span>Belangrijk</span></label><div class="field preview-priority" hidden><label>Prioriteit</label><select data-preview-priority disabled>${priorityOptions('medium')}</select></div><div class="field preview-note"><label>Notitie</label><textarea data-preview-note>${esc(candidate.note || '')}</textarea></div></div></article>`).join('')}</div><div class="button-row preview-actions"><button class="secondary" data-preview-cancel>Annuleren</button><button class="primary" data-preview-import>Geselecteerde importeren</button></div>`;
    importCard.insertAdjacentElement('afterend', section);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function beginTravelPreview(text, folderId) {
    const candidates = parseTravelCandidates(text, folderId);
    if (!candidates.length) return toast('Geen nieuwe reisonderdelen gevonden');
    travelDraft = candidates;
    travelDraftFolderId = folderId;
    renderTravelDraft();
    toast(`${candidates.length} onderdelen gevonden · controleer ze eerst`);
  }

  async function readTravelFileToPreview(file) {
    const folderId = document.querySelector('#travelImportFolder')?.value;
    if (!folderId) return toast('Kies eerst een reismap');
    try {
      toast(file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF wordt gelezen…' : 'Bestand wordt gelezen…');
      const text = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? await extractPdfText(file) : await file.text();
      if (!text.trim()) return toast('In dit bestand is geen leesbare tekst gevonden');
      const textarea = document.querySelector('#travelImportText');
      if (textarea) textarea.value = text;
      beginTravelPreview(text, folderId);
    } catch (error) {
      console.error('Reisbestand lezen mislukt', error);
      toast('PDF lezen lukte niet. Kopieer de tekst en plak die hier.');
    }
  }

  function importPreviewCandidates() {
    const cards = [...document.querySelectorAll('.travel-preview-card')];
    let added = 0;
    let skipped = 0;
    cards.forEach(card => {
      if (!card.querySelector('[data-preview-selected]')?.checked) return;
      const title = card.querySelector('[data-preview-title]')?.value.trim();
      if (!title) { skipped += 1; return; }
      const sectionName = card.querySelector('[data-preview-section]')?.value.trim() || 'Algemeen';
      const duplicate = data.trips.some(item => item.tripFolderId === travelDraftFolderId && item.title.toLowerCase() === title.toLowerCase());
      if (duplicate) { skipped += 1; return; }
      const targetSection = ensureTripSection(travelDraftFolderId, sectionName);
      const important = Boolean(card.querySelector('[data-preview-important]')?.checked);
      const priority = important ? (card.querySelector('[data-preview-priority]')?.value || 'medium') : '';
      const checkable = Boolean(card.querySelector('[data-preview-checkable]')?.checked);
      data.trips.push({
        id: id(),
        tripFolderId: travelDraftFolderId,
        tripSectionId: targetSection.id,
        title,
        date: card.querySelector('[data-preview-date]')?.value || '',
        type: card.querySelector('[data-preview-type]')?.value || 'Notitie',
        note: card.querySelector('[data-preview-note]')?.value.trim() || '',
        checkable,
        done: false,
        important,
        priority,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      added += 1;
    });
    if (!added) return toast('Selecteer minimaal één geldig onderdeel');
    save();
    travelDraft = [];
    travelDraftFolderId = '';
    render();
    toast(`${added} onderdelen geïmporteerd${skipped ? ` · ${skipped} overgeslagen` : ''}`);
  }

  function replaceTravelFileInput() {
    const oldInput = document.querySelector('#travelImportFile');
    if (!oldInput || oldInput.dataset.v11 === '1') return;
    const fresh = oldInput.cloneNode(true);
    fresh.dataset.v11 = '1';
    oldInput.replaceWith(fresh);
    fresh.addEventListener('change', event => {
      if (event.target.files[0]) readTravelFileToPreview(event.target.files[0]);
      event.target.value = '';
    });
  }

  syncNow = async function syncNowV11({ manual = false } = {}) {
    if (!syncConfigured() || syncing || !navigator.onLine) {
      if (manual && !navigator.onLine) toast('Geen internetverbinding');
      return;
    }
    syncing = true;
    syncError = '';
    updateSyncBadge();
    try {
      if (!window.crypto?.subtle) throw new Error('Versleuteling vereist HTTPS');
      const householdId = await sha256(syncConfig.householdCode.trim());
      const baseUrl = syncConfig.projectUrl.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/rest/v1/household_data?id=eq.${householdId}&select=payload,updated_at`, { headers: supabaseHeaders() });
      if (!response.ok) throw new Error(`Supabase gaf ${response.status}`);
      const rows = await response.json();
      let remoteData = null;
      if (rows[0]?.payload) remoteData = migrateData(await decryptData(rows[0].payload, syncConfig.householdCode));

      const localTime = new Date(data.meta?.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteData?.meta?.updatedAt || 0).getTime();
      let remoteLoaded = false;

      if (!remoteData) {
        const payload = await encryptData(data, syncConfig.householdCode);
        const upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
          method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: householdId, payload, updated_at: data.meta.updatedAt })
        });
        if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
      } else if (remoteTime > localTime) {
        data = remoteData;
        normaliseTravelData();
        save({ touch: false, sync: false });
        remoteLoaded = true;
      } else if (localTime > remoteTime) {
        const payload = await encryptData(data, syncConfig.householdCode);
        const upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
          method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: householdId, payload, updated_at: data.meta.updatedAt })
        });
        if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
      }

      syncConfig.lastSyncedAt = nowIso();
      localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
      syncError = '';
      if (current === 'settings' || remoteLoaded) render();
      if (manual) toast('Apparaten zijn bijgewerkt');
    } catch (error) {
      console.error('Synchronisatie mislukt', error);
      syncError = error.message || 'Synchronisatie mislukt';
      if (manual) toast('Synchronisatie lukt nog niet. Controleer de instellingen.');
    } finally {
      syncing = false;
      updateSyncBadge();
    }
  };

  function startAutomaticSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  document.addEventListener('click', event => {
    const importText = event.target.closest('[data-import-travel-text]');
    if (importText) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const folderId = document.querySelector('#travelImportFolder')?.value;
      const text = document.querySelector('#travelImportText')?.value || '';
      if (!folderId) return toast('Kies eerst een reismap');
      if (!text.trim()) return toast('Plak eerst de tekst uit het reisplan');
      beginTravelPreview(text, folderId);
      return;
    }

    const editItem = event.target.closest('[data-edit-trip-item]');
    if (editItem) { event.preventDefault(); openTravelItemEdit(editItem.dataset.editTripItem); return; }
    const editFolder = event.target.closest('[data-edit-trip-folder]');
    if (editFolder) { event.preventDefault(); openTravelFolderEdit(editFolder.dataset.editTripFolder); return; }
    const editSection = event.target.closest('[data-edit-trip-section]');
    if (editSection) { event.preventDefault(); openTravelSectionEdit(editSection.dataset.editTripSection); return; }
    if (event.target.closest('[data-close-travel-edit]')) { document.querySelector('#travelEditDialog')?.close(); return; }
    if (event.target.closest('[data-preview-select-all]')) { document.querySelectorAll('[data-preview-selected]').forEach(input => { input.checked = true; }); return; }
    if (event.target.closest('[data-preview-select-none]')) { document.querySelectorAll('[data-preview-selected]').forEach(input => { input.checked = false; }); return; }
    if (event.target.closest('[data-preview-cancel]')) { travelDraft = []; travelDraftFolderId = ''; document.querySelector('#travelImportPreview')?.remove(); return; }
    if (event.target.closest('[data-preview-import]')) { importPreviewCandidates(); return; }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches('#f-important')) updateAddPriorityVisibility();
    if (event.target.matches('#editTripImportant')) updateEditPriorityVisibility();
    if (event.target.matches('#editTripFolder')) updateEditSectionOptions();
    if (event.target.matches('[data-preview-important]')) {
      const card = event.target.closest('.travel-preview-card');
      const field = card?.querySelector('.preview-priority');
      const select = card?.querySelector('[data-preview-priority]');
      if (field && select) {
        field.hidden = !event.target.checked;
        select.disabled = !event.target.checked;
      }
    }
  });

  document.querySelector('#itemForm')?.addEventListener('submit', () => {
    if (current !== 'trips') return;
    setTimeout(() => {
      normaliseTravelData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (syncConfigured()) scheduleSync();
    }, 0);
  });

  ensureTravelEditDialog();
  document.querySelector('#travelEditForm')?.addEventListener('submit', handleTravelEditSubmit);
  replaceTravelFileInput();

  window.addEventListener('focus', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });

  normaliseTravelData({ persist: true });
  startAutomaticSync();
  render();
  updateSyncBadge();
  syncNow();
})();
