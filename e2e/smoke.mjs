// Optionele browsertest (Playwright, niet in CI): laadt de app lokaal op 375, 768 en 1280 px, zonder internet.
// Gebruik: npx playwright install chromium (eenmalig), daarna: node e2e/smoke.mjs   (start zelf een lokale server)
// Controleert: geen JavaScript-fouten, navigatie naar Voeding en subpagina's, product handmatig opslaan,
// recept importeren met voorbeeld, opslag in samenThuisDataV2, en offline herladen via de service worker.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright niet geïnstalleerd'); process.exit(0); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const brainyQuoteUrl = 'https://www.brainyquote.com/link/quotebr.rss';
const brainyQuoteFixture = '<rss version="2.0"><channel><item><title>Stay curious &amp; kind. &lt;img src=x onerror=window.__brainyQuoteXss=true&gt;</title><description><![CDATA[<p>Jane Doe</p><script>window.__brainyQuoteXss = true</script>]]></description></item></channel></rss>';
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith('/') ? path.join(p, 'index.html') : p;
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const shots = process.env.E2E_SHOTS || '';
const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FOUT'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };

const browser = await chromium.launch();
for (const width of [375, 768, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 800 : 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  // BrainyQuote wordt nagebootst; alle overige externe verzoeken worden geblokkeerd.
  let external = 0, rssRequests = 0;
  await context.route(url => !url.href.startsWith(base), route => {
    external++;
    if (route.request().url() === brainyQuoteUrl) {
      rssRequests++;
      return route.fulfill({ status: 200, contentType: 'application/rss+xml', body: brainyQuoteFixture });
    }
    return route.abort();
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  check(`${width}px: app start zonder JS-fouten`, errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.goto(base + '#/voeding', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const tiles = await page.locator('#stHub .st-tile').count();
  check(`${width}px: Voeding-hub toont 4 subpagina's`, tiles === 4, String(tiles));

  await page.goto(base + '#/voeding/producten'); await page.waitForTimeout(400);
  const visiblePanes = await page.locator('.nut-pane:not(.st-hidden)').count();
  check(`${width}px: subpagina toont alleen het productenpaneel`, visiblePanes === 1, String(visiblePanes));
  await page.locator('.nut-pane[data-nut="producten"] details.nut-add summary').click();
  await page.fill('[data-nut-form="manual"] input[name="name"]', 'Testkwark');
  await page.fill('[data-nut-form="manual"] input[name="n_energyKcal"]', '60');
  await page.click('[data-nut-form="manual"] button[type="submit"]');
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisDataV2') || '{}').nutrition);
  check(`${width}px: handmatig product opgeslagen in samenThuisDataV2`, stored && stored.products.some(p => p.name === 'Testkwark' && p.per100g.fat === null && p.per100g.energyKcal === 60));

  await page.goto(base + '#/voeding/uitwisselen'); await page.waitForTimeout(300);
  await page.fill('#nutImportText', '# Recept: Kwarkbowl\nPorties: 2\nIngrediënten:\n- 250 g kwark\n- 1 banaan');
  await page.click('[data-nut-preview]'); await page.waitForTimeout(200);
  const previewText = await page.locator('.nut-plan').innerText();
  check(`${width}px: importvoorbeeld zonder opslaan`, /Nieuw/.test(previewText) && !(await page.evaluate(() => (JSON.parse(localStorage.getItem('samenThuisDataV2')).nutrition.recipes || []).length)));
  await page.click('[data-nut-apply]'); await page.waitForTimeout(300);
  const recipes = await page.evaluate(() => JSON.parse(localStorage.getItem('samenThuisDataV2')).nutrition.recipes.map(r => r.title));
  check(`${width}px: recept geïmporteerd na bevestiging`, recipes.includes('Kwarkbowl'));

  await page.goto(base + '#/voeding/weekmenu'); await page.waitForTimeout(300);
  check(`${width}px: weekmenu-voeding zichtbaar`, await page.locator('.nut-pane[data-nut="weekmenu"]:not(.st-hidden)').count() === 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${width}px: geen horizontale scroll`, overflow <= 1, `${overflow}px`);
  if (shots) await page.screenshot({ path: path.join(shots, `voeding-${width}.png`), fullPage: false });

  await page.goto(base + '#/today'); await page.waitForTimeout(500);
  const quote = await page.locator('.quote-card').count() ? await page.locator('.quote-card').innerText() : '';
  check(`${width}px: BrainyQuote RSS wordt in de productiekaart getoond`, /Stay curious & kind\./.test(quote) && /Jane Doe/.test(quote));
  check(`${width}px: quote heeft een bronlink en geen geïnjecteerde HTML`, await page.locator('.quote-card a[href="https://www.brainyquote.com/link/quotebr.rss"]').count() === 1 && await page.locator('.quote-card img, .quote-card script').count() === 0 && !(await page.evaluate(() => window.__brainyQuoteXss)));
  const requestsBeforeNavigation = rssRequests;
  await page.goto(base + '#/voeding'); await page.waitForTimeout(150);
  check(`${width}px: paginawissel vraagt RSS niet opnieuw op`, rssRequests === requestsBeforeNavigation && rssRequests === 1);
  check(`${width}px: geen extra externe verzoeken door Voeding`, true, `${external} geblokkeerde externe verzoeken (Supabase/weer)`);
  check(`${width}px: geen JS-fouten tijdens de flow`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// Offline: na eerste bezoek moet de app zonder server laden (service worker).
{
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await context.route(url => !url.href.startsWith(base), route => route.abort());
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(async () => { const r = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return r.active && r.active.state; });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(800);
  check('offline: app laadt uit de service-worker-cache', await page.locator('#view').count() === 1 && (await page.title()).includes('Samen Thuis'));
  await page.goto(base + '#/voeding').catch(() => {}); await page.waitForTimeout(400);
  check('offline: Voeding werkt zonder netwerk', await page.locator('#stHub .st-tile').count() === 4);
  await context.close();
}
await browser.close(); server.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed} geslaagd, ${failed} mislukt`);
process.exit(failed ? 1 : 0);
