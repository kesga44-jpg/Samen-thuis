const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js';
const SHEETJS_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

const loaded = new Map();
/** Laadt een extern script pas wanneer het nodig is; faalt netjes (offline) met een duidelijke fout. */
export function loadScript(url, isReady) {
  if (isReady()) return Promise.resolve();
  if (!loaded.has(url)) {
    loaded.set(url, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = url;
      el.onload = () => (isReady() ? resolve() : reject(new Error('Bibliotheek niet beschikbaar')));
      el.onerror = () => { loaded.delete(url); reject(new Error('Bibliotheek kon niet worden geladen. Controleer je internetverbinding.')); };
      document.head.append(el);
    }));
  }
  return loaded.get(url);
}

export const fileKind = name => (/\.(pdf)$/i.test(name) ? 'pdf' : /\.(docx)$/i.test(name) ? 'docx' : /\.(xlsx|xls)$/i.test(name) ? 'xlsx' : /\.json$/i.test(name) ? 'json' : 'text');

const readAsText = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen'));
  reader.readAsText(file);
});

async function readPdf(file) {
  if (!navigator.onLine) throw new Error('PDF lezen vereist een internetverbinding');
  const pdfjs = await import(/* webpackIgnore: true */ PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const content = await (await pdf.getPage(n)).getTextContent();
    let line = '', lines = [];
    content.items.forEach(item => { line += item.str; if (item.hasEOL) { lines.push(line); line = ''; } else line += ' '; });
    if (line.trim()) lines.push(line);
    pages.push(lines.map(l => l.trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n');
}

/** Leest tekst uit txt/csv/json direct; pdf/docx/xlsx via lazy geladen bibliotheken. */
export async function readFileText(file) {
  const kind = fileKind(file.name);
  if (kind === 'pdf') return readPdf(file);
  if (kind === 'docx') {
    await loadScript(MAMMOTH_URL, () => Boolean(globalThis.mammoth));
    return (await globalThis.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || '';
  }
  if (kind === 'xlsx') {
    await loadScript(SHEETJS_URL, () => Boolean(globalThis.XLSX));
    const wb = globalThis.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    return wb.SheetNames.map(name => globalThis.XLSX.utils.sheet_to_csv(wb.Sheets[name], { FS: '|' })).join('\n');
  }
  return readAsText(file);
}
