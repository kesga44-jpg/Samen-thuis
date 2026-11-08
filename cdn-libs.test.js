// R5: externe bibliotheken alleen exact gepind en met SHA-384-integriteitscontrole.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const CDN = require('./cdn-libs.js');

const read = f => fs.readFileSync(__dirname + '/' + f, 'utf8');

test('elke bibliotheek heeft een exacte versie, https-URL en sha384-integrity', () => {
  for (const [name, lib] of Object.entries(CDN.LIBS)) {
    assert.match(lib.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/[a-z.-]+@\d+\.\d+\.\d+\//, name);
    assert.match(lib.integrity, /^sha384-[A-Za-z0-9+/]{64}$/, name);
  }
});

test('elke CDN-URL in de app staat in het register (geen ongepinde of onbekende externe code)', () => {
  const urls = new Set();
  for (const f of ['app.js', 'index.html', 'import-readers.js']) {
    for (const m of read(f).matchAll(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.sheetjs\.com)[^'"`\s)]*/g)) urls.add(m[0]);
  }
  assert.ok(urls.size >= 4);
  for (const url of urls) assert.ok(CDN.entryForUrl(url), 'niet geregistreerd: ' + url);
  assert.doesNotMatch(read('app.js'), /tesseract\.js@5\//, 'tesseract moet exact gepind zijn');
});

test('index.html laadt geen externe scripts meer (BrainyQuote verwijderd, R4)', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /brainyquote\.com\/link\/quotebr\.js/);
  assert.match(html, /<script src="cdn-libs\.js\?v=\d+"><\/script>[\s\S]*<script src="app\.js/);
});

test('alle scriptladers in app.js zetten integrity via het register', () => {
  const src = read('app.js');
  const loaders = src.match(/createElement\('script'\)[\s\S]{0,160}/g) || [];
  assert.ok(loaders.length >= 3);
  for (const l of loaders) assert.match(l, /SamenThuisCdn\?\.applyIntegrity/);
  assert.doesNotMatch(src, /import\(PDFJS_URL\)/, 'pdf.js alleen via geverifieerde import');
});

test('applyIntegrity: bekende bron krijgt integrity/crossorigin; onbekende bron blijft ongemoeid', () => {
  const s = {};
  assert.equal(CDN.applyIntegrity(s, 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'), true);
  assert.equal(s.src, CDN.LIBS.tesseract.url);
  assert.equal(s.integrity, CDN.LIBS.tesseract.integrity);
  assert.equal(s.crossOrigin, 'anonymous');
  const other = { src: 'x' };
  assert.equal(CDN.applyIntegrity(other, 'https://example.org/a.js'), false);
  assert.deepEqual(other, { src: 'x' });
});

test('fetchVerified: juiste bytes worden geaccepteerd, gewijzigde bytes geweigerd, netwerkfout duidelijk', async () => {
  const good = new TextEncoder().encode('console.log(1)');
  CDN.LIBS.__test = { url: 'https://cdn.jsdelivr.net/npm/x@1.0.0/x.js', integrity: await CDN.sriOf(good, webcrypto.subtle) };
  try {
    const ok = { ok: true, arrayBuffer: async () => good.buffer };
    const buf = await CDN.fetchVerified('__test', { fetchImpl: async () => ok, subtle: webcrypto.subtle });
    assert.equal(new TextDecoder().decode(buf), 'console.log(1)');
    const evil = { ok: true, arrayBuffer: async () => new TextEncoder().encode('steal()').buffer };
    await assert.rejects(CDN.fetchVerified('__test', { fetchImpl: async () => evil, subtle: webcrypto.subtle }), e => e.integrity === true);
    await assert.rejects(CDN.fetchVerified('__test', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, subtle: webcrypto.subtle }), e => e.libraryLoad && !e.integrity);
    await assert.rejects(CDN.fetchVerified('__test', { fetchImpl: async () => ({ ok: false, status: 404 }), subtle: webcrypto.subtle }), /kon niet worden geladen/);
  } finally { delete CDN.LIBS.__test; }
});
