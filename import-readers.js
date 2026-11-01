/* Samen Thuis – bestandslezers voor de universele importer.
   Per bestandstype een eigen uitleesmethode; externe bibliotheken (pdf.js, mammoth, SheetJS, Tesseract) worden
   via `env` aangereikt zodat deze module zowel in de browser als in node-tests werkt.
   Elk bestand levert een resultaat met status: ok | partial | unreadable | unsupported. */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./import-core.js') : root.SamenThuisImport;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SamenThuisImportReaders = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  const MAX_PDF_PAGES = 200;
  const MAX_SHEET_ROWS = 20000;
  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'];
  const TYPES = {
    pdf: 'PDF', txt: 'TXT', md: 'TXT', text: 'TXT', log: 'TXT', csv: 'CSV', tsv: 'CSV', docx: 'Word', rtf: 'RTF',
    xlsx: 'Excel', xlsm: 'Excel', xls: 'Excel', json: 'JSON', png: 'Afbeelding', jpg: 'Afbeelding', jpeg: 'Afbeelding', webp: 'Afbeelding', bmp: 'Afbeelding', gif: 'Afbeelding'
  };
  const SUPPORTED_LIST = 'PDF, TXT, DOCX, RTF, CSV, XLSX, XLS, JSON, PNG en JPG/JPEG';

  const extOf = name => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const result = (file, over = {}) => ({ name: file.name, type: '', status: 'ok', message: '', warnings: [], notes: [], segments: [], stats: {}, ...over });
  const fail = (file, status, message, type = '') => result(file, { status, message, type });
  const pageList = nums => {
    const out = []; let i = 0;
    while (i < nums.length) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++; out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i])); i = j + 1; }
    return out.join(', ');
  };

  function sniff(bytes) {
    const b = bytes;
    const starts = (...sig) => sig.every((v, i) => b[i] === v);
    if (starts(0x25, 0x50, 0x44, 0x46)) return 'pdf';
    if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png';
    if (starts(0xff, 0xd8, 0xff)) return 'jpg';
    if (starts(0x7b, 0x5c, 0x72, 0x74, 0x66)) return 'rtf';
    if (starts(0xd0, 0xcf, 0x11, 0xe0)) return 'ole';
    if (starts(0x50, 0x4b, 0x03, 0x04)) return 'zip';
    return '';
  }

  /* ---------- HTML (mammoth-uitvoer) -> tekst en tabellen ---------- */
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decodeEntities = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return entities[e.toLowerCase()] ?? m;
  });
  function parseHtml(html) {
    const root = { tag: 'root', children: [] }, stack = [root];
    const rx = /<(\/?)([a-z0-9]+)([^>]*?)(\/?)>|([^<]+)/gi;
    const voids = new Set(['br', 'img', 'hr']);
    let m;
    while ((m = rx.exec(html))) {
      const top = stack[stack.length - 1];
      if (m[5] !== undefined) { top.children.push({ text: decodeEntities(m[5]) }); continue; }
      const tag = m[2].toLowerCase();
      if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
      const node = { tag, children: [] };
      top.children.push(node);
      if (!voids.has(tag) && !m[4]) stack.push(node);
    }
    return root;
  }
  const textOf = n => n.text !== undefined ? n.text : n.tag === 'br' ? ' ' : n.children.map(textOf).join('');
  const oneLine = s => s.replace(/\s+/g, ' ').trim();

  function htmlToSegments(html, file, location) {
    const tree = parseHtml(html), segs = [];
    let lines = [], tableNo = 0;
    const flush = () => { if (lines.length) { segs.push({ kind: 'text', file, location, text: lines.join('\n') }); lines = []; } };
    const walkList = (node, depth, ordered) => {
      let n = 0;
      node.children.forEach(li => {
        if (li.tag !== 'li') return;
        n++;
        const own = li.children.filter(c => c.tag !== 'ul' && c.tag !== 'ol');
        const t = oneLine(own.map(textOf).join(''));
        if (t) lines.push(`${'  '.repeat(depth)}${ordered ? n + '.' : '-'} ${t}`);
        li.children.filter(c => c.tag === 'ul' || c.tag === 'ol').forEach(c => walkList(c, depth + 1, c.tag === 'ol'));
      });
    };
    const walk = node => node.children.forEach(n => {
      if (n.text !== undefined) { const t = oneLine(n.text); if (t) lines.push(t); return; }
      if (/^h[1-6]$/.test(n.tag)) { const t = oneLine(textOf(n)); if (t) lines.push(`# ${t}`); }
      else if (n.tag === 'p') { const t = oneLine(textOf(n)); if (t) lines.push(t); }
      else if (n.tag === 'ul' || n.tag === 'ol') walkList(n, 0, n.tag === 'ol');
      else if (n.tag === 'table') {
        flush(); tableNo++;
        const rows = [];
        const collect = x => x.children.forEach(c => { if (c.tag === 'tr') rows.push(c.children.filter(k => k.tag === 'td' || k.tag === 'th').map(k => oneLine(textOf(k)))); else if (c.children) collect(c); });
        collect(n);
        if (rows.some(r => r.some(Boolean))) segs.push({ kind: 'table', file, location: `${location}, tabel ${tableNo}`, rows });
      } else if (n.children) walk(n);
    });
    walk(tree);
    flush();
    return segs;
  }

  /* ---------- PDF ---------- */
  function pageItemsToLines(items) {
    const toks = items.filter(it => it && typeof it.str === 'string' && it.str.trim() !== '').map(it => {
      const t = it.transform || [1, 0, 0, 1, 0, 0];
      return { s: it.str, x: t[4], y: t[5], h: Math.abs(it.height || t[3]) || 10, w: it.width || it.str.length * 5 };
    });
    toks.sort((a, b) => (Math.abs(b.y - a.y) > Math.min(a.h, b.h) * 0.5 ? b.y - a.y : a.x - b.x));
    const lines = [];
    toks.forEach(tk => {
      const cur = lines[lines.length - 1];
      if (cur && Math.abs(cur.y - tk.y) <= Math.max(2, cur.h * 0.5)) cur.toks.push(tk);
      else lines.push({ y: tk.y, h: tk.h, toks: [tk] });
    });
    const out = lines.map(l => {
      l.toks.sort((a, b) => a.x - b.x);
      let text = '', prevEnd = null;
      l.toks.forEach(tk => {
        if (prevEnd !== null) {
          const gap = tk.x - prevEnd;
          if (gap > Math.max(l.h * 2.2, 14)) text += '\t';
          else if (gap > l.h * 0.12 && !/\s$/.test(text) && !/^\s/.test(tk.s)) text += ' ';
        }
        text += tk.s;
        prevEnd = tk.x + tk.w;
      });
      text = text.replace(/^([•▪◦●‣·–-]|\d{1,2}[.)])\t+/, '$1 ').replace(/[ ]+\t/g, '\t');
      return { text: text.trimEnd(), y: l.y, h: l.h };
    });
    return out;
  }
  function linesToSegments(lines, file, location) {
    const segs = []; let textBuf = [], tableBuf = [], prevY = null;
    const flushText = () => { if (textBuf.length) { segs.push({ kind: 'text', file, location, text: textBuf.join('\n') }); textBuf = []; } };
    const flushTable = () => {
      if (tableBuf.length >= 2) { flushText(); segs.push({ kind: 'table', file, location, rows: tableBuf.map(t => t.split(/\t+/).map(c => c.trim())) }); }
      else tableBuf.forEach(t => textBuf.push(t.replace(/\t+/g, '  ')));
      tableBuf = [];
    };
    lines.forEach(l => {
      if (prevY !== null && prevY - l.y > l.h * 2.2) { flushTable(); textBuf.push(''); }
      prevY = l.y;
      if (l.text.includes('\t')) tableBuf.push(l.text); else { flushTable(); textBuf.push(l.text); }
    });
    flushTable(); flushText();
    return segs;
  }

  const LIB_HELP = 'Controleer je internetverbinding en probeer het opnieuw. CSV, TXT, JSON, RTF en zelf getypte tekst werken ook zonder internet.';
  const libFail = (file, err, type, what) => (err && err.libraryLoad)
    ? fail(file, 'unreadable', `De leesmodule voor ${what} kon niet worden geladen. ${LIB_HELP}`, type) : null;

  async function readPdf(file, bytes, env) {
    const out = result(file, { type: 'PDF' });
    let pdfjs, doc;
    try {
      pdfjs = await env.loadPdfjs();
      doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    } catch (err) {
      const lf = libFail(file, err, 'PDF', 'PDF-bestanden'); if (lf) return lf;
      const msg = /password/i.test(String(err && (err.name + err.message))) ? 'Deze PDF is beveiligd met een wachtwoord en kan niet worden gelezen.' : 'Deze PDF kon niet worden geopend (beschadigd of geen geldige PDF).';
      return fail(file, 'unreadable', msg, 'PDF');
    }
    const total = doc.numPages, limit = Math.min(total, MAX_PDF_PAGES);
    const empty = [], ocrDone = [], ocrFailed = [];
    let ocrOffline = false;
    for (let n = 1; n <= limit; n++) {
      let lines = [], ocrText = '';
      let page;
      try {
        page = await doc.getPage(n);
        const content = await page.getTextContent();
        lines = pageItemsToLines(content.items);
      } catch (err) { empty.push(n); out.warnings.push(`Pagina ${n} kon niet worden gelezen.`); continue; }
      const chars = lines.reduce((a, l) => a + l.text.replace(/\s/g, '').length, 0);
      if (chars < 12 && env.ocrPdfPage) {
        try {
          const r = await env.ocrPdfPage(page, pdfjs);
          ocrText = (r && r.text || '').trim();
          if (ocrText.replace(/\s/g, '').length >= 8) ocrDone.push(n); else ocrFailed.push(n);
        } catch (err) { ocrFailed.push(n); if (err && err.libraryLoad) ocrOffline = true; }
      }
      if (ocrText.replace(/\s/g, '').length >= 8) out.segments.push({ kind: 'text', file: file.name, location: `pagina ${n} (OCR)`, text: ocrText });
      else if (chars >= 12) out.segments.push(...linesToSegments(lines, file.name, `pagina ${n}`));
      else empty.push(n);
    }
    out.stats = { pages: total, pagesRead: limit - empty.length, ocrPages: ocrDone, emptyPages: empty };
    if (ocrDone.length) out.notes.push(`Pagina ${pageList(ocrDone)} zijn gescand en met OCR gelezen; controleer de herkende tekst in het voorbeeld.`);
    if (total > limit) { out.warnings.push(`Alleen de eerste ${limit} van ${total} pagina's zijn gelezen.`); }
    if (!out.segments.length) {
      out.status = 'unreadable';
      out.message = ocrOffline ? `Deze PDF lijkt een scan, maar de tekstherkenning (OCR) kon niet worden geladen. ${LIB_HELP}` : env.ocrPdfPage ? `Er is geen tekst gevonden in de ${total} pagina's, ook niet met OCR. De scan is mogelijk onleesbaar.` : `Er is geen tekst gevonden in deze PDF. Het lijkt een scan; OCR is niet beschikbaar.`;
    } else if (empty.length) {
      out.status = 'partial';
      out.message = `Pagina ${pageList(empty)} van ${total} bevat geen leesbare tekst en is niet verwerkt.`;
      if (ocrOffline) out.message += ` De tekstherkenning (OCR) voor gescande pagina's kon niet worden geladen. ${LIB_HELP}`;
    }
    return out;
  }

  /* ---------- Excel ---------- */
  function cellValue(XLSX, cell) {
    if (!cell || cell.t === 'z') return '';
    if (cell.t === 'n') {
      if (cell.z && XLSX.SSF && XLSX.SSF.is_date(cell.z)) {
        const d = XLSX.SSF.parse_date_code(cell.v);
        if (d) {
          const p = n => String(n).padStart(2, '0');
          const date = cell.v >= 1 ? `${d.y}-${p(d.m)}-${p(d.d)}` : '';
          const time = (d.H || d.M) ? `${p(d.H)}:${p(d.M)}` : '';
          return [date, time].filter(Boolean).join(' ') || cell.w || '';
        }
      }
      return cell.v;
    }
    if (cell.t === 'd') { const d = cell.v; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
    if (cell.t === 'b') return cell.v ? 'ja' : 'nee';
    if (cell.t === 'e') return '';
    return String(cell.v ?? '').trim();
  }
  function sheetBlocks(XLSX, ws) {
    if (!ws || !ws['!ref']) return { blocks: [], errors: [] };
    const range = XLSX.utils.decode_range(ws['!ref']);
    const errors = []; const rows = [];
    const lastRow = Math.min(range.e.r, range.s.r + MAX_SHEET_ROWS - 1);
    for (let r = range.s.r; r <= lastRow; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.t === 'e') errors.push(`${addr}: ${cell.w || 'fout in formule'}`);
        row.push(cellValue(XLSX, cell));
      }
      rows.push({ n: r + 1, cells: row });
    }
    while (rows.length && rows[rows.length - 1].cells.every(c => c === '')) rows.pop();
    const blocks = []; let cur = null;
    rows.forEach(r => {
      if (r.cells.every(c => c === '')) { cur = null; return; }
      if (!cur) { cur = { first: r.n, rows: [] }; blocks.push(cur); }
      cur.rows.push(r.cells);
    });
    // lege kolommen links/rechts weghalen
    blocks.forEach(b => {
      const used = b.rows[0].map((_, i) => b.rows.some(r => r[i] !== '')); 
      b.rows = b.rows.map(r => r.filter((_, i) => used[i]));
    });
    return { blocks, errors, truncated: range.e.r > lastRow };
  }
  async function readExcel(file, bytes, env) {
    const out = result(file, { type: 'Excel' });
    let XLSX, wb;
    try {
      XLSX = await env.loadXlsx();
      wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellNF: true, cellDates: false });
    } catch (err) {
      const lf = libFail(file, err, 'Excel', 'Excel-bestanden'); if (lf) return lf;
      return fail(file, 'unreadable', 'Dit Excel-bestand kon niet worden geopend (beschadigd of met wachtwoord beveiligd).', 'Excel');
    }
    const meta = (wb.Workbook && wb.Workbook.Sheets) || [];
    const done = [], skipped = [];
    wb.SheetNames.forEach((name, i) => {
      if (meta[i] && meta[i].Hidden) { skipped.push(`${name} (verborgen)`); return; }
      const { blocks, errors, truncated } = sheetBlocks(XLSX, wb.Sheets[name]);
      if (!blocks.length) { skipped.push(`${name} (leeg)`); return; }
      done.push(name);
      let title = '';
      const location = `werkblad '${name}'`;
      blocks.forEach((b, bi) => {
        const single = b.rows.length === 1 && b.rows[0].filter(c => c !== '').length === 1;
        const next = blocks[bi + 1];
        // Een losse kopregel boven een tabel geeft de bestemming aan; anders is het gewone tekst.
        if (single && next && next.rows[0].length > 1) { title = String(b.rows[0].find(c => c !== '')); return; }
        const narrow = b.rows[0].length === 1;
        const hint = Core.targetFromName(title) || Core.targetFromName(name);
        if (narrow) out.segments.push({ kind: 'text', file: file.name, location: `${location}, rij ${b.first}`, hint, text: b.rows.map(r => String(r[0])).join('\n'), lineOffset: b.first - 1 });
        else out.segments.push({ kind: 'table', file: file.name, location: title ? `${location}, ${title}` : location, hint, firstRow: b.first, rows: b.rows });
        title = '';
      });
      errors.slice(0, 5).forEach(e => out.warnings.push(`Werkblad '${name}', cel ${e} kon niet worden gelezen en is leeg gelaten.`));
      if (truncated) out.warnings.push(`Werkblad '${name}': alleen de eerste ${MAX_SHEET_ROWS} rijen zijn gelezen.`);
    });
    out.stats = { sheets: done, skippedSheets: skipped };
    if (done.length) out.notes.push(`Verwerkte werkbladen: ${done.join(', ')}.`);
    if (skipped.length) out.notes.push(`Overgeslagen werkbladen: ${skipped.join(', ')}.`);
    if (!done.length) { out.status = 'unreadable'; out.message = 'Alle werkbladen in dit bestand zijn leeg.'; }
    return out;
  }

  /* ---------- tekst, CSV, JSON, RTF, Word, afbeeldingen ---------- */
  function binaryish(text) { const nul = (text.match(/\u0000/g) || []).length; return nul > 0 && nul / Math.max(text.length, 1) > 0.005; }

  function readTextLike(file, bytes, kind) {
    const out = result(file, { type: kind === 'csv' ? 'CSV' : 'TXT' });
    const { text, encoding } = Core.decodeBytes(bytes);
    if (binaryish(text)) return fail(file, 'unreadable', 'Dit bestand lijkt geen tekstbestand te zijn (binaire inhoud).', out.type);
    if (!text.trim()) return fail(file, 'unreadable', 'Het bestand is leeg.', out.type);
    if (encoding !== 'utf-8') out.notes.push(`Tekencodering herkend: ${encoding}.`);
    out.stats = { chars: text.length, encoding };
    if (kind === 'csv') {
      const delim = Core.detectDelimiter(text) || (extOf(file.name) === 'tsv' ? '\t' : null);
      if (!delim) { out.notes.push('Geen kolomscheiding gevonden; het bestand is als gewone tekst gelezen.'); out.segments = [{ kind: 'text', file: file.name, location: 'tekst', text }]; return out; }
      const rows = Core.parseDelimited(text, delim);
      out.notes.push(`Scheidingsteken: ${delim === '\t' ? 'tab' : delim === ';' ? 'puntkomma' : delim === '|' ? 'verticale streep' : 'komma'}; ${rows.length} rijen.`);
      out.stats.rows = rows.length; out.stats.delimiter = delim;
      out.segments = [{ kind: 'table', file: file.name, location: 'CSV', firstRow: 1, rows }];
      return out;
    }
    out.segments = Core.textToSegments(text, file.name, 'tekst');
    out.stats.lines = text.split(/\r?\n/).length;
    return out;
  }
  function readJson(file, bytes) {
    const out = result(file, { type: 'JSON' });
    const { text } = Core.decodeBytes(bytes);
    if (!text.trim()) return fail(file, 'unreadable', 'Het bestand is leeg.', 'JSON');
    let value;
    try { value = JSON.parse(text); } catch (err) { return fail(file, 'unreadable', `Ongeldige JSON: ${err.message}`, 'JSON'); }
    out.segments = Core.jsonToSegments(value, file.name);
    if (!out.segments.length) return fail(file, 'unreadable', 'De JSON bevat geen herkenbare gegevens.', 'JSON');
    return out;
  }
  function readRtf(file, bytes) {
    const out = result(file, { type: 'RTF' });
    const text = Core.rtfToText(new TextDecoder('latin1').decode(bytes));
    if (!text.trim()) return fail(file, 'unreadable', 'In dit RTF-bestand is geen tekst gevonden.', 'RTF');
    out.segments = Core.textToSegments(text, file.name, 'document');
    out.stats = { chars: text.length };
    return out;
  }
  async function readDocx(file, bytes, env) {
    const out = result(file, { type: 'Word' });
    let res;
    try {
      const mammoth = await env.loadMammoth();
      const ab = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      try { res = await mammoth.convertToHtml({ arrayBuffer: ab }); }
      catch (e1) { if (typeof Buffer === 'undefined') throw e1; res = await mammoth.convertToHtml({ buffer: Buffer.from(ab) }); }
    } catch (err) { const lf = libFail(file, err, 'Word', 'Word-bestanden'); if (lf) return lf; return fail(file, 'unreadable', 'Dit Word-bestand kon niet worden geopend (beschadigd of geen geldig .docx-bestand).', 'Word'); }
    out.segments = htmlToSegments(res.value || '', file.name, 'document');
    if (!out.segments.length) return fail(file, 'unreadable', 'In dit Word-document is geen tekst gevonden.', 'Word');
    const tables = out.segments.filter(s => s.kind === 'table').length;
    out.stats = { tables };
    return out;
  }
  async function readImage(file, bytes, env) {
    const out = result(file, { type: 'Afbeelding (OCR)' });
    if (!env.ocrImage) return fail(file, 'unreadable', 'OCR is niet beschikbaar, dus de tekst in deze afbeelding kan niet worden gelezen.', out.type);
    let r;
    try { r = await env.ocrImage(file, bytes); } catch (err) { return fail(file, 'unreadable', err && err.libraryLoad ? `De tekstherkenning (OCR) kon niet worden geladen. ${LIB_HELP} Of typ de tekst over.` : 'Tekstherkenning (OCR) is mislukt. Controleer je internetverbinding of typ de tekst over.', out.type); }
    const text = (r && r.text || '').trim();
    if (text.replace(/\s/g, '').length < 3) return fail(file, 'unreadable', 'In deze afbeelding is geen tekst herkend.', out.type);
    out.segments = [{ kind: 'text', file: file.name, location: 'afbeelding (OCR)', text }];
    out.stats = { chars: text.length, confidence: r.confidence };
    out.notes.push('Tekst herkend met OCR; controleer de gevonden onderdelen goed.');
    if (typeof r.confidence === 'number' && r.confidence < 60) { out.status = 'partial'; out.message = `OCR is onzeker (${Math.round(r.confidence)}% zekerheid); sommige tekst is mogelijk verkeerd gelezen.`; }
    return out;
  }

  /* ---------- hoofdingang ---------- */
  async function readFile(file, env = {}) {
    const ext = extOf(file.name);
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (err) { return fail(file, 'unreadable', 'Het bestand kon niet worden gelezen van dit apparaat.'); }
    if (!bytes.length) return fail(file, 'unreadable', 'Het bestand is leeg.', TYPES[ext] || '');
    const magic = sniff(bytes);
    let kind = ext;
    if (magic === 'pdf') kind = 'pdf';
    else if (magic === 'png' || magic === 'jpg') kind = IMAGE_EXT.includes(ext) ? ext : magic;
    else if (magic === 'rtf') kind = 'rtf';
    else if (ext === 'doc' || (magic === 'ole' && ext === 'doc')) return fail(file, 'unsupported', 'Oude Word-bestanden (.doc) worden niet ondersteund. Sla het document op als .docx, .rtf of .txt.', 'Word (.doc)');
    else if (magic === 'zip' && !['docx', 'xlsx', 'xlsm'].includes(ext)) kind = ext;
    try {
      if (kind === 'pdf') return await readPdf(file, bytes, env);
      if (['txt', 'md', 'text', 'log'].includes(kind)) return readTextLike(file, bytes, 'txt');
      if (kind === 'csv' || kind === 'tsv') return readTextLike(file, bytes, 'csv');
      if (kind === 'json') return readJson(file, bytes);
      if (kind === 'rtf') return readRtf(file, bytes);
      if (kind === 'docx') return await readDocx(file, bytes, env);
      if (['xlsx', 'xlsm', 'xls'].includes(kind)) return await readExcel(file, bytes, env);
      if (IMAGE_EXT.includes(kind)) return await readImage(file, bytes, env);
    } catch (err) {
      return fail(file, 'unreadable', `Het bestand kon niet worden gelezen: ${err && err.message ? err.message : err}`, TYPES[kind] || '');
    }
    return fail(file, 'unsupported', `Bestandstype .${ext || '?'} wordt niet ondersteund. Ondersteund: ${SUPPORTED_LIST}.`, ext ? '.' + ext : '');
  }

  return { readFile, pageItemsToLines, linesToSegments, htmlToSegments, sniff, SUPPORTED_LIST, TYPES, IMAGE_EXT };
});
