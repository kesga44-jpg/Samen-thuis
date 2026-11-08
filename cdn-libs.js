(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisCdn = core;
})(globalThis, function () {
  'use strict';
  // Centraal register van externe bibliotheken (R5): exacte versie + Subresource Integrity (SHA-384).
  // Hashes berekend uit de npm-pakketbestanden die jsDelivr ongewijzigd serveert (zie scripts/verify-sri.mjs).
  // Een gewijzigd of gemanipuleerd bestand wordt door de browser geweigerd: de functie faalt veilig met een duidelijke melding.
  const LIBS = {
    mammoth: {
      url: 'https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',
      integrity: 'sha384-DYoASd6UI7j/h+Qtb74PSAmuACrSKT3zuAFTlrgfDUHIR2vT0pHrg8EtI95fBv/G',
      license: 'BSD-2-Clause'
    },
    // Bekende kwetsbaarheden in 0.18.5 (o.a. CVE-2024-22363). Upgrade kan alleen via cdn.sheetjs.com;
    // dat bestand kon in deze omgeving niet worden opgehaald om een hash te berekenen. Open punt R3.
    xlsx: {
      url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
      license: 'Apache-2.0'
    },
    // Was `tesseract.js@5` (zwevende versie). Nu exact 5.1.1. Worker en taaldata laadt tesseract zelf (zonder SRI): restrisico.
    tesseract: {
      url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      integrity: 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F',
      license: 'Apache-2.0'
    },
    pdfjs: {
      url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
      integrity: 'sha384-+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7',
      license: 'Apache-2.0'
    },
    pdfjsWorker: {
      url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
      integrity: 'sha384-ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o',
      license: 'Apache-2.0'
    }
  };

  // Oude, zwevende URL's die nog in oudere code kunnen voorkomen → exacte, gepinde URL.
  const ALIASES = {
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js': 'tesseract'
  };

  function entryForUrl(src) {
    const s = String(src || '');
    if (ALIASES[s]) return LIBS[ALIASES[s]];
    return Object.values(LIBS).find(lib => lib.url === s) || null;
  }

  // Zet exacte URL + integrity + crossorigin op een <script>-element. Onbekende bronnen blijven ongemoeid (geen stille wijziging).
  function applyIntegrity(script, src) {
    const lib = entryForUrl(src);
    if (!script || !lib) return false;
    script.src = lib.url;
    script.integrity = lib.integrity;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    return true;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function sriOf(buffer, subtle = globalThis.crypto && globalThis.crypto.subtle) {
    const digest = await subtle.digest('SHA-384', buffer);
    return 'sha384-' + bytesToBase64(new Uint8Array(digest));
  }

  const integrityError = name => Object.assign(new Error(`Bibliotheek ${name} is niet vertrouwd (integriteitscontrole mislukt); er is niets geladen.`), { libraryLoad: true, integrity: true });
  const loadError = name => Object.assign(new Error(`Bibliotheek ${name} kon niet worden geladen (geen internetverbinding?)`), { libraryLoad: true });

  // Haalt een bestand op en controleert de SHA-384 vóór gebruik. Geeft de bytes terug.
  async function fetchVerified(name, { fetchImpl = globalThis.fetch, subtle } = {}) {
    const lib = LIBS[name];
    if (!lib) throw new Error('Onbekende bibliotheek: ' + name);
    let response;
    try { response = await fetchImpl(lib.url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); }
    catch (_) { throw loadError(name); }
    if (!response || !response.ok) throw loadError(name);
    const buffer = await response.arrayBuffer();
    if (await sriOf(buffer, subtle) !== lib.integrity) throw integrityError(name);
    return buffer;
  }

  // ES-module (pdf.js) laden met integriteitscontrole: dynamische import() kent geen integrity-attribuut,
  // daarom eerst controleren en daarna uit een blob-URL importeren.
  const blobUrls = {};
  async function verifiedBlobUrl(name, deps = {}) {
    if (blobUrls[name]) return blobUrls[name];
    const buffer = await fetchVerified(name, deps);
    blobUrls[name] = URL.createObjectURL(new Blob([buffer], { type: 'text/javascript' }));
    return blobUrls[name];
  }
  async function importVerified(name, deps = {}) {
    const url = await verifiedBlobUrl(name, deps);
    return import(url);
  }
  async function loadPdfjs() {
    const pdfjs = await importVerified('pdfjs');
    pdfjs.GlobalWorkerOptions.workerSrc = await verifiedBlobUrl('pdfjsWorker');
    return pdfjs;
  }

  return { LIBS, ALIASES, entryForUrl, applyIntegrity, sriOf, fetchVerified, importVerified, verifiedBlobUrl, loadPdfjs };
});
